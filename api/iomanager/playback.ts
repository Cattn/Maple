import { randomUUID } from 'node:crypto';
import type { ArtworkLinks } from '../auth/artworkLinks.js';
import type { SessionUser } from '../types/auth.js';
import type {
	CurrentPlayback,
	Listening,
	PlaybackStart,
	PlaybackStop,
	PlaybackUpdate,
	RpcUpdate
} from '../types/playback.js';
import type { ListeningProfile, ListeningRecord } from '../types/profile.js';
import type { MapleServer, MapleSocket } from '../types/socket.js';
import type { FriendshipManager } from '../user/friendships.js';
import type { ProfileManager } from '../user/profiles.js';
import { accountRoom } from './io.js';

const LEASE_MS = 90000;
const RPC_HEARTBEAT_MS = 30000;
const SEEK_SECONDS = 2;

interface Playback extends CurrentPlayback {
	owner: MapleSocket;
	playbackId: string;
	discord: boolean;
	publishedArtworkURL: string | null;
	lastRpcAt: number;
	receivedAt: number;
	lease: NodeJS.Timeout;
}

function clamp(position: number, duration: number | null) {
	return duration === null ? position : Math.min(position, duration);
}

function positionNow(playback: Playback) {
	const elapsed = playback.playing ? (Date.now() - playback.receivedAt) / 1000 : 0;
	return clamp(playback.position + elapsed * playback.playbackRate, playback.duration);
}

export class PlaybackManager {
	private readonly playbacks = new Map<string, Playback>();

	constructor(
		private readonly io: MapleServer,
		private readonly profiles: ProfileManager,
		private readonly friendships: FriendshipManager,
		private readonly links: ArtworkLinks
	) {}

	start(client: MapleSocket, start: PlaybackStart) {
		const id = client.data.user.id;
		const { playbackId, discord, playing, position, playbackRate, ...track } = start;
		if (!this.profiles.recordPlay(id, track)) return false;
		const previous = this.playbacks.get(id);
		clearTimeout(previous?.lease);
		this.playbacks.set(id, {
			...track,
			owner: client,
			playbackId,
			discord,
			publishedArtworkURL: null,
			lastRpcAt: 0,
			playing,
			position: clamp(position, track.duration),
			playbackRate,
			artwork: null,
			receivedAt: Date.now(),
			lease: this.lease(id)
		});
		this.publish(id, previous?.discord ?? false, true);
		return true;
	}

	update(client: MapleSocket, update: PlaybackUpdate) {
		const playback = this.owned(client, update.playbackId);
		if (!playback) return false;
		const id = client.data.user.id;
		const duration = update.duration ?? playback.duration;
		const position = clamp(update.position, duration);
		const changed =
			update.playing !== playback.playing ||
			update.playbackRate !== playback.playbackRate ||
			update.discord !== playback.discord ||
			duration !== playback.duration ||
			Math.abs(position - positionNow(playback)) > SEEK_SECONDS;
		const discord = playback.discord;
		if (discord && !update.discord && playback.artwork) {
			const artwork = randomUUID();
			if (this.profiles.rekeyArtwork(id, artwork)) playback.artwork = artwork;
		}
		clearTimeout(playback.lease);
		Object.assign(playback, {
			playing: update.playing,
			position,
			playbackRate: update.playbackRate,
			duration,
			discord: update.discord,
			receivedAt: Date.now(),
			lease: this.lease(id)
		});
		const refreshArtwork =
			playback.playing &&
			playback.discord &&
			playback.artwork &&
			this.links.url(id, playback.artwork) !== playback.publishedArtworkURL;
		if (changed || refreshArtwork) this.publish(id, discord);
		else if (
			playback.playing &&
			playback.discord &&
			Date.now() - playback.lastRpcAt >= RPC_HEARTBEAT_MS
		)
			this.publishRpc(id);
		return true;
	}

	stop(client: MapleSocket, { playbackId }: PlaybackStop) {
		if (!this.owned(client, playbackId)) return false;
		this.end(client.data.user.id);
		return true;
	}

	end(id: string) {
		const playback = this.playbacks.get(id);
		if (!playback) return;
		clearTimeout(playback.lease);
		this.playbacks.delete(id);
		this.publish(id, playback.discord, true);
	}

