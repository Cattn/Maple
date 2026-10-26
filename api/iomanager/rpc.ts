import { randomUUID } from 'node:crypto';
import { isRecord } from '../types/record.js';
import type { MapleServer, MapleSocket, RpcSnapshot } from '../types/socket.js';
import { discordRPC } from './io.js';

const LEASE_MS = 90000;

interface Producer {
	client: MapleSocket;
	snapshot: RpcSnapshot;
	receivedAt: number;
	timer: NodeJS.Timeout;
}

function artworkId(value: unknown) {
	return typeof value === 'string' && /^[\w-]{1,128}$/.test(value) ? value : undefined;
}

function isAmount(value: unknown): value is number | undefined {
	return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export class RpcManager {
	private readonly producers = new Map<string, Producer>();
	private readonly generations = new Map<string, string>();

	constructor(private readonly io: MapleServer) {}

	private generation(id: string) {
		let generation = this.generations.get(id);
		if (!generation) {
			generation = randomUUID();
			this.generations.set(id, generation);
		}
		return generation;
	}

	private sendOwnership(client: MapleSocket) {
		const id = client.data.user.id;
		client.emit('rpcOwnership', {
			generation: this.generation(id),
			owned: this.producers.get(id)?.client === client
		});
	}

	private userSockets(id: string) {
		return [...this.io.sockets.sockets.values()].filter((client) => client.data.user.id === id);
	}

	private rotateOwnership(id: string) {
		this.generations.set(id, randomUUID());
		for (const client of this.userSockets(id)) {
			if (client.connected) this.sendOwnership(client);
		}
	}

	private clear(id: string) {
		const producer = this.producers.get(id);
		if (!producer) return;
		clearTimeout(producer.timer);
		this.producers.delete(id);
		this.rotateOwnership(id);
		discordRPC(this.io, id, { playing: false });
	}

	update(client: MapleSocket, data: unknown) {
		if (!client.connected || !isRecord(data)) return;
		const { playing, discord, position, duration, playbackRate, title, artist, album } = data;
		if (typeof playing !== 'boolean' || typeof discord !== 'boolean') return;
		if (!isAmount(position) || !isAmount(duration) || !isAmount(playbackRate)) return;
		if (playbackRate === 0) return;
		if (
			playing &&
			(position === undefined ||
				typeof title !== 'string' ||
				typeof artist !== 'string' ||
				typeof album !== 'string')
		) {
			return;
		}

		const id = client.data.user.id;
		// Fence every report, including queued claims/clears, against the current owner.
		if (data.generation !== this.generation(id)) return;
		const active =
			playing &&
			discord &&
			position !== undefined &&
			typeof title === 'string' &&
			typeof artist === 'string' &&
			typeof album === 'string' &&
			(duration === undefined || position < duration);
		const previous = this.producers.get(id);
		if (client.data.rpcSuperseded && (!active || data.claim !== true)) return;
		if (previous && previous.client !== client) {
			if (!active || data.claim !== true) return;
			previous.client.data.rpcSuperseded = true;
		}
		if (!active) {
			this.clear(id);
			return;
		}
		if (previous) clearTimeout(previous.timer);
		client.data.rpcSuperseded = false;
		const artworkRequestId = artworkId(data.artworkRequestId);
		const sameArtwork =
			previous?.client === client &&
			artworkRequestId &&
			previous.snapshot.artworkRequestId === artworkRequestId;
		const { artworkReady, artworkWait, image } = data;
		const snapshot: RpcSnapshot = {
			title,
			artist,
			album,
			image: typeof image === 'string' ? image : undefined,
			artworkRequestId,
			artworkReady:
				sameArtwork && previous.snapshot.artworkReady === true
					? true
					: typeof artworkReady === 'boolean'
						? artworkReady
						: undefined,
			artworkWait:
				typeof artworkWait === 'number' && Number.isFinite(artworkWait)
					? Math.max(0, Math.min(30, artworkWait))
					: undefined,
			id,
			playing: true,
			position,
			duration,
			playbackRate: playbackRate ?? 1
		};
		this.producers.set(id, {
			client,
			snapshot,
			receivedAt: Date.now(),
			timer: setTimeout(() => this.clear(id), LEASE_MS)
		});
		if (!previous || previous.client !== client) this.rotateOwnership(id);
		discordRPC(this.io, id, snapshot);
	}

	connect(client: MapleSocket) {
		const id = client.data.user.id;
		client.on('rpcOwnershipRequest', () => this.sendOwnership(client));
		const producer = this.producers.get(id);
		let state: RpcSnapshot | { playing: false } = { playing: false };
		if (producer) {
			const elapsed = (Date.now() - producer.receivedAt) / 1000;
			const position = producer.snapshot.position + elapsed * producer.snapshot.playbackRate;
			if (
				!producer.client.connected ||
				!Number.isFinite(position) ||
				elapsed * 1000 >= LEASE_MS ||
				(producer.snapshot.duration !== undefined && position >= producer.snapshot.duration)
			) {
				this.clear(id);
			} else {
				const artworkWait = producer.snapshot.artworkWait;
				state = {
					...producer.snapshot,
					position,
					artworkWait: artworkWait === undefined ? undefined : Math.max(0, artworkWait - elapsed)
				};
			}
		}
		this.sendOwnership(client);
		discordRPC(this.io, id, state, client);
		client.on('playbackState', (data) => this.update(client, data));
		client.on('disconnect', () => {
			if (this.producers.get(id)?.client === client) this.clear(id);
			if (!this.userSockets(id).some((socket) => socket.connected)) {
				this.generations.delete(id);
			}
		});
	}

	disconnectAccount(id: string) {
		this.clear(id);
		for (const client of this.userSockets(id)) {
			client.disconnect(true);
		}
	}

	disconnectSession(sessionId: string) {
		for (const client of this.io.sockets.sockets.values()) {
			if (client.data.user.sessionId === sessionId) client.disconnect(true);
		}
	}

	artworkUploaded(id: string, requestId: unknown) {
		const artworkRequestId = artworkId(requestId);
		if (requestId !== undefined && !artworkRequestId) return;
		const producer = this.producers.get(id);
		// A late upload from another track/tab must not confirm the current track.
		if (producer && producer.snapshot.artworkRequestId !== artworkRequestId) return;
		if (producer) producer.snapshot.artworkReady = true;
		for (const client of this.userSockets(id)) {
			if (client.connected) client.emit('albumArtUploaded', { id, artworkRequestId });
		}
	}
}
