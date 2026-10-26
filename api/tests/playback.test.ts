import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Socket } from 'socket.io-client';
import { createArtworkLinks } from '../auth/artworkLinks.js';
import { field, isRecord } from '../types/record.js';
import {
	json,
	next,
	startMaple,
	strongPassword,
	testEnv,
	verifiedAccount,
	type Client,
	type Harness
} from './harness.js';

interface Account {
	client: Client;
	id: string;
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);
const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([9, 9])]);

let harness: Harness;
let alice: Account;
let bob: Account;
const sockets: Socket[] = [];

before(async () => {
	harness = await startMaple((config) => ({ ...config, rateLimit: false }));
	alice = await verifiedAccount(harness, 'alice', 'alice@example.test');
	bob = await verifiedAccount(harness, 'bob', 'bob@example.test');
	await alice.client.request(`/user/friends/me/requests/${bob.id}`, { method: 'POST' });
	await bob.client.request(`/user/friends/me/requests/${alice.id}/accept`, { method: 'POST' });
});

after(async () => {
	for (const socket of sockets) socket.close();
	await harness?.close();
});

async function connected(client: Client) {
	const socket = client.socket();
	sockets.push(socket);
	await next(socket, 'rpcUpdate');
	return socket;
}

async function session(username: string) {
	const client = harness.client();
	const response = await client.post('/api/auth/sign-in/username', {
		username,
		password: strongPassword
	});
	assert.equal(response.status, 200);
	return client;
}

function track(playbackId: string, title: string, discord = false) {
	return { playbackId, title, artist: 'Artist', album: 'Album', duration: 180, discord };
}

function update(playbackId: string, position: number, playing = true) {
	return { playbackId, position, playing, playbackRate: 1, discord: false };
}

function silent(socket: Socket, event: string, ms = 150) {
	return new Promise<void>((resolve, reject) => {
		const fail = () => reject(new Error(`Unexpected ${event}`));
		socket.once(event, fail);
		setTimeout(() => {
			socket.off(event, fail);
			resolve();
		}, ms);
	});
}

function uploadArt(account: Account, playbackId: string, image: Buffer) {
	const form = new FormData();
	form.append('playbackId', playbackId);
	form.append('albumArt', new Blob([image], { type: 'image/png' }), 'cover');
	return account.client.request('/user/manage/me/albumArt', { method: 'PUT', body: form });
}

function setVisibility(account: Account, visibility: unknown) {
	return account.client.request('/user/manage/me/listening', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ visibility })
	});
}

function stored() {
	const row = harness.db.all('SELECT * FROM live_status WHERE user_id = ?', [alice.id])[0];
	assert.ok(row);
	return row;
}

function local(url: unknown) {
	assert.equal(typeof url, 'string');
	const { pathname } = new URL(String(url));
	return `${harness.base}${pathname}`;
}

async function publicListening(id: string, client?: Client) {
	const path = `/public/get/user/id/${id}`;
	const response = client ? await client.request(path) : await fetch(`${harness.base}${path}`);
	return (await json(response)).listening;
}

test('the newest track start owns playback and stale reports cannot reclaim it', async () => {
	const first = await connected(alice.client);
	const secondClient = await session('alice');
	const second = await connected(secondClient);
	const friend = await connected(bob.client);

	const shown = next(friend, 'listening');
	assert.deepEqual(await first.emitWithAck('playbackStart', track('one', 'First')), { ok: true });
	const firstListening = await shown;
	assert.ok(isRecord(firstListening) && isRecord(firstListening.listening));
	assert.equal(firstListening.id, alice.id);
	assert.equal(field(firstListening.listening.current, 'title'), 'First');

	const handoff = next(first, 'playbackOwnership');
	assert.deepEqual(await second.emitWithAck('playbackStart', track('two', 'Second')), {
		ok: true
	});
	assert.deepEqual(await handoff, { playbackId: 'two' });
	const played = stored().playing;

	const stale = { ok: false, error: 'Playback is no longer current.' };
	assert.deepEqual(await first.emitWithAck('playbackUpdate', update('one', 50, false)), stale);
	assert.deepEqual(await first.emitWithAck('playbackUpdate', update('two', 50, false)), stale);
	assert.deepEqual(await first.emitWithAck('playbackStop', { playbackId: 'two' }), stale);
	const heartbeat = silent(friend, 'listening');
	assert.deepEqual(await second.emitWithAck('playbackUpdate', update('two', 0.5)), { ok: true });
	await heartbeat;
	assert.equal(stored().playing, played);

	const late = await uploadArt(alice, 'one', png);
	assert.equal(late.status, 409);
	assert.equal(stored().albumArt, null);
	assert.equal(stored().artwork_id, null);
	assert.equal((await uploadArt(alice, 'two', png)).status, 409);
	assert.equal((await uploadArt({ ...alice, client: secondClient }, 'two', png)).status, 200);
	const artwork = stored().artwork_id;
	assert.ok(typeof artwork === 'string');

	const listening = await publicListening(alice.id);
	assert.ok(isRecord(listening));
	assert.equal(field(listening.current, 'title'), 'Second');
	assert.equal(field(listening.current, 'artwork'), artwork);
	assert.equal(field(listening.lastPlayed, 'title'), 'Second');

	const ended = next(friend, 'listening');
	const gone = next(second, 'disconnect');
	second.disconnect();
	await gone;
	const cleared = await ended;
	assert.ok(isRecord(cleared) && isRecord(cleared.listening));
	assert.equal(cleared.listening.current, null);
	assert.equal(field(cleared.listening.lastPlayed, 'title'), 'Second');
	assert.deepEqual(await first.emitWithAck('playbackUpdate', update('two', 1)), stale);
});