	connect(client: MapleSocket) {
		const id = client.data.user.id;
		const profile = this.profiles.byId(id);
		client.emit('playbackOwnership', { playbackId: this.playbacks.get(id)?.playbackId ?? null });
		if (profile) client.emit('listening', { id, listening: this.listening(profile) });
		client.emit('rpcUpdate', this.rpc(id));
	}

	disconnect(client: MapleSocket) {
		const id = client.data.user.id;
		if (this.playbacks.get(id)?.owner === client) this.end(id);
	}

	storeArtwork(user: SessionUser, playbackId: string, image: Buffer) {
		const { id, sessionId } = user;
		const playback = this.playbacks.get(id);
		// A late upload from another track/tab must not confirm the current track.
		if (playback?.playbackId !== playbackId || playback.owner.data.user.sessionId !== sessionId)
			return false;
		const artwork = randomUUID();
		if (!this.profiles.setAlbumArt(id, artwork, image)) return false;
		playback.artwork = artwork;
		// Notify RPC listeners only after the cover has been committed to storage.
		this.publish(id, false);
		return true;
	}

	canShareArtwork(id: string, artwork: string) {
		const playback = this.playbacks.get(id);
		return playback?.discord === true && playback.artwork === artwork;
	}

	visibilityChanged(id: string) {
		this.publishListening(id, true);
	}

	listening(profile: ListeningRecord): Listening {
		return { current: this.current(profile.id), lastPlayed: profile.lastPlayed };
	}

	show(profile: ListeningRecord, viewer: string | undefined): ListeningProfile {
		const visible = profile.visibility === 'public' || profile.id === viewer;
		return {
			id: profile.id,
			username: profile.username,
			name: profile.name,
			listening: visible ? this.listening(profile) : null
		};
	}

	private owned(client: MapleSocket, playbackId: string) {
		const playback = this.playbacks.get(client.data.user.id);
		// Fence every report, including queued claims/clears, against the current owner.
		if (playback?.owner !== client || playback.playbackId !== playbackId) return undefined;
		return playback;
	}

	private lease(id: string) {
		return setTimeout(() => this.end(id), LEASE_MS);
	}

	private current(id: string): CurrentPlayback | null {
		const playback = this.playbacks.get(id);
		if (!playback) return null;
		return {
			title: playback.title,
			artist: playback.artist,
			album: playback.album,
			duration: playback.duration,
			playing: playback.playing,
			position: positionNow(playback),
			playbackRate: playback.playbackRate,
			artwork: playback.artwork
		};
	}

	private rpc(id: string): RpcUpdate {
		const playback = this.playbacks.get(id);
		if (!playback?.discord || !playback.playing) return { playing: false };
		return {
			playing: true,
			id,
			title: playback.title,
			artist: playback.artist,
			album: playback.album,
			state: playback.artist ? `by ${playback.artist}` : null,
			largeImageKey: playback.artwork ? this.links.url(id, playback.artwork) : 'maple',
			largeImageText: playback.album || null,
			smallImageKey: 'play',
			smallText: 'Listening to Maple',
			position: positionNow(playback),
			duration: playback.duration,
			playbackRate: playback.playbackRate,
			buttons: [{ label: 'Listen on Maple', url: 'https://play.maple.music' }]
		};
	}

	private publish(id: string, wasSharing: boolean, ownership = false) {
		const playback = this.playbacks.get(id);
		const account = this.io.to(accountRoom(id));
		if (ownership) {
			account.emit('playbackOwnership', { playbackId: playback?.playbackId ?? null });
		}
		this.publishListening(id);
		if (wasSharing || playback?.discord) this.publishRpc(id);
	}

	private publishRpc(id: string) {
		const playback = this.playbacks.get(id);
		const update = this.rpc(id);
		this.io.to(accountRoom(id)).emit('rpcUpdate', update);
		if (playback) {
			playback.lastRpcAt = Date.now();
			playback.publishedArtworkURL =
				update.playing && playback.artwork ? update.largeImageKey : null;
		}
	}

	private publishListening(id: string, visibilityChanged = false) {
		const profile = this.profiles.byId(id);
		if (!profile) return;
		const listening = this.listening(profile);
		this.io.to(accountRoom(id)).emit('listening', { id, listening });
		const visible = profile.visibility === 'public';
		const friends = this.friendships.friendIds(id).map(accountRoom);
		if ((visible || visibilityChanged) && friends.length > 0) {
			this.io.to(friends).emit('listening', { id, listening: visible ? listening : null });
		}
	}
}
