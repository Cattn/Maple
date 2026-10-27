import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFile } from '../storage/create-file.js';
import { importSnapshot, type Source } from '../storage/import.js';
import { openDatabase } from '../storage/sqlite.js';
import { currentVersion, tables, tablesAt } from '../storage/schema.js';
import { inspectFile, upgradeFile } from '../storage/upgrade.js';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maple-upgrade-test-'));

after(() => fs.rmSync(directory, { recursive: true, force: true }));

type Rows = Record<string, Record<string, unknown>[]>;

function file(name: string) {
	return path.join(directory, name);
}

async function legacy(name: string, data: Rows) {
	const source: Source = {
		count: async (table) => data[table]?.length ?? 0,
		rows: async function* (table) {
			yield* data[table] ?? [];
		},
		close: async () => {}
	};
	await importSnapshot(source, file(name), { allowEmpty: true });
	return file(name);
}

function hash(filename: string) {
	return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function leftovers() {
	return fs.readdirSync(directory).filter((name) => name.startsWith('.maple-migration-'));
}

function account(id: string, username: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		username,
		password: `$2b$10$${id}hash`,
		pfp: null,
		name: null,
		creation_date: '2026-01-01 00:00:00',
		last_login: null,
		...extra
	};
}

const valid: Rows = {
	users: [
		account('a1', 'alice', { pfp: Buffer.from([0, 255, 1]), name: 'Alice A' }),
		account('b2', 'Bob_2', { pfp: Buffer.alloc(0) }),
		account('c3', 'has space'),
		account('d4', 'x')
	],
	live_status: [
		{ user_id: 'a1', playing: '{"title":"Song","n":[1,2]}', albumArt: Buffer.from('art') }
	],
	friends_db: [
		{ user_id: 'a1', friend_id: 'b2' },
		{ user_id: 'a1', friend_id: 'b2' },
		{ user_id: 'b2', friend_id: 'a1' },
		{ user_id: 'c3', friend_id: 'c3' },
		{ user_id: 'a1', friend_id: null },
		{ user_id: 'a1', friend_id: 'gone' }
	],
	pending_requests: [{ user_id: 'd4', friend_id: 'A1' }]
};

function dump(filename: string) {
	const database = new DatabaseSync(filename, { readOnly: true });
	try {
		return Object.fromEntries(
			Object.entries(tables).map(([table, columns]) => [
				table,
				database.prepare(`SELECT rowid, ${columns.join(', ')} FROM ${table} ORDER BY rowid`).all()
			])
		);
	} finally {
		database.close();
	}
}

test('preflight reports counts without account values', async () => {
	const source = await legacy('report.sqlite', {
		...valid,
		users: [
			...(valid.users ?? []),
			account('A1', 'ALICE'),
			account('e5', 'ｂob_2'),
			account('f6', '')
		]
	});
	const report = inspectFile(source);
	assert.deepEqual(
		{ ...report, friends_db: undefined, pending_requests: undefined },
		{
			version: 1,
			users: 7,
			duplicateIds: 2,
			duplicateUsernames: 2,
			normalizedIdCollisions: 2,
			normalizedUsernameCollisions: 4,
			invalidUsernames: 1,
			nonconformingUsernames: 4,
			friends_db: undefined,
			pending_requests: undefined,
			blocking: ['duplicateIds', 'duplicateUsernames']
		}
	);
	assert.deepEqual(report.friends_db, {
		rows: 6,
		duplicates: 2,
		reversed: 3,
		self: 1,
		nulls: 1,
		orphans: 1
	});
	assert.equal(report.pending_requests.orphans, 0);
	for (const value of ['alice', 'Bob_2', 'hash', 'a1', 'gone']) {
		assert.equal(JSON.stringify(report).includes(value), false);
	}
});

test('rejects ambiguous identities and leaves the source unchanged', async () => {
	for (const [name, users] of [
		['nocase', [account('a1', 'alice'), account('b2', 'Alice')]],
		['ids', [account('a1', 'alice'), account('A1', 'bob')]]
	] as const) {
		const source = await legacy(`${name}.sqlite`, { users: [...users] });
		const before = hash(source);
		const output = file(`${name}-v2.sqlite`);
		await assert.rejects(upgradeFile(source, output), /Upgrade blocked by ambiguous identities/);
		assert.equal(hash(source), before);
		assert.equal(fs.existsSync(output), false);
	}
	assert.deepEqual(leftovers(), []);
});