test('invalid playback payloads are rejected without changing state', async () => {
	const socket = await connected(alice.client);
	for (const payload of [
		null,
		{ playbackId: 'bad id', title: 'x', artist: '', album: '', discord: false },
		{ ...track('ok', 'x'), duration: -5 },
		{ ...track('ok', 'x'), position: '1' },
		{ ...track('ok', 'x'), playbackRate: 0 },
		{ ...track('ok', 'x'), discord: 'yes' }
	]) {
		const reply = await socket.emitWithAck('playbackStart', payload);
		assert.equal(reply.ok, false);
	}
	assert.equal(field(await publicListening(alice.id), 'current'), null);
});

test('private listening is only visible to the owner over HTTP and sockets', async () => {
	const owner = await connected(alice.client);
	const friend = await connected(bob.client);
	assert.deepEqual(await owner.emitWithAck('playbackStart', track('three', 'Third')), {
		ok: true
	});
	assert.equal((await uploadArt(alice, 'three', gif)).status, 200);
	const art = `${harness.base}/public/get/albumArt/${alice.id}/${stored().artwork_id}`;
	assert.equal((await fetch(art)).headers.get('content-type'), 'image/gif');

	assert.equal((await setVisibility(alice, 'friends')).status, 400);
	const cleared = next(friend, 'listening');
	assert.equal((await setVisibility(alice, 'private')).status, 200);
	assert.deepEqual(await cleared, { id: alice.id, listening: null });

	assert.equal(await publicListening(alice.id), null);
	assert.equal(await publicListening(alice.id, bob.client), null);
	assert.equal(field(await publicListening(alice.id, alice.client), 'lastPlayed') !== null, true);
	const friends: unknown = await (await bob.client.request('/user/friends/me')).json();
	assert.deepEqual(friends, [{ id: alice.id, username: 'alice', name: null, listening: null }]);
	assert.equal((await fetch(art)).status, 404);
	assert.equal((await bob.client.request(art)).status, 404);
	assert.equal((await alice.client.request(art)).status, 200);
	const me = await json(await alice.client.request('/get/me'));
	assert.equal(me.listeningVisibility, 'private');
	assert.equal(field(field(me.listening, 'current'), 'title'), 'Third');

	const quiet = silent(friend, 'listening');
	const own = next(owner, 'listening');
	assert.deepEqual(await owner.emitWithAck('playbackUpdate', update('three', 90, false)), {
		ok: true
	});
	await quiet;
	assert.equal(field(field(await own, 'listening'), 'current') !== null, true);

	const shown = next(friend, 'listening');
	assert.equal((await setVisibility(alice, 'public')).status, 200);
	const visible = await shown;
	assert.equal(field(field(field(visible, 'listening'), 'current'), 'playing'), false);
	assert.deepEqual(await owner.emitWithAck('playbackStop', { playbackId: 'three' }), { ok: true });
});

