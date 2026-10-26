import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecord } from '../types/record.js';
import { json, next, startMaple, verifiedAccount, type Client, type Harness } from './harness.js';

interface Account {
	client: Client;
	id: string;
}

let harness: Harness;
let alice: Account;
let bob: Account;
let carol: Account;

before(async () => {
	harness = await startMaple();
	alice = await verifiedAccount(harness, 'alice', 'alice@example.test');
	bob = await verifiedAccount(harness, 'bob', 'bob@example.test');
	carol = await verifiedAccount(harness, 'carol', 'carol@example.test');
});

after(async () => {
	await harness?.close();
});

function send(account: Account, path: string, method = 'POST') {
	return account.client.request(path, { method });
}

async function list(account: Account, path: string) {
	const response = await account.client.request(path);
	assert.equal(response.status, 200);
	const body: unknown = await response.json();
	return body;
}

function count(table: string) {
	return harness.db.all(`SELECT 1 FROM ${table}`).length;
}

test('friend requests run in the right direction and notify after commit', async () => {
	const untrusted = await alice.client.request(`/user/friends/me/requests/${bob.id}`, {
		method: 'POST',
		headers: { origin: 'https://untrusted.example' }
	});
	assert.equal(untrusted.status, 403);
	assert.equal(count('pending_requests'), 0);
	const missing = await send(alice, '/user/friends/me/requests/nobody');
	assert.equal(missing.status, 404);
	const self = await send(alice, `/user/friends/me/requests/${alice.id.toUpperCase()}`);
	assert.equal(self.status, 400);

	const bobSocket = bob.client.socket();
	const aliceSocket = alice.client.socket();
	await Promise.all([next(bobSocket, 'connect'), next(aliceSocket, 'connect')]);

	const notified = next(bobSocket, 'friendRequest');
	assert.equal((await send(alice, `/user/friends/me/requests/${bob.id}`)).status, 200);
	assert.deepEqual(await notified, { id: alice.id });
	assert.equal((await send(alice, `/user/friends/me/requests/${bob.id}`)).status, 409);
	const reverse = await send(bob, `/user/friends/me/requests/${alice.id}`);
	assert.equal(reverse.status, 409);
	assert.equal((await json(reverse)).error, 'This user already sent you a friend request.');
	assert.equal((await send(alice, `/user/friends/me/requests/${bob.id}/accept`)).status, 404);

	const aliceProfile = { id: alice.id, username: 'alice', name: null };
	const bobProfile = { id: bob.id, username: 'bob', name: null };
	assert.deepEqual(await list(bob, '/user/friends/me/requests'), {
		incoming: [aliceProfile],
		outgoing: []
	});
	assert.deepEqual(await list(alice, '/user/friends/me/requests'), {
		incoming: [],
		outgoing: [bobProfile]
	});

	const accepted = next(aliceSocket, 'requestAccepted');
	const acceptedRequest = next(bobSocket, 'acceptedRequest');
	assert.equal((await send(bob, `/user/friends/me/requests/${alice.id}/accept`)).status, 200);
	const message = 'Friend request accepted!';
	assert.deepEqual(await accepted, { id: bob.id, message });
	assert.deepEqual(await acceptedRequest, { id: alice.id, message });

	assert.equal((await send(bob, `/user/friends/me/requests/${alice.id}/accept`)).status, 409);
	assert.deepEqual(await list(alice, '/user/friends/me'), [
		{ ...bobProfile, listening: { current: null, lastPlayed: null } }
	]);
	assert.deepEqual(await list(bob, '/user/friends/me'), [
		{ ...aliceProfile, listening: { current: null, lastPlayed: null } }
	]);
	assert.deepEqual(await list(bob, '/user/friends/me/requests'), { incoming: [], outgoing: [] });

	const bobRemoved = next(bobSocket, 'friendRemoved');
	const aliceRemoved = next(aliceSocket, 'friendRemoved');
	assert.equal((await send(alice, `/user/friends/me/${bob.id}`, 'DELETE')).status, 200);
	assert.deepEqual(await bobRemoved, { id: alice.id });
	assert.deepEqual(await aliceRemoved, { id: bob.id });
	bobSocket.close();
	aliceSocket.close();
	assert.equal((await send(alice, `/user/friends/me/${bob.id}`, 'DELETE')).status, 404);
	assert.deepEqual(await list(bob, '/user/friends/me'), []);
});

