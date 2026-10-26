import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFile } from '../storage/create-file.js';
import { importSnapshot, type Source } from '../storage/import.js';
import { openDatabase } from '../storage/sqlite.js';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maple-import-test-'));

after(() => fs.rmSync(directory, { recursive: true, force: true }));

function source(data: Record<string, Record<string, unknown>[]>): Source {
	return {
		count: async (table) => data[table]?.length ?? 0,
		rows: async function* (table) {
			yield* data[table] ?? [];
		},
		close: async () => {}
	};
}

const user = {
	id: 'u1',
	username: 'name',
	password: 'hash',
	pfp: Buffer.from([0, 1, 2]),
	name: null,
	creation_date: '2026-01-01 00:00:00',
	last_login: '2026-01-02 00:00:00'
};

test('keeps duplicate legacy identities in raw imports', async () => {
	const destination = path.join(directory, 'duplicates.sqlite');
	const report = await importSnapshot(
		source({ users: [user, { ...user, id: 'U1', username: 'NAME' }] }),
		destination
	);
	assert.equal(report.users?.rows, 2);
});

test('imports and verifies text, null and blob values', async () => {
	const destination = path.join(directory, 'ok.sqlite');
	const report = await importSnapshot(
		source({
			users: [user],
			live_status: [{ user_id: 'u1', playing: '{"title":"x"}', albumArt: Buffer.alloc(0) }]
		}),
		destination
	);
	assert.equal(report.users?.rows, 1);
	assert.equal(report.friends_db?.rows, 0);
	const db = new DatabaseSync(destination, { readOnly: true });
	assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 1);
	const row = db.prepare('SELECT * FROM users').get();
	assert.ok(row?.pfp instanceof Uint8Array);
	assert.deepEqual([...row.pfp], [0, 1, 2]);
	assert.equal(row.name, null);
	db.close();
	assert.throws(() => openDatabase(destination), /version 1 is outdated/);
});

test('refuses empty sources and lossy values without publishing a file', async () => {
	const empty = path.join(directory, 'empty.sqlite');
	await assert.rejects(importSnapshot(source({}), empty), /no users/);
	assert.equal(fs.existsSync(empty), false);
	await importSnapshot(source({}), empty, { allowEmpty: true });
	assert.equal(fs.existsSync(empty), true);

	const lossy = path.join(directory, 'lossy.sqlite');
	await assert.rejects(
		importSnapshot(source({ users: [{ ...user, name: 5 }] }), lossy),
		/lossy conversion/
	);
	assert.equal(fs.existsSync(lossy), false);
	await assert.rejects(importSnapshot(source({ users: [user] }), empty), /already exists/);
});

test('rolls back transactions that return a Promise-like result', async () => {
	const destination = path.join(directory, 'transaction.sqlite');
	await createFile(destination, () => undefined);
	const db = openDatabase(destination);
	db.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', ['u1', 'name', 'hash']);
	try {
		assert.throws(
			() =>
				db.transaction((transaction) => {
					transaction.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [
						'u2',
						'other',
						'hash'
					]);
					return { then: () => {} };
				}),
			/Transactions must be synchronous/
		);
		assert.equal(db.all('SELECT id FROM users').length, 1);
	} finally {
		db.close();
	}
});