test('preserves distinct legacy names that only collide under hypothetical normalization', async () => {
	const source = await legacy('normalization.sqlite', {
		users: [account('a1', 'alice'), account('b2', 'ａlice')]
	});
	const report = inspectFile(source);
	assert.equal(report.normalizedUsernameCollisions, 2);
	assert.equal(report.nonconformingUsernames, 1);
	assert.deepEqual(report.blocking, []);
	const output = file('normalization-v2.sqlite');
	await upgradeFile(source, output);
	assert.deepEqual(dump(output), dump(source));
});

test('upgrades into a new verified file without changing data', async () => {
	const source = await legacy('valid.sqlite', valid);
	const before = hash(source);
	const output = file('valid-v2.sqlite');
	const result = await upgradeFile(source, output);
	assert.equal(result.preflight.nonconformingUsernames, 2);
	assert.equal(result.tables.friends_db?.rows, 6);
	assert.equal(hash(source), before);
	assert.deepEqual(dump(output), dump(source));

	const [user] = dump(output).users ?? [];
	assert.equal(user?.password, '$2b$10$a1hash');
	assert.deepEqual([...(user?.pfp as Uint8Array)], [0, 255, 1]);

	const db = openDatabase(output);
	try {
		assert.equal(db.all('PRAGMA user_version')[0]?.user_version, currentVersion);
		assert.equal(db.all("SELECT rowid FROM users WHERE username = 'ALICE'").length, 1);
		for (const [id, username] of [
			['A1', 'new'],
			['new', 'BOB_2']
		] as const) {
			assert.throws(
				() =>
					db.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [
						id,
						username,
						'h'
					]),
				/UNIQUE constraint failed/
			);
		}
	} finally {
		db.close();
	}
	assert.deepEqual(leftovers(), []);
});

test('includes committed WAL data from a consistent snapshot', async () => {
	const source = await legacy('wal.sqlite', { users: [account('a1', 'alice')] });
	const writer = new DatabaseSync(source);
	try {
		writer.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;');
		writer
			.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)')
			.run('b2', 'bob', 'hash');
		const before = hash(source);
		assert.ok(fs.statSync(`${source}-wal`).size > 0);
		const output = file('wal-v2.sqlite');
		await upgradeFile(source, output);
		assert.equal(hash(source), before);
		assert.equal(dump(output).users?.length, 2);
	} finally {
		writer.close();
	}
});

test('refuses existing outputs, sidecars, the source itself and repeated upgrades', async () => {
	const source = await legacy('refuse.sqlite', { users: [account('a1', 'alice')] });
	const existing = file('existing.sqlite');
	fs.writeFileSync(existing, 'keep');
	await assert.rejects(upgradeFile(source, existing), /already exists/);
	assert.equal(fs.readFileSync(existing, 'utf8'), 'keep');

	fs.writeFileSync(file('sidecar.sqlite-wal'), 'keep');
	await assert.rejects(upgradeFile(source, file('sidecar.sqlite')), /already exists/);
	assert.equal(fs.existsSync(file('sidecar.sqlite')), false);
	await assert.rejects(upgradeFile(source, source), /must be a new file/);
	await assert.rejects(upgradeFile(source, `${source}-wal`), /must be a new file/);
	if (process.platform === 'win32') {
		await assert.rejects(upgradeFile(source, `${source.toUpperCase()}-wal`), /must be a new file/);
	}

	const upgraded = file('refuse-v2.sqlite');
	await upgradeFile(source, upgraded);
	await assert.rejects(upgradeFile(upgraded, file('again.sqlite')), /already at schema version/);
	assert.equal(fs.existsSync(file('again.sqlite')), false);
	assert.equal(inspectFile(upgraded).version, currentVersion);
});

test('refuses missing, uninitialized and unknown schemas without creating files', async () => {
	const missing = file('missing.sqlite');
	await assert.rejects(upgradeFile(missing, file('missing-v2.sqlite')), /ENOENT/);
	assert.throws(() => inspectFile(missing), /ENOENT/);
	assert.throws(() => openDatabase(missing), /ENOENT/);
	assert.equal(fs.existsSync(missing), false);

	const blank = file('blank.sqlite');
	new DatabaseSync(blank).close();
	assert.throws(() => inspectFile(blank), /not initialized/);
	assert.throws(() => openDatabase(blank), /not initialized/);

	const future = await legacy('future.sqlite', { users: [account('a1', 'alice')] });
	const writer = new DatabaseSync(future);
	writer.exec('PRAGMA user_version = 99');
	writer.close();
	await assert.rejects(
		upgradeFile(future, file('future-v2.sqlite')),
		/Unsupported SQLite schema version 99/
	);
	assert.throws(() => openDatabase(future), /Unsupported SQLite schema version 99/);

	const altered = await legacy('altered.sqlite', { users: [account('a1', 'alice')] });
	const alter = new DatabaseSync(altered);
	alter.exec('DROP INDEX users_username');
	alter.close();
	await assert.rejects(upgradeFile(altered, file('altered-v2.sqlite')), /Unexpected SQLite schema/);
	assert.equal(fs.existsSync(file('altered-v2.sqlite')), false);
});

