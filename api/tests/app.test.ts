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
	const user = await client.request(`/get/user/${userId}`);
	assert.deepEqual(await json(user), { username: 'tester', id: userId, name: null, pfp: null });
	const other = await client.request('/get/user/someone-else');
	assert.equal(other.status, 401);
	assert.equal((await fetch(`${base}/get/user/${userId}`)).status, 401);
});

test('rejects sockets without a valid session', async () => {
	const socket = connect(base, { reconnection: false });
	const error = await next(socket, 'connect_error');
	assert.ok(error instanceof Error);
	assert.equal(error.message, 'Authentication error: Invalid session');
	socket.close();
});

test('wires RPC ownership, artwork confirmation and logout disconnects', async () => {
	const socket = client.socket();
	const [ownership, initial] = await Promise.all([
		next(socket, 'rpcOwnership'),
		next(socket, 'rpcUpdate')
	]);
	assert.deepEqual(initial, { playing: false });
	assert.ok(isRecord(ownership) && typeof ownership.generation === 'string');

	socket.emit('nowPlaying', { nowPlaying: { title: '' } });
	const invalid = await next(socket, 'invalidNowPlaying');
	assert.ok(isRecord(invalid) && Array.isArray(invalid.message));

	const update = next(socket, 'rpcUpdate');
	socket.emit('nowPlaying', {
		nowPlaying: {
			title: 'Song',
			artist: 'Artist',
			album: 'Album',
			discord: true,
			timePlayed: '2026-01-01 00:00:00',
			source: 'Web',
			generation: ownership.generation,
			artworkRequestId: 'art-1'
		}
	});
	const playing = await update;
	assert.ok(isRecord(playing));
	assert.equal(playing.playing, true);
	assert.equal(playing.state, 'by Artist');
	assert.equal(playing.artworkRequestId, 'art-1');

	const form = new FormData();
	form.append('artworkRequestId', 'art-1');
	form.append('albumArt', new Blob([Buffer.from('cover')], { type: 'image/jpeg' }), 'a.jpg');
	const uploaded = next(socket, 'albumArtUploaded');
	const upload = await client.request(`/user/manage/setAlbumArt/${userId}`, {
		method: 'POST',
		body: form
	});
	assert.equal(upload.status, 200);
	assert.deepEqual(await uploaded, { id: userId, artworkRequestId: 'art-1' });
	const art = await fetch(`${base}/public/get/albumArt/${userId}/1`);
	assert.equal(Buffer.from(await art.arrayBuffer()).toString(), 'cover');

	const disconnected = next(socket, 'disconnect');
	const logout = await client.post('/api/auth/sign-out');
	assert.equal(logout.status, 200);
	assert.equal(await disconnected, 'io server disconnect');
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
