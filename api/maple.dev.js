// ONLY USE IN DEV ENVIRONMENT!

import express from 'express';

import cors from 'cors';
import login from './auth/login.js';
import getPath from './get/get.js';
import manageUser from './user/manageUser.js';
import publicGet from './publicGet/get.js';
import friends from './user/friends.js';
import ioTools from './iomanager/io.js';
const app = express();

import http from 'http';
import jwt from 'jsonwebtoken';
require('dotenv').config();

import { ExpressPeerServer } from 'peer';

var options = {
	debug: true
};

const corsOptions = {
	origin: 'http://localhost:5173',
	credentials: true
};

const server = http.createServer(app);

import ioFactory from 'socket.io';

const io = ioFactory(server, {
	cors: {
		origin: 'http://localhost:5173',
		credentials: true
	}
});

app.use(cors(corsOptions));
app.use('/peerjs', ExpressPeerServer(server, options));
app.use('/login', login);
app.use('/get', getPath);
app.use('/user/manage', manageUser);
app.use('/public/get', publicGet);
app.use('/user/friends', friends);

io.use((socket, next) => {
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
});

io.on('connection', (client) => {
	console.log('User connected: ' + client.user.id);
	client.on('addFriend', (data) => {
		const userId = client.user.id;
		const friendId = data.friendId;
		ioTools.addFriend(userId, friendId);
	});
	client.on('disconnect', () => {
		/* … */
	});
});

server.listen(3000, () => {
	console.log('Server listening on port 3000');
});