test('refuses to discard unexpected source tables', async () => {
	const source = await legacy('extra.sqlite', { users: [account('a1', 'alice')] });
	const writer = new DatabaseSync(source);
	writer.exec("CREATE TABLE extra_data (value TEXT); INSERT INTO extra_data VALUES ('keep');");
	writer.close();
	const before = hash(source);
	const output = file('extra-v2.sqlite');
	await assert.rejects(upgradeFile(source, output), /Unexpected SQLite schema/);
	assert.equal(hash(source), before);
	assert.equal(fs.existsSync(output), false);
	assert.deepEqual(leftovers(), []);
});

test('cleans up after a failed copy', async () => {
	const source = await legacy('lossy.sqlite', { users: [account('a1', 'alice')] });
	const writer = new DatabaseSync(source);
	writer.exec('UPDATE users SET pfp = 42');
	writer.close();
	const output = file('lossy-v2.sqlite');
	await assert.rejects(upgradeFile(source, output), /lossy conversion/);
	assert.equal(fs.existsSync(output), false);
	assert.deepEqual(leftovers(), []);
});

test('initializes the current schema and refuses to migrate at startup', async () => {
	const fresh = file('fresh.sqlite');
	await createFile(fresh, () => undefined);
	assert.equal(inspectFile(fresh).version, currentVersion);
	openDatabase(fresh).close();

	const source = await legacy('startup.sqlite', { users: [account('a1', 'alice')] });
	const before = hash(source);
	assert.throws(() => openDatabase(source), /version 1 is outdated/);
	assert.equal(hash(source), before);
	assert.equal(inspectFile(source).version, 1);
});

function snapshotOf(filename: string): { database: DatabaseSync; source: Source } {
	const database = new DatabaseSync(filename, { readOnly: true });
	return {
		database,
		source: {
			count: async (table) =>
				Number(database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get()?.count),
			rows: async function* (table, columns) {
				yield* database
					.prepare(
						`SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM "${table}" ORDER BY rowid`
					)
					.iterate();
			},
			close: async () => {}
		}
	};
}

function dumpAll(filename: string) {
	const database = new DatabaseSync(filename, { readOnly: true });
	try {
		return Object.fromEntries(
			Object.keys(tablesAt(currentVersion)).map((table) => [
				table,
				database.prepare(`SELECT rowid, * FROM "${table}" ORDER BY rowid`).all()
			])
		);
	} finally {
		database.close();
	}
}

async function claimedFile(name: string) {
	const filename = file(name);
	await createFile(
		filename,
		(database) => {
			database.exec(`
			INSERT INTO users (id, username, password, pfp, name, creation_date)
				VALUES ('legacy', 'Dormant', '$2b$10$hash', x'00ff', 'Dormant User', '2020-01-01 00:00:00');
			INSERT INTO users (id, username, password, creation_date)
				VALUES ('claimed', 'Claimed', NULL, '2021-01-01 00:00:00');
			INSERT INTO auth_user VALUES ('claimed', 'Claimed', 'c@example.test', 1, NULL,
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'claimed', 'Claimed');
			INSERT INTO auth_account (id, accountId, providerId, userId, password, createdAt, updatedAt)
				VALUES ('acc', 'claimed', 'credential', 'claimed', '$2b$10$moved',
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
			INSERT INTO auth_session VALUES ('ses', '2027-01-01T00:00:00.000Z', 'token', '2026-01-01T00:00:00.000Z',
				'2026-01-01T00:00:00.000Z', NULL, NULL, 'claimed');
			INSERT INTO auth_passkey VALUES ('pk', 'Laptop', 'key', 'claimed', 'cred', 7, 'multiDevice', 1,
				'internal', '2026-01-01T00:00:00.000Z', NULL);
			INSERT INTO auth_verification VALUES ('ver', 'id', 'value', '2027-01-01T00:00:00.000Z',
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
		`);
		},
		undefined,
		currentVersion,
		currentVersion
	);
	return filename;
}

