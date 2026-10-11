const ioTools = require('./io');
const { randomUUID } = require('node:crypto');

const LEASE_MS = 90000;
let manager;

function create(io) {
	const producers = new Map();
	const generations = new Map();

	function generation(id) {
		if (!generations.has(id)) generations.set(id, randomUUID());
		return generations.get(id);
	}

	function sendOwnership(client) {
		const id = client.user.id;
		client.emit('rpcOwnership', { generation: generation(id), owned: producers.get(id)?.client === client });
	}

	function rotateOwnership(id) {
		generations.set(id, randomUUID());
		for (const client of io.sockets.sockets.values()) {
			if (client.connected && client.user.id === id) {
				sendOwnership(client);
			}
		}
	}

	function clear(id) {
		const producer = producers.get(id);
		if (!producer) return;
		clearTimeout(producer.timer);
		producers.delete(id);
		rotateOwnership(id);
		ioTools.discordRPC(id, [], io, { playing: false });
	}

	function update(client, data) {
		if (!client.connected || !data || typeof data !== 'object') return;
		if (typeof data.playing !== 'boolean' || typeof data.discord !== 'boolean') return;
		for (const key of ['position', 'duration', 'playbackRate']) {
			if (data[key] !== undefined && (!Number.isFinite(data[key]) || data[key] < 0)) return;
		}
		if (data.playbackRate === 0) return;
		if (data.playing && (!Number.isFinite(data.position) ||
			['title', 'artist', 'album'].some(key => typeof data[key] !== 'string'))) return;

		const id = client.user.id;
		// Fence every report, including queued claims/clears, against the current owner.
		if (data.generation !== generation(id)) return;
		const playing = data.playing && data.discord &&
			(data.duration === undefined || data.position < data.duration);
		const previous = producers.get(id);
		if (client.rpcSuperseded && (!playing || data.claim !== true)) return;
		if (previous && previous.client !== client) {
			if (!playing || data.claim !== true) return;
			previous.client.rpcSuperseded = true;
		}
		if (!playing) {
			clear(id);
			return;
		}
		if (previous) clearTimeout(previous.timer);
		client.rpcSuperseded = false;
		const snapshot = {
			title: data.title,
			artist: data.artist,
			album: data.album,
			image: typeof data.image === 'string' ? data.image : undefined,
			id,
			playing: true,
			position: data.position,
			duration: data.duration,
			playbackRate: data.playbackRate ?? 1
		};
		producers.set(id, {
			client,
			snapshot,
			receivedAt: Date.now(),
			timer: setTimeout(() => clear(id), LEASE_MS)
		});
		if (!previous || previous.client !== client) rotateOwnership(id);
		ioTools.discordRPC(id, [], io, snapshot);
	}

	function connect(client) {
		const id = client.user.id;
		client.on('rpcOwnershipRequest', () => sendOwnership(client));
		const producer = producers.get(id);
		let snapshot = { playing: false };
		if (producer) {
			const elapsed = (Date.now() - producer.receivedAt) / 1000;
			const position = producer.snapshot.position + elapsed * producer.snapshot.playbackRate;
			if (!producer.client.connected || !Number.isFinite(position) || elapsed * 1000 >= LEASE_MS ||
				(producer.snapshot.duration !== undefined && position >= producer.snapshot.duration)) {
				clear(id);
			} else {
				snapshot = { ...producer.snapshot, position };
			}
		}
		sendOwnership(client);
		ioTools.discordRPC(id, [], io, snapshot, client);
		client.on('playbackState', data => update(client, data));
		client.on('disconnect', () => {
			if (producers.get(id)?.client === client) clear(id);
			if (![...io.sockets.sockets.values()].some(socket => socket.connected && socket.user.id === id)) {
				generations.delete(id);
			}
		});
	}

	function disconnectAccount(id) {
		clear(id);
		for (const client of io.sockets.sockets.values()) {
			if (client.user.id === id) client.disconnect(true);
		}
	}

	manager = { connect, update, disconnectAccount };
	return manager;
}

module.exports = { create, disconnectAccount: id => manager?.disconnectAccount(id) };
