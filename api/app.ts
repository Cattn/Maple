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
import { createEmailSender, type SendEmail } from './auth/email.js';
import { RpcManager } from './iomanager/rpc.js';
import { setupSocket } from './iomanager/socket.js';
import { createPeerServer } from './iomanager/peer.js';
import { createGetRouter } from './get/get.js';
import { createManageUserRouter } from './user/manageUser.js';
import { createPublicGetRouter } from './publicGet/get.js';
import { createFriendsRouter } from './user/friends.js';

export function createMaple(
	config: Config,
	db: Database,
	sendEmail: SendEmail = createEmailSender(config.email)
) {
	const app = express();
	const server = http.createServer(app);
	const corsOptions = { origin: config.corsOrigins, credentials: true };
	const io: MapleServer = new Server(server, { cors: corsOptions, maxHttpBufferSize: 5e7 });
	const rpc = new RpcManager(io);
	const auth = createAuth({
		config,
		db,
		sendEmail,
		onSessionRevoked: (sessionId) => rpc.disconnectSession(sessionId)
	});
	const services = { db, io, rpc, auth };
	app.set('trust proxy', config.trustedProxies);
	app.use((req, res, next) => {
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

	app.get('/', (req, res) => {
		res.status(200).send('Hello! I is alive!');
	});

	app.use('/peerjs', createPeerServer(server));
	app.use('/get', createGetRouter(services));
	app.use('/user/manage', createManageUserRouter(services));
	app.use('/public/get', createPublicGetRouter(services));
	app.use('/user/friends', createFriendsRouter(services));

	setupSocket(services, config.corsOrigins);

	return { app, server, io, auth };
}