test('upgrades version 2 files to the auth schema and keeps legacy hashes', async () => {
	const v2 = file('second.sqlite');
	await importSnapshot(
		{
			count: async (table) => (table === 'users' ? 1 : 0),
			rows: async function* (table) {
				if (table === 'users') yield account('a1', 'alice', { pfp: Buffer.from('img') });
			},
			close: async () => {}
		},
		v2,
		{ version: 2 }
	);
	assert.equal(inspectFile(v2).version, 2);
	const output = file('second-v3.sqlite');
	await upgradeFile(v2, output);
	assert.deepEqual(dump(output), dump(v2));
	const db = openDatabase(output);
	try {
		assert.equal(db.all('SELECT COUNT(*) AS count FROM auth_user')[0]?.count, 0);
		db.run("INSERT INTO users (id, username) VALUES ('n1', 'nopassword')");
		assert.throws(
			() => db.run("INSERT INTO users (id, username) VALUES ('n2', 'ALICE')"),
			/UNIQUE constraint failed/
		);
	} finally {
		db.close();
	}
});

test('copies auth tables losslessly when the source already has them', async () => {
	const source = await claimedFile('claimed.sqlite');
	const before = hash(source);
	const { database, source: snapshot } = snapshotOf(source);
	const output = file('claimed-copy.sqlite');
	try {
		database.exec('BEGIN');
		const report = await importSnapshot(snapshot, output, {
			version: currentVersion,
			sourceVersion: currentVersion
		});
		assert.equal(report.auth_passkey?.rows, 1);
		assert.equal(report.auth_user?.rows, 1);
	} finally {
		database.close();
	}
	assert.equal(hash(source), before);
	assert.deepEqual(dumpAll(output), dumpAll(source));
	openDatabase(output).close();
});

test('refuses auth copies whose profile triggers would change data', async () => {
	const source = await claimedFile('drifted.sqlite');
	const writer = new DatabaseSync(source);
	writer.exec("UPDATE users SET username = 'Renamed' WHERE id = 'claimed'");
	writer.close();
	const { database, source: snapshot } = snapshotOf(source);
	const output = file('drifted-copy.sqlite');
	try {
		await assert.rejects(
			importSnapshot(snapshot, output, { version: currentVersion, sourceVersion: currentVersion }),
			/Read-back verification failed for users/
		);
	} finally {
		database.close();
	}
	assert.equal(fs.existsSync(output), false);
	assert.deepEqual(leftovers(), []);
});

test('validates auth tables, indexes and triggers at startup', async () => {
	for (const change of [
		'DROP TRIGGER auth_user_profile',
		'DROP INDEX auth_account_credential',
		'ALTER TABLE auth_user ADD COLUMN extra TEXT'
	]) {
		const altered = await claimedFile(`altered-${randomUUID()}.sqlite`);
		const writer = new DatabaseSync(altered);
		writer.exec(change);
		writer.close();
		assert.throws(() => openDatabase(altered), /Unexpected SQLite schema/, change);
	}
});

test('upgrades version 3 files with public listening and no artwork version', async () => {
	const v3 = file('third.sqlite');
	await createFile(
		v3,
		(database) => {
			database.exec(`
			INSERT INTO users (id, username, password, creation_date)
				VALUES ('a1', 'alice', '$2b$10$hash', '2020-01-01 00:00:00');
			INSERT INTO live_status (user_id, playing, albumArt)
				VALUES ('A1', '{"title":"Song","timePlayed":"2020-01-01 00:00:00"}', x'ffd8ff');
		`);
		},
		undefined,
		3,
		3
	);
	assert.equal(inspectFile(v3).version, 3);
	assert.throws(() => openDatabase(v3), /version 3 is outdated/);
	const output = file('third-v4.sqlite');
	await upgradeFile(v3, output);
	assert.deepEqual(dump(output), dump(v3));
	assert.equal(inspectFile(output).version, currentVersion);
	const db = openDatabase(output);
	try {
		assert.deepEqual(db.all('SELECT listening_visibility FROM users'), [
			{ listening_visibility: 'public' }
		]);
		assert.deepEqual(db.all('SELECT artwork_id FROM live_status'), [{ artwork_id: null }]);
		assert.throws(
			() => db.run("UPDATE users SET listening_visibility = 'friends'"),
			/CHECK constraint failed/
		);
	} finally {
		db.close();
	}
});
