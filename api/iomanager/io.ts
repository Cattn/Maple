import type { Database } from '../storage/sqlite.js';
import type {
	MapleServer,
	MapleSocket,
	RpcState,
	RpcUpdate,
	ServerEvents
} from '../types/socket.js';

export async function getSocket(io: MapleServer, id: string) {
	try {
		const clients = await io.fetchSockets();
		return clients.filter((client) => client.data.user.id === id);
	} catch (error) {
		console.error(error);
		return [];
	}
}

export async function addFriend(io: MapleServer, user: string, friend: string) {
	for (const client of await getSocket(io, friend)) {
		client.emit('friendRequest', { id: user });
	}
}

export async function nowPlaying(
	io: MapleServer,
	db: Database,
	user: string,
	friendIds: string[],
	nowPlaying: Record<string, unknown>
) {
	try {
		db.run(
			'INSERT INTO live_status (user_id, playing) VALUES (?, ?) ' +
				'ON CONFLICT(user_id) DO UPDATE SET playing = excluded.playing',
			[user, JSON.stringify(nowPlaying)]
		);
		const clients = await io.fetchSockets();
		for (const client of clients) {
			if (friendIds.includes(client.data.user.id)) {
				client.emit('nowPlaying', { nowPlaying, id: user });
			}
		}
	} catch (error) {
		console.error('[ERROR] Error in nowPlaying:', error);
	}
}

export function discordRPC(io: MapleServer, user: string, state: RpcState, target?: MapleSocket) {
	const rpcData: RpcUpdate = !state.playing
		? { playing: false }
		: {
				artist: state.artist || undefined,
				title: state.title || undefined,
				state: state.artist ? `by ${state.artist}` : undefined,
				largeImageKey: state.image ? `data:image/jpeg;base64,${state.image}` : 'maple',
				largeImageText: state.album || undefined,
				id: user,
				album: state.album || undefined,
				artworkRequestId: state.artworkRequestId,
				artworkReady: state.artworkReady,
				artworkWait: state.artworkWait,
				playing: true,
				position: state.position,
				duration: state.duration,
				playbackRate: state.playbackRate,
				smallImageKey: 'play',
				smallText: 'Listening to Maple',
				buttons: [
					{
						label: 'Listen on Maple',
						url: `https://maple.kolf.pro/user/${user}`
					}
				]
			};

	const clients = target
		? [target]
		: [...io.sockets.sockets.values()].filter((client) => client.data.user.id === user);
	for (const client of clients) {
		client.emit('rpcUpdate', rpcData);
	}
}

export async function emitAll<E extends keyof ServerEvents>(
	io: MapleServer,
	id: string,
	event: E,
	...data: Parameters<ServerEvents[E]>
) {
	for (const client of await getSocket(io, id)) {
		client.emit(event, ...data);
	}
}
