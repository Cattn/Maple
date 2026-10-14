const ioTools = require('./io');

const LEASE_MS = 90000;
let manager;

function create(io) {
	const producers = new Map();

	function clear(id) {
		const producer = producers.get(id);
		if (!producer) return;
		clearTimeout(producer.timer);
		producers.delete(id);
		ioTools.discordRPC(id, [], io, { playing: false });
	}

	function update(client, data) {
		if (!client.connected || client.rpcSuperseded || !data || typeof data !== 'object') return;
		if (typeof data.playing !== 'boolean' || typeof data.discord !== 'boolean') return;
		for (const key of ['position', 'duration', 'playbackRate']) {
			if (data[key] !== undefined && (!Number.isFinite(data[key]) || data[key] < 0)) return;
		}
		if (data.playbackRate === 0) return;
		if (data.playing && (!Number.isFinite(data.position) ||
			['title', 'artist', 'album'].some(key => typeof data[key] !== 'string'))) return;

		const id = client.user.id;
		const playing = data.playing && data.discord &&
			(data.duration === undefined || data.position < data.duration);
		const previous = producers.get(id);
		if (previous && previous.client !== client) {
			if (!playing || data.claim !== true) return;
			previous.client.rpcSuperseded = true;
		}
		if (!playing) {
			clear(id);
			return;
		}
		if (previous) clearTimeout(previous.timer);
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
		ioTools.discordRPC(id, [], io, snapshot);
	}

	function connect(client) {
		const id = client.user.id;
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
		ioTools.discordRPC(id, [], io, snapshot, client);
		client.on('playbackState', data => update(client, data));
		client.on('disconnect', () => {
			if (producers.get(id)?.client === client) clear(id);
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
