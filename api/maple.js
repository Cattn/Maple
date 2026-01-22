const express = require('express');
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const cors = require('cors');
const login = require('./auth/login');
const getPath = require('./get/get.js');
const manageUser = require('./user/manageUser.js');
const publicGet = require('./publicGet/get.js');
const ioTools = require('./iomanager/io.js');
const socket = require('./socket');
const app = express();

const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('[1] Starting server initialization...');

process.on('uncaughtException', (error) => {
	console.error('[ERROR] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

var ExpressPeerServer = require('peer').ExpressPeerServer;

var options = {
	debug: true,
	generateClientId: (req) => {
		try {
			if (!req || !req.headers || !req.headers.cookie) {
				console.log('[PEER] No request object or cookies found, generating random ID');
				return (Math.random().toString(36) + "0000000000000000000").substr(2, 16);
			}
			
			const cookieString = req.headers.cookie;
			const cookies = cookieString.split(';');
			const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
			if (!tokenCookie) {
				console.log('[PEER] No token cookie found, generating random ID');
				return (Math.random().toString(36) + "0000000000000000000").substr(2, 16);
			}
			
			const token = tokenCookie.split('=')[1];
			const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
			return decoded.id;
		} catch (error) {
			console.error('[ERROR] Failed to generate PeerJS client ID:', error);
			// Generate a random ID as fallback
			return (Math.random().toString(36) + "0000000000000000000").substr(2, 16);
		}
	}
};

const slower = slowDown({
	windowMs: 2 * 60 * 1000,
	delayAfter: 5,
	delayMs: (hits) => {
		if (hits <= 15) return hits * 100;
		return (hits - 15) * 1000 + 2000;
	},
	maxDelayMs: 15000,
});

const limiter = rateLimit({
	windowMs: 2 * 60 * 1000,
	limit: 35,
})

try {


	const corsOptions = {
		origin: ['https://maple.kolf.pro', 'https://api.maple.music', 'https://discord.com', 'https://play.maple.music'],
		credentials: true
	};

	console.log('[4] Creating HTTPS server...');
	const server = http.createServer(app);

	const ioOptions = {
		cors: {
			origin: ['https://maple.kolf.pro', 'https://api.maple.music', 'https://discord.com', 'https://play.maple.music'],
			credentials: true
		},
		maxHttpBufferSize: 5e7
	};

	console.log('[5] Initializing socket.io...');
	const io = socket.init(server, ioOptions);
	console.log('[6] Socket.io initialized');

	console.log('[7] Setting up routes...');
	const friends = require('./user/friends.js');

	app.use(limiter);
	app.use(slower);
	
	app.use(cors(corsOptions));

	app.get('/', (req, res) => {
		res.status(200).send('Hello! I is alive!');
	});

	app.get('/peerjs/generate-id', (req, res) => {
		try {
			const cookieString = req.headers.cookie;
			if (!cookieString) {
				return res.status(401).json({ error: 'No cookies found' });
			}
			
			const cookies = cookieString.split(';');
			const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
			if (!tokenCookie) {
				return res.status(401).json({ error: 'No token found' });
			}
			
			const token = tokenCookie.split('=')[1];
			const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
			return res.json({ id: decoded.id });
		} catch (error) {
			console.error('[ERROR] Failed to generate PeerJS ID:', error);
			return res.status(401).json({ error: 'Invalid token' });
		}
	});

	const peerServer = ExpressPeerServer(server, options);
	peerServer.on('connection', (client) => {
		console.log(`[PEER] User connected with ID: ${client.getId()}`);
	});

	peerServer.on('disconnect', (client) => {
		console.log(`[PEER] User disconnected with ID: ${client.getId()}`);
	});

	app.use('/peerjs', peerServer);
	app.use('/login', login);
	app.use('/get', getPath);
	app.use('/user/manage', manageUser);
	app.use('/public/get', publicGet);
	app.use('/user/friends', friends);
	console.log('[8] Routes setup complete');

	console.log('[9] Setting up socket authentication...');
	io.use((socket, next) => {
		try {
			const cookieString = socket.handshake.headers['cookie'];
			let token = null;

			if (cookieString) {
				const cookies = cookieString.split(';');
				const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith('token='));
				if (tokenCookie) {
					token = tokenCookie.split('=')[1];
				}
			}

			if (!token) {
				return next(new Error('Authentication error: Missing token'));
			}

			jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
				if (err) {
					return next(new Error('Authentication error: Invalid token'));
				}

				socket.user = decoded;
				next();
			});
		} catch (error) {
			console.error('[ERROR] Socket authentication error:', error);
			next(error);
		}
	});
	console.log('[10] Socket authentication setup complete');

	console.log('[11] Setting up socket event handlers...');
	io.on('connection', (client) => {
		console.log('[SOCKET] User connected: ' + client.user.id);

		client.on('nowPlaying', async (data) => {
			const id = client.user.id;
			console.log(`[SOCKET] Received nowPlaying from user ${id} (socket ID: ${client.id}):`, data.nowPlaying);
			console.log(`[SOCKET] Full message received:`, data);

			const validation = validateNowPlaying(data.nowPlaying);


			const sql = 'SELECT * FROM friends_db WHERE user_id = ? OR friend_id = ?';

			try {
				if (validation.valid === false) {
					console.warn('[SOCKET] Invalid nowPlaying data received for user ' + id + ': ' + validation.message.join(', '));
					client.emit('invalidNowPlaying', { message: validation.message });
				} else {
					if (validation.flag === true) {
						console.warn('[SOCKET] Semi-valid nowPlaying data received for user ' + id + ': ' + validation.message.join(', '));
						client.emit('semiValidNowPlaying', { message: validation.message });
					}
					const pool = require('./db');
					const [allFriends] = await pool.promise().query(sql, [id, id]);
					console.log(`[SOCKET] Found ${allFriends.length} friends for user ${id}:`, allFriends);
					
					const sorted = sortFriends(allFriends, id);
					console.log(`[SOCKET] Sorted friends for user ${id}:`, sorted);

					if (allFriends !== null && allFriends.length > 0) {
						console.log(`[SOCKET] Emitting nowPlaying to friends of user ${id}`);
						ioTools.nowPlaying(id, sorted, io, data.nowPlaying);
					} else {
						console.log(`[SOCKET] No friends found for user ${id}`);
					}
					if (data.nowPlaying.discord === true) {
						console.log(`[SOCKET] Emitting Discord RPC for user ${id}`);
						ioTools.discordRPC(id, sorted, io, data.nowPlaying);
					}
				}
			} catch (error) {
				console.error('[ERROR] Error in nowPlaying:', error);
			}
		});

		client.on('disconnect', () => {
			console.log('[SOCKET] User disconnected: ' + client.user.id);
		});
	});

	io.on('disconnect', (reason) => {
		console.log(`[SOCKET] Server disconnected: ${reason}`);
	});

	io.on('connect_error', (error) => {
		console.log(`[ERROR] Socket connection error: ${error}`);
	});
	console.log('[12] Socket event handlers setup complete');

	function sortFriends(unsorted, id) {
		let newFriends = [];
		unsorted.forEach((friend) => {
			if (friend.user_id === id && friend.friend_id !== id) {
				newFriends.push({ user_id: id, friend_id: friend.friend_id });
			} else if (friend.friend_id === id && friend.user_id !== id) {
				newFriends.push({ user_id: friend.user_id, friend_id: id });
			}
		});
		return newFriends;
	}

	function validateNowPlaying(data) {
		const errors = [];

		if (!data) {
			return { valid: false, message: ['Data is not provided'], flag: false };
		} else if (typeof data !== 'object') {
			return { valid: false, message: ['Data is not an object'], flag: false };
		}

		if (!data.id) {
			errors.push('id is not provided');
		} else if (typeof data.id !== 'string' || data.id.trim() === '') {
			errors.push('id is not a string or is empty');
		}

		if (!data.album) {
			errors.push('album is not provided');
		} else if (typeof data.album !== 'string' || data.album.trim() === '') {
			errors.push('album is not a string or is empty');
		}

		if (!data.title) {
			errors.push('title is not provided');
		} else if (typeof data.title !== 'string' || data.title.trim() === '') {
			errors.push('title is not a string or is empty');
		}

		if (!data.artist) {
			errors.push('artist is not provided');
		} else if (typeof data.artist !== 'string' || data.artist.trim() === '') {
			errors.push('artist is not a string or is empty');
		}

		if (!('discord' in data)) {
			errors.push('discord is not provided');
		} else if (typeof data.discord !== 'boolean') {
			errors.push('discord is not a boolean');
		}

		if (errors.length > 0) {
			return { valid: false, message: errors, flag: false };
		}

		// Check optional fields
		const warnings = [];
		const hasTimePlayed = typeof data.timePlayed === 'string' && data.timePlayed.trim() !== '';
		const hasSource = typeof data.source === 'string' && data.source.trim() !== '';

		if (!hasTimePlayed) {
			warnings.push('timePlayed is missing or invalid');
		}
		if (!hasSource) {
			warnings.push('source is missing or invalid');
		}

		if (warnings.length > 0) {
			return { valid: true, message: warnings, flag: true };
		}

		return { valid: true, message: [], flag: false };
	}

	console.log('[13] Starting server on port 3000...');
	server.listen(3000, () => {
		console.log('[14] Server is running on port 3000');
		console.log('[DONE] Server initialization complete');
	});

} catch (error) {
	console.error('[FATAL] Error during server startup:', error);
	process.exit(1);
}