test('requests can be declined by the receiver or cancelled by the sender', async () => {
	assert.equal((await send(alice, `/user/friends/me/requests/${carol.id}`)).status, 200);
	assert.equal((await send(carol, `/user/friends/me/requests/${alice.id}`, 'DELETE')).status, 200);
	assert.equal((await send(carol, `/user/friends/me/requests/${alice.id}`, 'DELETE')).status, 404);

	assert.equal((await send(alice, `/user/friends/me/requests/${carol.id}`)).status, 200);
	assert.equal((await send(alice, `/user/friends/me/requests/${carol.id}`, 'DELETE')).status, 200);
	assert.deepEqual(await list(carol, '/user/friends/me/requests'), { incoming: [], outgoing: [] });
});

test('legacy duplicate relationship rows are listed once and left in place', async () => {
	for (let copy = 0; copy < 2; copy++) {
		harness.db.run('INSERT INTO friends_db (user_id, friend_id) VALUES (?, ?)', [bob.id, carol.id]);
	}
	harness.db.run('INSERT INTO friends_db (user_id, friend_id) VALUES (?, ?)', [carol.id, bob.id]);
	harness.db.run('INSERT INTO pending_requests (user_id, friend_id) VALUES (?, ?)', [
		bob.id,
		carol.id
	]);
	const friends = count('friends_db');
	const requests = count('pending_requests');

	const listed = await list(carol, '/user/friends/me');
	assert.ok(Array.isArray(listed));
	assert.deepEqual(
		listed.map((friend: unknown) => isRecord(friend) && friend.id),
		[bob.id]
	);
	assert.equal((await send(carol, `/user/friends/me/requests/${bob.id}/accept`)).status, 409);
	assert.equal(count('friends_db'), friends);
	assert.equal(count('pending_requests'), requests);
});

test('profiles are read and updated through the session account only', async () => {
	const invalidJson = await alice.client.request('/user/manage/me', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: '{'
	});
	assert.equal(invalidJson.status, 400);
	assert.equal((await json(invalidJson)).error, 'Invalid JSON body');
	const largeJson = await alice.client.request('/user/manage/me', {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ displayName: 'x'.repeat(110 * 1024) })
	});
	assert.equal(largeJson.status, 413);
	const rename = (displayName: unknown) =>
		alice.client.request('/user/manage/me', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ displayName })
		});
	assert.equal((await rename('   ')).status, 400);
	assert.equal((await rename('x'.repeat(65))).status, 400);
	assert.equal((await rename(' Alice ')).status, 200);
	assert.deepEqual(await json(await alice.client.request('/get/me')), {
		id: alice.id,
		username: 'alice',
		name: 'Alice',
		pfp: null,
		listeningVisibility: 'public',
		listening: { current: null, lastPlayed: null }
	});
	const found = await fetch(`${harness.base}/public/get/user/ALICE`);
	assert.deepEqual(await json(found), { id: alice.id, username: 'alice', name: 'Alice' });

	const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(4, 1)]);
	const upload = (type: string, image: Buffer) => {
		const form = new FormData();
		form.append('pfp', new Blob([image], { type }), 'pfp');
		return alice.client.request('/user/manage/me/pfp', { method: 'PUT', body: form });
	};
	assert.equal((await upload('text/plain', gif)).status, 400);
	assert.equal((await upload('image/png', Buffer.alloc(10, 1))).status, 400);
	const tooLarge = await upload('image/png', Buffer.alloc(3 * 1024 * 1024 + 1, 1));
	assert.equal(tooLarge.status, 413);
	assert.equal((await json(tooLarge)).error, 'File size exceeds 3MB limit.');
	assert.equal((await upload('image/png', gif)).status, 200);
	const pfp = await fetch(`${harness.base}/public/get/pfp/${alice.id}`);
	assert.equal(pfp.headers.get('content-type'), 'image/gif');
	assert.deepEqual(Buffer.from(await pfp.arrayBuffer()), gif);
});

test('deleting an account removes its relationships', async () => {
	assert.equal((await send(carol, `/user/friends/me/requests/${alice.id}`)).status, 200);
	assert.equal((await carol.client.request('/user/manage/me', { method: 'DELETE' })).status, 200);
	for (const table of ['friends_db', 'pending_requests']) {
		const rows = `SELECT 1 FROM ${table} WHERE user_id = ? OR friend_id = ?`;
		assert.equal(harness.db.all(rows, [carol.id, carol.id]).length, 0);
	}
	assert.deepEqual(await list(bob, '/user/friends/me'), []);
	assert.deepEqual(await list(alice, '/user/friends/me/requests'), { incoming: [], outgoing: [] });
});
