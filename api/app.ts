import http from 'node:http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Server } from 'socket.io';
import { toNodeHandler } from 'better-auth/node';
import { clientIPHeader, type Config } from './config.js';
import type { Database } from './storage/sqlite.js';
import type { MapleServer } from './types/socket.js';
import { createAuth } from './auth/auth.js';
import { createArtworkLinks } from './auth/artworkLinks.js';
import { createEmailSender, type SendEmail } from './auth/email.js';
import { disconnectSession } from './iomanager/io.js';
import { PlaybackManager } from './iomanager/playback.js';
import { setupSocket } from './iomanager/socket.js';
import { createGetRouter } from './get/get.js';
import { createManageUserRouter } from './user/manageUser.js';
import { createArtworkRouter } from './publicGet/artwork.js';
import { createPublicGetRouter } from './publicGet/get.js';
import { createFriendsRouter } from './user/friends.js';
import { FriendshipManager } from './user/friendships.js';
import { ProfileManager } from './user/profiles.js';

export function createMaple(
	config: Config,
	db: Database,
	sendEmail: SendEmail = createEmailSender(config.email)
) {
	const app = express();
	const server = http.createServer(app);
	const corsOptions = { origin: config.corsOrigins, credentials: true };
	const io: MapleServer = new Server(server, { cors: corsOptions });
	const auth = createAuth({
		config,
		db,
		sendEmail,
		onSessionRevoked: (sessionId) => disconnectSession(io, sessionId)
	});
	const links = createArtworkLinks(config.authSecret, config.apiURL);
	const profiles = new ProfileManager(db);
	const friendships = new FriendshipManager(db, io);
	const playback = new PlaybackManager(io, profiles, friendships, links);
	const services = { db, io, auth, links, profiles, friendships, playback };
	app.set('trust proxy', config.trustedProxies);
	app.use((req, res, next) => {
		res.set('Cache-Control', 'private, no-store');
		const ip = req.ip ?? req.socket.remoteAddress;
		if (ip) req.headers[clientIPHeader] = ip;
		else delete req.headers[clientIPHeader];
		if (config.trustedProxies.length === 0) delete req.headers['x-forwarded-for'];
		next();
	});

	if (config.rateLimit) {
		app.use(rateLimit({ windowMs: 2 * 60 * 1000, limit: 5000 }));
	}
	app.use(cors(corsOptions));
	app.all('/api/auth/*', toNodeHandler(auth));
	app.use(['/get', '/user/manage', '/user/friends'], (req, res, next) => {
		const origin = req.get('origin');
		if (
			!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
			origin &&
			!config.corsOrigins.includes(origin)
		) {
			return res.status(403).json({ error: 'Untrusted origin' });
		}
		next();
	});

	app.get('/', (req, res) => {
		res.status(200).send('Hello! I is alive!');
	});

	app.use('/get', createGetRouter(services));
	app.use('/user/manage', createManageUserRouter(services));
	app.use('/public/get', createPublicGetRouter(services));
	app.use('/public/artwork', createArtworkRouter(services));
	app.use('/user/friends', createFriendsRouter(services));

	setupSocket(services, config.corsOrigins);

	return { app, server, io, auth };
}