test('signed artwork links are scoped, tamper-proof, expiring and revoked by new artwork', async () => {
	const owner = await connected(alice.client);
	assert.equal((await setVisibility(alice, 'private')).status, 200);
	assert.deepEqual(await owner.emitWithAck('playbackStart', track('four', 'Fourth', true)), {
		ok: true
	});
	const shared = next(owner, 'rpcUpdate');
	assert.equal((await uploadArt(alice, 'four', png)).status, 200);
	const link = local(field(await shared, 'largeImageKey'));

	const response = await fetch(link);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get('content-type'), 'image/png');
	assert.equal(response.headers.get('cache-control'), 'private, no-store');
	assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);

	const [, id, artworkId, expires, signature] = new URL(link).pathname.split('/').slice(2);
	const variants = [
		[bob.id, artworkId, expires, signature],
		[id, 'three', expires, signature],
		[id, artworkId, String(Number(expires) + 1), signature],
		[id, artworkId, expires, `${signature?.slice(0, -1)}${signature?.endsWith('A') ? 'B' : 'A'}`],
		[id, artworkId, `${expires}.0`, signature]
	];
	for (const parts of variants) {
		const tampered = `${harness.base}/public/artwork/${parts.join('/')}`;
		assert.equal((await fetch(tampered)).status, 404, parts.join('/'));
	}

	const links = createArtworkLinks(testEnv.BETTER_AUTH_SECRET, 'https://api.example.test');
	const now = Date.now();
	const old = new URL(links.url(alice.id, 'four', now - 2 * 60 * 60 * 1000));
	assert.equal((await fetch(local(old.href))).status, 404);
	const [, , , oldExpires, oldSignature] = old.pathname.split('/').slice(2);
	const fields = { id: alice.id, artworkId: 'four' };
	const verify = (expiry: number, sig: string | undefined, at: number) =>
		links.verify({ ...fields, expires: expiry, signature: sig ?? '' }, at);
	assert.equal(verify(Number(oldExpires), oldSignature, now - 2 * 60 * 60 * 1000), true);
	assert.equal(verify(Number(oldExpires), oldSignature, now), false);
	const fresh = new URL(links.url(alice.id, 'four', now)).pathname.split('/').slice(2);
	assert.equal(verify(Number(fresh[3]), fresh[4], now - 2 * 60 * 60 * 1000), false);
	const other = createArtworkLinks('another-secret-that-is-long-enough-for-tests', 'https://x');
	assert.equal((await fetch(local(other.url(alice.id, 'four')))).status, 404);

	assert.equal((await fetch(`${harness.base}/public/get/albumArt/${alice.id}/four`)).status, 404);
	const replaced = next(owner, 'rpcUpdate');
	assert.equal((await uploadArt(alice, 'four', gif)).status, 200);
	const replacement = local(field(await replaced, 'largeImageKey'));
	assert.notEqual(replacement, link);
	assert.equal((await fetch(link)).status, 404);
	assert.equal((await fetch(replacement)).status, 200);
	assert.deepEqual(await owner.emitWithAck('playbackUpdate', update('four', 1)), { ok: true });
	assert.equal((await fetch(replacement)).status, 404);
	const reenabled = next(owner, 'rpcUpdate');
	assert.deepEqual(
		await owner.emitWithAck('playbackUpdate', { ...update('four', 2), discord: true }),
		{ ok: true }
	);
	const newLink = local(field(await reenabled, 'largeImageKey'));
	assert.notEqual(newLink, replacement);
	assert.equal((await fetch(replacement)).status, 404);
	assert.equal((await fetch(newLink)).status, 200);
	assert.deepEqual(await owner.emitWithAck('playbackStop', { playbackId: 'four' }), { ok: true });
	assert.equal((await fetch(newLink)).status, 404);
	assert.deepEqual(await owner.emitWithAck('playbackStart', track('five', 'Fifth', true)), {
		ok: true
	});
	assert.equal((await fetch(link)).status, 404);
	assert.equal((await setVisibility(alice, 'public')).status, 200);
	assert.deepEqual(await owner.emitWithAck('playbackStop', { playbackId: 'five' }), { ok: true });
});

test('expired, revoked and deleted sessions stop stale sockets', async () => {
	const expiring = await session('alice');
	const socket = await connected(expiring);
	assert.deepEqual(await socket.emitWithAck('playbackStart', track('six', 'Sixth')), { ok: true });
	const sessionId = harness.db.all(
		'SELECT id FROM auth_session WHERE "userId" = ? ORDER BY "createdAt" DESC',
		[alice.id]
	)[0]?.id;
	harness.db.run('UPDATE auth_session SET "expiresAt" = ? WHERE id = ?', [
		new Date(Date.now() - 1000).toISOString(),
		String(sessionId)
	]);
	const gone = next(socket, 'disconnect');
	socket.emit('playbackUpdate', update('six', 3, false));
	assert.equal(await gone, 'io server disconnect');
	assert.equal(field(await publicListening(alice.id), 'current'), null);

	const revoked = await session('bob');
	const revokedSocket = await connected(revoked);
	assert.deepEqual(await revokedSocket.emitWithAck('playbackStart', track('seven', 'Seventh')), {
		ok: true
	});
	const revokedGone = next(revokedSocket, 'disconnect');
	assert.equal((await revoked.post('/api/auth/sign-out')).status, 200);
	assert.equal(await revokedGone, 'io server disconnect');
	assert.equal(field(await publicListening(bob.id), 'current'), null);

	const leaver = await verifiedAccount(harness, 'leaver', 'leaver@example.test');
	await bob.client.request(`/user/friends/me/requests/${leaver.id}`, { method: 'POST' });
	await leaver.client.request(`/user/friends/me/requests/${bob.id}/accept`, { method: 'POST' });
	const friend = await connected(bob.client);
	const leaving = await connected(leaver.client);
	assert.deepEqual(await leaving.emitWithAck('playbackStart', track('leaving', 'Leaving')), {
		ok: true
	});
	const removed = next(friend, 'friendRemoved');
	const leavingGone = next(leaving, 'disconnect');
	assert.equal((await leaver.client.request('/user/manage/me', { method: 'DELETE' })).status, 200);
	assert.equal(await leavingGone, 'io server disconnect');
	assert.deepEqual(await removed, { id: leaver.id });
});

