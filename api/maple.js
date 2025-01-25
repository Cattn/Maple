const express = require('express');
const cors = require('cors');
const login = require('./auth/login');
const getPath = require('./get/get.js')
const manageUser = require('./user/manageUser.js')
const publicGet = require('./publicGet/get.js')
const friends = require('./user/friends.js');
const ioTools = require('./iomanager/io.js');
const app = express();

const fs = require('fs');
const https = require('https');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var ExpressPeerServer = require('peer').ExpressPeerServer;

var options = {
    debug: true
}

const privateKey = fs.readFileSync('/etc/letsencrypt/live/maple.kolf.pro/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/maple.kolf.pro/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/maple.kolf.pro/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

const corsOptions = {
	origin: true,
	credentials: true
};

const server = https.createServer(credentials, app);

const io = require('socket.io')(server);

app.use(cors(corsOptions));
app.use('/peerjs', ExpressPeerServer(server, options));
app.use('/login', login);
app.use('/get', getPath);
app.use('/user/manage', manageUser);
app.use('/public/get', publicGet);
app.use('/user/friends', friends);


io.use((socket, next) => {
	console.log('Headers:', socket.handshake.headers);
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
	  console.error('No token found.');
	  return next(new Error('Authentication error: Missing token'));
	}
  
	jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
	  if (err) {
		console.error('JWT verification failed:', err);
		return next(new Error('Authentication error: Invalid token'));
	  }
  
	  socket.user = decoded;
	  next();
	});
  });  

io.on('connection', client => {
	console.log('User connected: ' + client.user.id);
	client.on('addFriend', data => { 
		console.log("User: " + client.user.id + " wants to add " + data.friendId);
		const userId = client.user.id;
		const friendId = data.friendId;
		ioTools.addFriend(userId, friendId); 
	 });
	client.on('disconnect', () => { /* … */ });
});


server.listen(443);
 