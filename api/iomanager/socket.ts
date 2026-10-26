import { sessionUser } from '../auth/session.js';
import { isRecord } from '../types/record.js';
import type { Services } from '../types/services.js';
import * as ioTools from './io.js';
import { friendIds, validateNowPlaying } from './nowPlaying.js';

export function setupSocket({ db, io, rpc, auth }: Services, origins: string[]) {
	io.use((socket, next) => {
		const origin = socket.handshake.headers.origin;
		if (origin && !origins.includes(origin)) {
			return next(new Error('Authentication error: Untrusted origin'));
		}
		sessionUser(auth, socket.handshake.headers).then(
			(user) => {
				if (!user) return next(new Error('Authentication error: Invalid session'));
				socket.data.user = user;
				next();
			},
			() => next(new Error('Authentication error: Session check failed'))
		);
	});

	io.on('connection', (client) => {
		const id = client.data.user.id;
		console.log('[SOCKET] User connected: ' + id);
		rpc.connect(client);

		client.on('nowPlaying', async (data) => {
			const received = isRecord(data) ? data.nowPlaying : undefined;
			const nowPlaying = isRecord(received) ? { ...received, id } : received;
			const validation = validateNowPlaying(nowPlaying);

			try {
				if (!validation.valid || !isRecord(nowPlaying)) {
					console.warn(
						`[SOCKET] Invalid nowPlaying data received for user ${id}: ${validation.message.join(', ')}`
					);
					client.emit('invalidNowPlaying', { message: validation.message });
					return;
				}
				if (validation.flag) {
					console.warn(
						`[SOCKET] Semi-valid nowPlaying data received for user ${id}: ${validation.message.join(', ')}`
					);
					client.emit('semiValidNowPlaying', { message: validation.message });
				}
				rpc.update(client, { playing: true, position: 0, claim: true, ...nowPlaying });
				const friends = db.all('SELECT * FROM friends_db WHERE user_id = ? OR friend_id = ?', [
					id,
					id
				]);
				if (friends.length > 0) {
					await ioTools.nowPlaying(io, db, id, friendIds(friends, id), nowPlaying);
				}
			} catch (error) {
				console.error('[ERROR] Error in nowPlaying:', error);
			}
		});

		client.on('disconnect', () => {
			console.log('[SOCKET] User disconnected: ' + id);
		});
	});
}
