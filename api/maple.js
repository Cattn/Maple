const express = require('express');
const cors = require('cors');
const login = require('./auth/login');
const app = express();

const fs = require('fs');
const https = require('https');

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

const server = https.createServer(credentials, app);

app.use(cors());
app.use('/peerjs', ExpressPeerServer(server, options));
app.use('/login', login);

server.listen(443);