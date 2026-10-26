import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getMigrations } from 'better-auth/db/migration';
import {
	Client,
	json,
	next,
	startMaple,
	strongPassword,
	verifiedAccount,
	type Harness
} from './harness.js';

let harness: Harness;

before(async () => {
	harness = await startMaple((config) => ({ ...config, rateLimit: false }));
});

after(async () => {
	await harness?.close();
});

function legacyAccount(
	username: string,
	password: string,
	extra: { pfp?: Buffer; name?: string } = {}
) {
	const id = randomUUID();
	harness.db.run(
		'INSERT INTO users (id, username, password, pfp, name, creation_date, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[
			id,
			username,
			bcrypt.hashSync(password, 4),
			extra.pfp ?? null,
			extra.name ?? null,
			'2024-02-03 04:05:06',
			'2025-01-01 00:00:00'
		]
	);
	return id;
}

function enroll(client: Client, body: Record<string, unknown>) {
	return client.post('/api/auth/legacy/enroll', body);
}

function profile(id: string) {
	return harness.db.all('SELECT * FROM users WHERE id = ?', [id])[0];
}

function authUser(id: string) {
	return harness.db.all('SELECT * FROM auth_user WHERE id = ?', [id])[0];
}

function credentials(id: string) {
	return harness.db.all(
		"SELECT password FROM auth_account WHERE userId = ? AND providerId = 'credential'",
		[id]
	);
}