test('a playback lease expires without reviving the previous device', async (context) => {
	const owner = await connected(alice.client);
	const friend = await connected(bob.client);
	context.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
	try {
		const started = next(friend, 'listening');
		assert.deepEqual(await owner.emitWithAck('playbackStart', track('leased', 'Leased')), {
			ok: true
		});
		await started;
		const ended = next(friend, 'listening');
		context.mock.timers.tick(90001);
		const cleared = field(await ended, 'listening');
		assert.equal(field(cleared, 'current'), null);
		assert.equal(field(field(cleared, 'lastPlayed'), 'title'), 'Leased');
		assert.equal(field(await publicListening(alice.id), 'current'), null);
		assert.equal((await owner.emitWithAck('playbackUpdate', update('leased', 1))).ok, false);
	} finally {
		context.mock.timers.reset();
	}
});

test('artwork links refresh during long playback without writing heartbeat data', async (context) => {
	const owner = await connected(alice.client);
	context.mock.timers.enable({ apis: ['Date'] });
	try {
		assert.deepEqual(
			await owner.emitWithAck('playbackStart', { ...track('long', 'Long', true), duration: null }),
			{ ok: true }
		);
		const uploaded = next(owner, 'rpcUpdate');
		assert.equal((await uploadArt(alice, 'long', png)).status, 200);
		const original = field(await uploaded, 'largeImageKey');
		const played = stored().playing;
		context.mock.timers.setTime(Date.now() + 30 * 60 * 1000);
		const refreshed = next(owner, 'rpcUpdate');
		assert.deepEqual(
			await owner.emitWithAck('playbackUpdate', { ...update('long', 1800), discord: true }),
			{ ok: true }
		);
		const replacement = field(await refreshed, 'largeImageKey');
		assert.notEqual(replacement, original);
		assert.equal((await fetch(local(replacement))).status, 200);
		assert.equal(stored().playing, played);
		assert.deepEqual(await owner.emitWithAck('playbackStop', { playbackId: 'long' }), { ok: true });
	} finally {
		context.mock.timers.reset();
	}
});

test('an idle socket disconnects when its session expires', async () => {
	const account = await verifiedAccount(harness, 'idle', 'idle@example.test');
	harness.db.run('UPDATE auth_session SET "expiresAt" = ? WHERE "userId" = ?', [
		new Date(Date.now() + 1000).toISOString(),
		account.id
	]);
	const socket = await connected(account.client);
	assert.equal(await next(socket, 'disconnect'), 'io server disconnect');
});

test('restarting the server keeps last played but never resurrects live playback', async () => {
	const restarted = await startMaple(undefined, (db) => {
		db.run("INSERT INTO users (id, username) VALUES ('legacy', 'legacy')");
		db.run('INSERT INTO live_status (user_id, playing, albumArt) VALUES (?, ?, ?)', [
			'legacy',
			JSON.stringify({ title: 'Old', artist: 'Band', album: 'LP', timePlayed: '2020-01-01' }),
			png
		]);
	});
	try {
		const response = await fetch(`${restarted.base}/public/get/user/id/legacy`);
		assert.deepEqual((await json(response)).listening, {
			current: null,
			lastPlayed: {
				title: 'Old',
				artist: 'Band',
				album: 'LP',
				duration: null,
				playedAt: '2020-01-01',
				artwork: null
			}
		});
		const art = await fetch(`${restarted.base}/public/get/albumArt/legacy/1`);
		assert.equal(art.headers.get('content-type'), 'image/png');
	} finally {
		await restarted.close();
	}
});
