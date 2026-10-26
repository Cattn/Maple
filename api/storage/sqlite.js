const { DatabaseSync } = require('node:sqlite');
const { readFileSync, accessSync } = require('node:fs');
const path = require('node:path');

const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const tables = {
	friends_db: ['user_id', 'friend_id'],
	live_status: ['user_id', 'playing', 'albumArt'],
	pending_requests: ['user_id', 'friend_id'],
	users: ['id', 'username', 'password', 'pfp', 'name', 'creation_date', 'last_login']
};

function decodeRow(row) {
	const result = { ...row };
	for (const [key, value] of Object.entries(result)) {
		// node:sqlite returns Uint8Array; Express and base64 callers need Buffer.
		if (value instanceof Uint8Array) result[key] = Buffer.from(value);
	}
	// Match mysql2's default decoding of MySQL's JSON column.
	if (typeof result.playing === 'string') result.playing = JSON.parse(result.playing);
	return result;
}

function validateSchema(database) {
	if (database.prepare('PRAGMA user_version').get().user_version !== 1) {
		throw new Error('Unsupported SQLite schema version. Run db:init or db:migrate:mysql first.');
	}
	for (const [table, columns] of Object.entries(tables)) {
		const actual = database.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name);
		if (JSON.stringify(actual) !== JSON.stringify(columns)) {
			throw new Error(`Unexpected SQLite schema for ${table}.`);
		}
	}
}

function openDatabase(filename) {
	// DatabaseSync creates files when opened read-write; check first to avoid
	// silently starting with an empty account database after a path typo.
	if (filename !== ':memory:') accessSync(filename);
	const database = new DatabaseSync(filename);
	try {
		validateSchema(database);
		database.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
	} catch (error) {
		database.close();
		throw error;
	}

	function query(sql, parameters = [], callback) {
		let result;
		try {
			const statement = database.prepare(sql);
			result = /^\s*SELECT\b/i.test(sql)
				? statement.all(...parameters).map(decodeRow)
				: { affectedRows: statement.run(...parameters).changes };
		} catch (error) {
			if (callback) {
				queueMicrotask(() => callback(error));
				return;
			}
			return Promise.reject(error);
		}
		if (callback) {
			queueMicrotask(() => callback(null, result));
			return;
		}
		return Promise.resolve(result);
	}

	function transaction(work) {
		database.exec('BEGIN IMMEDIATE');
		try {
			// No awaits inside a SQLite transaction: other requests must never share it.
			const result = work({
				run: (sql, parameters = []) => database.prepare(sql).run(...parameters),
				all: (sql, parameters = []) => database.prepare(sql).all(...parameters).map(decodeRow)
			});
			if (result && typeof result.then === 'function') throw new Error('Transactions must be synchronous.');
			database.exec('COMMIT');
			return result;
		} catch (error) {
			database.exec('ROLLBACK');
			throw error;
		}
	}

	return { query, transaction, close: () => database.close() };
}

module.exports = { schema, tables, openDatabase, validateSchema };