function oldJwt(id: string) {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id, exp: 9999999999 })}`;
	const signature = createHmac('sha256', 'legacy-token-secret')
		.update(unsigned)
		.digest('base64url');
	return `${unsigned}.${signature}`;
}

async function enrollDuring(
	client: Client,
	body: Record<string, unknown>,
	change: () => Promise<void>
) {
	const context = await harness.maple.auth.$context;
	const findUserByEmail = context.internalAdapter.findUserByEmail;
	let release = () => {};
	let arrived = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const ready = new Promise<void>((resolve) => {
		arrived = resolve;
	});
	context.internalAdapter.findUserByEmail = async (...args) => {
		const user = await findUserByEmail(...args);
		if (args[0] === body.email) {
			arrived();
			await gate;
		}
		return user;
	};
	try {
		const response = enroll(client, body);
		await ready;
		await change();
		release();
		return await response;
	} finally {
		release();
		context.internalAdapter.findUserByEmail = findUserByEmail;
	}
}

test('auth schema matches Better Auth with no pending migrations', async () => {
	const migrations = await getMigrations(harness.maple.auth.options);
	assert.deepEqual(migrations.toBeCreated, []);
	assert.deepEqual(migrations.toBeAdded, []);
	const context = await harness.maple.auth.$context;
	assert.equal(context.adapter.options?.adapterConfig.transaction, false);
});

test('signup requires email verification before any usable session', async () => {
	const client = harness.client();
	const email = 'new@example.test';
	const signup = await client.post('/api/auth/sign-up/email', {
		username: 'NewUser',
		email,
		password: strongPassword
	});
	assert.equal(signup.status, 200);
	assert.equal(client.cookie, '');
	const row = harness.db.all('SELECT * FROM users WHERE username = ?', ['newuser'])[0];
	assert.ok(row && typeof row.id === 'string');
	assert.equal(row.username, 'NewUser');
	assert.equal(row.password, null);

	const signIn = await client.post('/api/auth/sign-in/email', { email, password: strongPassword });
	assert.equal(signIn.status, 403);
	assert.equal((await json(signIn)).code, 'EMAIL_NOT_VERIFIED');
	assert.equal(client.cookie, '');
	assert.equal((await client.request('/get/me')).status, 401);

	const verified = await client.request(harness.mailbox.link(email));
	assert.equal(verified.status, 302);
	assert.deepEqual(await json(await client.request('/get/me')), {
		username: 'NewUser',
		id: row.id,
		name: null,
		pfp: null,
		listeningVisibility: 'public',
		listening: { current: null, lastPlayed: null }
	});

	const other = harness.client();
	const byName = await other.post('/api/auth/sign-in/username', {
		username: 'NEWUSER',
		password: strongPassword
	});
	assert.equal(byName.status, 200);
	assert.equal((await other.request('/get/me')).status, 200);
});

test('signup enforces username and password policy and reserved names', async () => {
	legacyAccount('Dormant', 'old');
	const client = harness.client();
	const attempt = (
		username: unknown,
		password = strongPassword,
		email = `${randomUUID()}@example.test`
	) => client.post('/api/auth/sign-up/email', { username, email, password });
	for (const password of ['short1A', 'alllowercase', 'ALLUPPERCASE', `Aa${'x'.repeat(127)}`]) {
		const response = await attempt('PolicyUser', password);
		assert.equal(response.status, 400, password);
		assert.equal((await json(response)).code, 'PASSWORD_POLICY');
	}
	for (const username of [undefined, 'x', 'has space', 'émile', 'a'.repeat(33)]) {
		const response = await attempt(username);
		assert.equal(response.status, 400, String(username));
		assert.equal((await json(response)).code, 'INVALID_USERNAME');
	}
	for (const username of ['Dormant', 'dORMANT', 'NewUser']) {
		const response = await attempt(username);
		assert.equal(response.status, 400, username);
		assert.equal((await json(response)).code, 'USERNAME_IS_ALREADY_TAKEN');
	}
	assert.equal(harness.db.all('SELECT 1 FROM users WHERE username = ?', ['dormant']).length, 1);
	assert.equal((await attempt('Policy.User-1_ok', 'Password')).status, 200);

	const racers = await Promise.all([attempt('Racer'), attempt('rAcEr')]);
	assert.equal(racers.filter((response) => response.status === 200).length, 1);
	assert.equal(harness.db.all('SELECT 1 FROM users WHERE username = ?', ['RACER']).length, 1);
	assert.equal(harness.db.all('SELECT 1 FROM auth_user WHERE username = ?', ['racer']).length, 1);
});

test('legacy enrollment keeps IDs, profile data, relationships and old weak passwords', async () => {
	const pfp = Buffer.from([0, 255, 7]);
	const id = legacyAccount('OldTimer', 'weak', { pfp, name: 'Old Timer' });
	const friend = legacyAccount('OldFriend', 'other');
	harness.db.run('INSERT INTO friends_db (user_id, friend_id) VALUES (?, ?)', [id, friend]);
	harness.db.run('INSERT INTO live_status (user_id, playing) VALUES (?, ?)', [id, '{"title":"x"}']);
	const before = profile(id);
	const client = harness.client();
	const email = 'oldtimer@example.test';

	const blocked = await client.post('/api/auth/sign-in/username', {
		username: 'oldtimer',
		password: 'weak'
	});
	assert.equal(blocked.status, 403);
	assert.equal((await json(blocked)).code, 'LEGACY_ENROLLMENT_REQUIRED');
	const wrong = await enroll(client, { username: 'OldTimer', password: 'nope', email });
	assert.equal(wrong.status, 401);
	const unknown = await enroll(client, { username: 'Nobody', password: 'weak', email });
	assert.equal(unknown.status, 401);
	const badEmail = await enroll(client, {
		username: 'OldTimer',
		password: 'weak',
		email: 'not-an-email'
	});
	assert.equal(badEmail.status, 400);
	assert.equal(authUser(id), undefined);

	const enrolled = await enroll(client, { username: 'oldtimer', password: 'weak', email });
	assert.equal(enrolled.status, 200);
	assert.equal(client.cookie, '');
	const claimed = authUser(id);
	assert.ok(claimed);
	assert.equal(claimed.username, 'oldtimer');
	assert.equal(claimed.displayUsername, 'OldTimer');
	assert.equal(claimed.emailVerified, 0);
	assert.deepEqual({ ...profile(id), password: undefined }, { ...before, password: undefined });
	assert.equal(profile(id)?.password, null);
	assert.equal(credentials(id)[0]?.password, before?.password);
	assert.equal(
		harness.db.all('SELECT 1 FROM friends_db WHERE user_id = ? AND friend_id = ?', [id, friend])
			.length,
		1
	);

	const early = await client.post('/api/auth/sign-in/username', {
		username: 'OldTimer',
		password: 'weak'
	});
	assert.equal(early.status, 403);
	assert.equal((await json(early)).code, 'EMAIL_NOT_VERIFIED');
	await client.request(harness.mailbox.link(email));
	assert.notEqual(profile(id)?.last_login, before?.last_login);
	assert.deepEqual(await json(await client.request('/get/me')), {
		username: 'OldTimer',
		id,
		name: 'Old Timer',
		pfp: pfp.toString('base64'),
		listeningVisibility: 'public',
		listening: { current: null, lastPlayed: null }
	});

	const again = harness.client();
	const signIn = await again.post('/api/auth/sign-in/username', {
		username: 'OLDTIMER',
		password: 'weak'
	});
	assert.equal(signIn.status, 200);
	const replay = await enroll(again, {
		username: 'OldTimer',
		password: 'weak',
		email: 'x@example.test'
	});
	assert.equal(replay.status, 409);
	assert.equal((await json(replay)).code, 'ALREADY_ENROLLED');
	assert.equal(authUser(id)?.email, email);
});

test('invalid legacy usernames are explicitly replaced without losing the account', async () => {
	const id = legacyAccount('has space', 'pw');
	legacyAccount('Taken', 'pw');
	const client = harness.client();
	const email = 'spaced@example.test';
	const body = { username: 'has space', password: 'pw', email };
	const missing = await enroll(client, body);
	assert.equal(missing.status, 400);
	assert.equal((await json(missing)).code, 'USERNAME_REPLACEMENT_REQUIRED');
	const invalid = await enroll(client, { ...body, newUsername: 'still bad' });
	assert.equal((await json(invalid)).code, 'INVALID_USERNAME');
	const taken = await enroll(client, { ...body, newUsername: 'TAKEN' });
	assert.equal(taken.status, 409);
	assert.equal((await json(taken)).code, 'USERNAME_TAKEN');
	assert.equal(profile(id)?.username, 'has space');

	assert.equal((await enroll(client, { ...body, newUsername: 'Spaced' })).status, 200);
	assert.equal(profile(id)?.username, 'Spaced');
	assert.equal(authUser(id)?.displayUsername, 'Spaced');
	await client.request(harness.mailbox.link(email));
	const signIn = await harness.client().post('/api/auth/sign-in/username', {
		username: 'spaced',
		password: 'pw'
	});
	assert.equal(signIn.status, 200);
	const signup = await harness.client().post('/api/auth/sign-up/email', {
		username: 'has.space',
		email: 'other@example.test',
		password: strongPassword
	});
	assert.equal(signup.status, 200);
});

test('existing valid long usernames are claimed without being forced to rename', async () => {
	const username = 'LongExistingName'.repeat(4);
	const id = randomUUID();
	const legacy = await startMaple(
		(config) => ({ ...config, rateLimit: false }),
		(db) =>
			db.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [
				id,
				username,
				bcrypt.hashSync('old', 4)
			])
	);
	try {
		const client = legacy.client();
		const response = await enroll(client, {
			username,
			password: 'old',
			email: 'longlegacy@example.test'
		});
		assert.equal(response.status, 200);
		await client.request(legacy.mailbox.link('longlegacy@example.test'));
		const login = await legacy
			.client()
			.post('/api/auth/sign-in/username', { username, password: 'old' });
		assert.equal(login.status, 200);
		assert.equal(
			legacy.db.all('SELECT username FROM users WHERE id = ?', [id])[0]?.username,
			username
		);
	} finally {
		await legacy.close();
	}
});

test('legacy enrollment rolls back the identity if importing its credential fails', async () => {
	const id = legacyAccount('atomic legacy', 'old');
	const before = profile(id);
	harness.db.connection.exec(
		"CREATE TRIGGER test_reject_credential BEFORE INSERT ON auth_account BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;"
	);
	try {
		const response = await enroll(harness.client(), {
			username: 'atomic legacy',
			password: 'old',
			email: 'atomic@example.test',
			newUsername: 'AtomicLegacy'
		});
		assert.equal(response.status, 500);
		assert.equal(authUser(id), undefined);
		assert.deepEqual(profile(id), before);
		assert.equal(credentials(id).length, 0);
	} finally {
		harness.db.connection.exec('DROP TRIGGER test_reject_credential');
	}
});

test(
	'a legacy retry cannot change an email after verification completes',
	{ timeout: 10000 },
	async () => {
		const id = legacyAccount('VerifyRace', 'old');
		const client = harness.client();
		assert.equal(
			(
				await enroll(client, {
					username: 'VerifyRace',
					password: 'old',
					email: 'verifyrace@example.test'
				})
			).status,
			200
		);
		const response = await enrollDuring(
			harness.client(),
			{
				username: 'VerifyRace',
				password: 'old',
				email: 'unverifiedrace@example.test'
			},
			async () => {
				assert.equal(
					(await client.request(harness.mailbox.link('verifyrace@example.test'))).status,
					302
				);
			}
		);
		assert.equal(response.status, 409);
		assert.equal(authUser(id)?.email, 'verifyrace@example.test');
		assert.equal(authUser(id)?.emailVerified, 1);
	}
);

test(
	'a legacy retry cannot reuse proof after a concurrent password reset',
	{ timeout: 10000 },
	async () => {
		const id = legacyAccount('ResetRace', 'old');
		assert.equal(
			(
				await enroll(harness.client(), {
					username: 'ResetRace',
					password: 'old',
					email: 'resetrace@example.test'
				})
			).status,
			200
		);
		const response = await enrollDuring(
			harness.client(),
			{
				username: 'ResetRace',
				password: 'old',
				email: 'resetrace-other@example.test'
			},
			async () => {
				const client = harness.client();
				assert.equal(
					(
						await client.post('/api/auth/request-password-reset', {
							email: 'resetrace@example.test'
						})
					).status,
					200
				);
				const token = harness.mailbox.link('resetrace@example.test').pathname.split('/').pop();
				assert.equal(
					(
						await client.post('/api/auth/reset-password', {
							token,
							newPassword: 'ResetRacedPassword'
						})
					).status,
					200
				);
			}
		);
		assert.equal(response.status, 409);
		assert.equal(authUser(id)?.email, 'resetrace@example.test');
		assert.equal(authUser(id)?.emailVerified, 0);
		assert.equal(profile(id)?.password, null);
	}
);

test('default verification and recovery redirects return to the frontend', async () => {
	const { client } = await verifiedAccount(harness, 'Redirects', 'redirects@example.test');
	assert.equal(
		harness.mailbox.link('redirects@example.test').searchParams.get('callbackURL'),
		'https://play.maple.music'
	);
	await client.post('/api/auth/request-password-reset', { email: 'redirects@example.test' });
	assert.equal(
		harness.mailbox.link('redirects@example.test').searchParams.get('callbackURL'),
		'https://play.maple.music/reset-password'
	);
});

test('auth rate limiting ignores caller-supplied client IP headers', async () => {
	const limited = await startMaple();
	try {
		const client = limited.client();
		const statuses = [];
		for (let index = 0; index < 4; index++) {
			const response = await client.request('/api/auth/sign-in/email', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-forwarded-for': `203.0.113.${index + 1}`,
					'x-maple-client-ip': `203.0.113.${index + 1}`
				},
				body: JSON.stringify({ email: 'absent@example.test', password: 'WrongPassword' })
			});
			statuses.push(response.status);
		}
		assert.deepEqual(statuses, [401, 401, 401, 429]);
	} finally {
		await limited.close();
	}
});

test('auth rate limiting honors IPs resolved through explicitly trusted proxies', async () => {
	const proxied = await startMaple((config) => ({ ...config, trustedProxies: ['loopback'] }));
	try {
		const client = proxied.client();
		for (let index = 0; index < 4; index++) {
			const response = await client.request('/api/auth/sign-in/email', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-forwarded-for': `198.51.100.${index + 1}`,
					'x-maple-client-ip': '203.0.113.1'
				},
				body: JSON.stringify({ email: 'absent@example.test', password: 'WrongPassword' })
			});
			assert.equal(response.status, 401);
		}
	} finally {
		await proxied.close();
	}
});

test('concurrent and retried enrollment converges without stranding the account', async () => {
	const id = legacyAccount('Retry', 'pw');
	const client = harness.client();
	harness.mailbox.failing = true;
	const failed = await enroll(client, {
		username: 'Retry',
		password: 'pw',
		email: 'typo@example.test'
	});
	assert.equal(failed.status, 503);
	assert.equal((await json(failed)).code, 'EMAIL_DELIVERY_FAILED');
	assert.equal(authUser(id)?.email, 'typo@example.test');
	harness.mailbox.failing = false;

	const results = await Promise.all([
		enroll(client, { username: 'Retry', password: 'pw', email: 'typo@example.test' }),
		enroll(client, { username: 'Retry', password: 'pw', email: 'typo@example.test' })
	]);
	assert.ok(results.some((response) => response.status === 200));
	assert.equal(credentials(id).length, 1);
	const stale = harness.mailbox.link('typo@example.test');

	const fixed = await enroll(client, {
		username: 'Retry',
		password: 'pw',
		email: 'right@example.test'
	});
	assert.equal(fixed.status, 200);
	assert.equal(authUser(id)?.email, 'right@example.test');
	assert.equal(
		(await harness.client().request(stale)).headers.get('location')?.includes('error'),
		true
	);
	assert.equal(authUser(id)?.emailVerified, 0);

	const resend = await client.post('/api/auth/send-verification-email', {
		email: 'right@example.test'
	});
	assert.equal(resend.status, 200);
	await client.request(harness.mailbox.link('right@example.test'));
	assert.equal(authUser(id)?.emailVerified, 1);
	assert.equal(harness.db.all('SELECT 1 FROM auth_user WHERE id = ?', [id]).length, 1);

	const raced = legacyAccount('Raced', 'pw');
	const both = await Promise.all([
		enroll(harness.client(), { username: 'Raced', password: 'pw', email: 'raced1@example.test' }),
		enroll(harness.client(), { username: 'Raced', password: 'pw', email: 'raced2@example.test' })
	]);
	assert.ok(both.some((response) => response.status === 200));
	assert.ok(both.every((response) => response.status === 200 || response.status === 409));
	assert.equal(credentials(raced).length, 1);
	assert.equal(profile(raced)?.password, null);
});

test('old legacy hashes cannot be replayed after the password changes', async () => {
	const id = legacyAccount('Replay', 'oldpw');
	const client = harness.client();
	await enroll(client, { username: 'Replay', password: 'oldpw', email: 'replay@example.test' });
	await client.request(harness.mailbox.link('replay@example.test'));
	const changed = await client.post('/api/auth/change-password', {
		currentPassword: 'oldpw',
		newPassword: strongPassword
	});
	assert.equal(changed.status, 200);
	const replay = await enroll(harness.client(), {
		username: 'Replay',
		password: 'oldpw',
		email: 'attacker@example.test'
	});
	assert.equal(replay.status, 401);
	assert.equal(authUser(id)?.email, 'replay@example.test');
	const old = await harness.client().post('/api/auth/sign-in/username', {
		username: 'Replay',
		password: 'oldpw'
	});
	assert.equal(old.status, 401);
});

test('password policy applies to reset, change and set-password', async () => {
	const email = 'policy@example.test';
	const { client } = await verifiedAccount(harness, 'PolicyReset', email);
	const weak = await client.post('/api/auth/change-password', {
		currentPassword: strongPassword,
		newPassword: 'weakpassword'
	});
	assert.equal(weak.status, 400);
	assert.equal((await json(weak)).code, 'PASSWORD_POLICY');
	const changed = await client.post('/api/auth/change-password', {
		currentPassword: strongPassword,
		newPassword: 'ChangedPassword'
	});
	assert.equal(changed.status, 200);

	await assert.rejects(
		harness.maple.auth.api.setPassword({
			body: { newPassword: 'weak' },
			headers: new Headers({ cookie: client.cookie })
		}),
		(error: unknown) =>
			error instanceof Error &&
			'body' in error &&
			JSON.stringify(error.body).includes('PASSWORD_POLICY')
	);

	const requested = await harness.client().post('/api/auth/request-password-reset', {
		email,
		redirectTo: 'https://play.maple.music/reset'
	});
	assert.equal(requested.status, 200);
	const token = harness.mailbox.link(email).pathname.split('/').pop();
	const rejected = await harness.client().post('/api/auth/reset-password', {
		token,
		newPassword: 'nouppercase'
	});
	assert.equal(rejected.status, 400);
	assert.equal((await json(rejected)).code, 'PASSWORD_POLICY');
	const reset = await harness.client().post('/api/auth/reset-password', {
		token,
		newPassword: 'ResetPassword'
	});
	assert.equal(reset.status, 200);
	assert.equal((await client.request('/api/auth/get-session')).status, 200);
	assert.equal(await (await client.request('/api/auth/get-session')).text(), 'null');
	const signIn = await harness.client().post('/api/auth/sign-in/email', {
		email,
		password: 'ResetPassword'
	});
	assert.equal(signIn.status, 200);
});

test('email changes take effect only after verifying the new address', async () => {
	const { client, id } = await verifiedAccount(harness, 'Mover', 'mover@example.test');
	const response = await client.post('/api/auth/change-email', {
		newEmail: 'moved@example.test',
		callbackURL: '/'
	});
	assert.equal(response.status, 200);
	assert.equal(authUser(id)?.email, 'mover@example.test');
	await client.request(harness.mailbox.link('moved@example.test'));
	assert.equal(authUser(id)?.email, 'moved@example.test');
	assert.equal(authUser(id)?.emailVerified, 1);
});

test('logout ends only its session, revocation ends all and old JWT cookies are rejected', async () => {
	const { client: first, id } = await verifiedAccount(harness, 'Sessions', 'sessions@example.test');
	const second = harness.client();
	await second.post('/api/auth/sign-in/username', {
		username: 'sessions',
		password: strongPassword
	});
	const firstSocket = first.socket();
	const secondSocket = second.socket();
	await Promise.all([next(firstSocket, 'connect'), next(secondSocket, 'connect')]);

	const firstGone = next(firstSocket, 'disconnect');
	assert.equal((await first.post('/api/auth/sign-out')).status, 200);
	assert.equal(await firstGone, 'io server disconnect');
	assert.equal(secondSocket.connected, true);
	assert.equal((await first.request('/get/me')).status, 401);
	assert.equal((await second.request('/get/me')).status, 200);

	const third = harness.client();
	await third.post('/api/auth/sign-in/username', {
		username: 'sessions',
		password: strongPassword
	});
	const secondGone = next(secondSocket, 'disconnect');
	assert.equal((await second.post('/api/auth/revoke-sessions')).status, 200);
	assert.equal(await secondGone, 'io server disconnect');
	assert.equal((await second.request('/get/me')).status, 401);
	assert.equal((await third.request('/get/me')).status, 401);

	const legacy = harness.client();
	legacy.setCookie('token', oldJwt(id));
	assert.equal((await legacy.request('/get/me')).status, 401);
	const rejected = legacy.socket();
	const error = await next(rejected, 'connect_error');
	assert.ok(error instanceof Error);
	assert.equal(error.message, 'Authentication error: Invalid session');
	rejected.close();
});

test('sockets from untrusted origins are rejected even with a valid session', async () => {
	const { client } = await verifiedAccount(harness, 'Origin', 'origin@example.test');
	const { io: connect } = await import('socket.io-client');
	const socket = connect(harness.base, {
		reconnection: false,
		extraHeaders: { cookie: client.cookie, origin: 'https://evil.example' }
	});
	const error = await next(socket, 'connect_error');
	assert.ok(error instanceof Error);
	assert.equal(error.message, 'Authentication error: Untrusted origin');
	socket.close();
});

test('passkey endpoints are configured and gated by verified sessions', async () => {
	const anonymous = harness.client();
	assert.equal(
		(await anonymous.request('/api/auth/passkey/generate-register-options')).status,
		401
	);
	assert.equal((await anonymous.request('/api/auth/passkey/list-user-passkeys')).status, 401);
	const deleted = await anonymous.post('/api/auth/passkey/delete-passkey', { id: 'missing' });
	assert.equal(deleted.status, 401);

	const { client, id } = await verifiedAccount(harness, 'Passkeys', 'passkeys@example.test');
	const options = await json(await client.request('/api/auth/passkey/generate-register-options'));
	assert.deepEqual(options.rp, { name: 'Maple', id: 'maple.music' });
	assert.equal(JSON.stringify(options).includes(id), false);
	assert.deepEqual(await (await client.request('/api/auth/passkey/list-user-passkeys')).json(), []);
	const forged = {
		response: {
			id: 'ZmFrZQ',
			rawId: 'ZmFrZQ',
			type: 'public-key',
			response: { clientDataJSON: 'e30', attestationObject: 'AA' },
			clientExtensionResults: {}
		}
	};
	const registration = await client.post('/api/auth/passkey/verify-registration', forged);
	assert.equal(registration.ok, false);
	assert.equal((await json(registration)).code, 'FAILED_TO_VERIFY_REGISTRATION');
	const replayed = await client.post('/api/auth/passkey/verify-registration', forged);
	assert.equal(replayed.status, 400);
	assert.equal((await json(replayed)).code, 'CHALLENGE_NOT_FOUND');
	assert.equal(harness.db.all('SELECT 1 FROM auth_passkey').length, 0);

	const authentication = await json(
		await anonymous.request('/api/auth/passkey/generate-authenticate-options')
	);
	assert.equal(authentication.rpId, 'maple.music');
});

test('an existing session cannot manage passkeys after its email becomes unverified', async () => {
	const { client, id } = await verifiedAccount(
		harness,
		'UnverifiedSession',
		'unverifiedsession@example.test'
	);
	harness.db.run('UPDATE auth_user SET emailVerified = 0 WHERE id = ?', [id]);
	assert.equal((await client.request('/api/auth/passkey/generate-register-options')).status, 401);
	assert.equal((await client.request('/api/auth/passkey/list-user-passkeys')).status, 401);
	assert.equal(
		(await client.post('/api/auth/passkey/delete-passkey', { id: 'missing' })).status,
		401
	);
});

test('auth writes never share a transaction with Maple statements', async () => {
	let writes = 0;
	const timer = setInterval(() => {
		assert.notEqual(harness.db.connection.isTransaction, true);
		harness.db.transaction((transaction) =>
			transaction.run(
				'INSERT INTO live_status (user_id, playing) VALUES (?, NULL) ON CONFLICT(user_id) DO UPDATE SET playing = NULL',
				['probe']
			)
		);
		writes++;
	}, 0);
	try {
		const responses = await Promise.all(
			Array.from({ length: 6 }, (_, index) =>
				harness.client().post('/api/auth/sign-up/email', {
					username: `Concurrent${index}`,
					email: `concurrent${index}@example.test`,
					password: strongPassword
				})
			)
		);
		assert.deepEqual(
			responses.map((response) => response.status),
			Array(6).fill(200)
		);
	} finally {
		clearInterval(timer);
	}
	assert.ok(writes > 0);
	assert.equal(harness.db.all("SELECT 1 FROM users WHERE username LIKE 'Concurrent%'").length, 6);
});

test('deleting a Maple account removes its auth identity and sessions', async () => {
	const { client, id } = await verifiedAccount(harness, 'Leaver', 'leaver@example.test');
	const socket = client.socket();
	await next(socket, 'connect');
	const gone = next(socket, 'disconnect');
	const response = await client.request('/user/manage/me', { method: 'DELETE' });
	assert.equal(response.status, 200);
	assert.equal(await gone, 'io server disconnect');
	for (const table of ['auth_user', 'auth_session', 'auth_account']) {
		const column = table === 'auth_user' ? 'id' : 'userId';
		assert.equal(harness.db.all(`SELECT 1 FROM ${table} WHERE ${column} = ?`, [id]).length, 0);
	}
	assert.equal((await client.request('/get/me')).status, 401);
});
