import { handler } from './build/handler.js';
import express from 'express';

const app = express();

import * as fs from 'fs';
import https from 'node:https';

const privateKey = fs.readFileSync('/etc/letsencrypt/live/maple.kolf.pro/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/maple.kolf.pro/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/maple.kolf.pro/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

const server = https.createServer(credentials, app);

// let SvelteKit handle everything else, including serving prerendered pages and static assets
app.use(handler);

server.listen(443);
