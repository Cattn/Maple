import type { ZodType } from 'zod';
import { activeSession, sessionUser } from '../auth/session.js';
import type { PlaybackReply } from '../types/playback.js';
import type { Services } from '../types/services.js';
import type { MapleSocket } from '../types/socket.js';
import { firstIssue } from '../validation/account.js';
import {
	playbackStartSchema,
	playbackStopSchema,
	playbackUpdateSchema
} from '../validation/playback.js';
import { accountRoom, sessionRoom } from './io.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function watchSession({ db }: Services, client: MapleSocket) {
	let timer: NodeJS.Timeout | undefined;
	const check = () => {
		clearTimeout(timer);
		const expiresAt = activeSession(db, client.data.user);
		if (expiresAt === undefined) {
			client.disconnect(true);
			return false;
		}
		timer = setTimeout(check, Math.min(expiresAt - Date.now(), DAY_MS));
		return true;
	};
	client.on('disconnect', () => clearTimeout(timer));
	return check;
}

export function setupSocket(services: Services, origins: string[]) {
	const { io, auth, playback } = services;

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
		const { id, sessionId } = client.data.user;
		console.log('[SOCKET] User connected: ' + id);
		const sessionActive = watchSession(services, client);
		if (!sessionActive()) return;
		void client.join([accountRoom(id), sessionRoom(sessionId)]);
		playback.connect(client);

		function handle<T>(
			event: string,
			schema: ZodType<T>,
			apply: (data: T) => boolean
		): (data: unknown, reply?: (result: PlaybackReply) => void) => void {
			return (data, reply) => {
				const respond = (result: PlaybackReply) => {
					if (typeof reply === 'function') reply(result);
				};
				if (!sessionActive()) return;
				const parsed = schema.safeParse(data);
				if (!parsed.success) {
					const error = firstIssue(parsed) ?? 'Invalid playback data.';
					console.warn(`[SOCKET] Invalid ${event} data received for user ${id}: ${error}`);
					return respond({ ok: false, error });
				}
				try {
					if (apply(parsed.data)) return respond({ ok: true });
					respond({ ok: false, error: 'Playback is no longer current.' });
				} catch (error) {
					console.error(`[ERROR] Error in ${event}:`, error);
					respond({ ok: false, error: 'Unable to update playback.' });
				}
			};
		}

		client.on(
			'playbackStart',
			handle('playbackStart', playbackStartSchema, (data) => playback.start(client, data))
		);
		client.on(
			'playbackUpdate',
			handle('playbackUpdate', playbackUpdateSchema, (data) => playback.update(client, data))
		);
		client.on(
			'playbackStop',
			handle('playbackStop', playbackStopSchema, (data) => playback.stop(client, data))
		);

		client.on('disconnect', () => {
			playback.disconnect(client);
			console.log('[SOCKET] User disconnected: ' + id);
		});
	});
}
