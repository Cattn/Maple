import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createMaple } from '../app.js';
import { loadConfig } from '../config.js';
import { createFile } from '../storage/create-file.js';
import { openDatabase } from '../storage/sqlite.js';
import { isRecord } from '../types/record.js';
import {
	json,
	next,
	origin,
	startMaple,
	testEnv,
	verifiedAccount,
	type Client,
	type Harness
} from './harness.js';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maple-api-test-'));
let harness: Harness;
let base: string;
let client: Client;
let userId: string;

before(async () => {
	harness = await startMaple();
	base = harness.base;
	({ client, id: userId } = await verifiedAccount(harness, 'tester', 'tester@example.test'));
});

after(async () => {
	await harness?.close();
	fs.rmSync(directory, { recursive: true, force: true });
});

test('serves the health route with production rate limiting', async () => {
	const response = await fetch(base);
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'Hello! I is alive!');
	assert.equal(response.headers.get('x-ratelimit-limit'), '5000');
});

test('protects feature routes with verified sessions', async () => {
	const user = await client.request('/get/me');
	assert.deepEqual(await json(user), {
		username: 'tester',
		id: userId,
		name: null,
		pfp: null,
		listeningVisibility: 'public',
		listening: { current: null, lastPlayed: null }
	});
	assert.equal((await fetch(`${base}/get/me`)).status, 401);
	assert.equal((await fetch(`${base}/user/friends/me`)).status, 401);
});

test('rejects sockets without a valid session', async () => {
	const socket = connect(base, { reconnection: false });
	const error = await next(socket, 'connect_error');
	assert.ok(error instanceof Error);
	assert.equal(error.message, 'Authentication error: Invalid session');
	socket.close();
});

test('accepts websocket-only Socket.IO connections', async () => {
	const socket = connect(base, {
		reconnection: false,
		transports: ['websocket'],
		extraHeaders: { cookie: client.cookie, origin }
	});
	await next(socket, 'connect');
	assert.equal(socket.io.engine.transport.name, 'websocket');
	socket.close();
	assert.equal((await fetch(`${base}/peerjs`)).status, 404);
});

test('wires playback, Discord sharing, artwork and logout disconnects', async () => {
	const socket = client.socket();
	const [ownership, initial] = await Promise.all([
		next(socket, 'playbackOwnership'),
		next(socket, 'rpcUpdate')
	]);
	assert.deepEqual(ownership, { playbackId: null });
	assert.deepEqual(initial, { playing: false });

	const invalid = await socket.emitWithAck('playbackStart', { title: '' });
	assert.equal(invalid.ok, false);

	const update = next(socket, 'rpcUpdate');
	const started = await socket.emitWithAck('playbackStart', {
		playbackId: 'art-1',
		title: 'Song',
		artist: 'Artist',
		album: 'Album',
		duration: 200,
		discord: true
	});
	assert.deepEqual(started, { ok: true });
	const playing = await update;
	assert.ok(isRecord(playing));
	assert.equal(playing.playing, true);
	assert.equal(playing.state, 'by Artist');
	assert.equal(playing.largeImageKey, 'maple');

	const form = new FormData();
	form.append('playbackId', 'art-1');
	const cover = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
	form.append('albumArt', new Blob([cover], { type: 'image/jpeg' }), 'a.jpg');
	const uploaded = next(socket, 'rpcUpdate');
	const upload = await client.request('/user/manage/me/albumArt', {
		method: 'PUT',
		body: form
	});
	assert.equal(upload.status, 200);
	const shared = await uploaded;
	assert.ok(isRecord(shared) && typeof shared.largeImageKey === 'string');
	assert.ok(shared.largeImageKey.startsWith('https://api.maple.music/public/artwork/'));
	const artwork = new URL(shared.largeImageKey).pathname.split('/')[4];
	assert.ok(artwork);
	assert.equal((await fetch(`${base}/public/get/albumArt/${userId}/1`)).status, 404);
	const art = await fetch(`${base}/public/get/albumArt/${userId}/${artwork}`);
	assert.equal(art.headers.get('content-type'), 'image/jpeg');
	assert.deepEqual(Buffer.from(await art.arrayBuffer()), cover);

	const disconnected = next(socket, 'disconnect');
	const logout = await client.post('/api/auth/sign-out');
	assert.equal(logout.status, 200);
	assert.equal(await disconnected, 'io server disconnect');
	const profile = await json(await fetch(`${base}/public/get/user/id/${userId}`));
	assert.ok(isRecord(profile.listening));
	assert.equal(profile.listening.current, null);
});

test('development config allows the local frontend origin', async () => {
	const file = path.join(directory, 'dev.sqlite');
	await createFile(file, () => undefined);
	const devDb = openDatabase(file);
	const dev = createMaple(
		loadConfig({ BETTER_AUTH_SECRET: testEnv.BETTER_AUTH_SECRET }, true),
		devDb
	);
	const response = await new Promise<Response>((resolve, reject) => {
		dev.server.listen(0, '127.0.0.1', () => {
			const address = dev.server.address();
			if (!address || typeof address !== 'object') return reject(new Error('No address'));
			const origin = 'http://localhost:5173';
			fetch(`http://127.0.0.1:${address.port}`, { headers: { origin } }).then(resolve, reject);
		});
	});
	assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
	assert.equal(response.headers.get('x-ratelimit-limit'), null);
	await dev.io.close();
	devDb.close();
});
