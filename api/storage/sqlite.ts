import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from 'node:sqlite';
import { accessSync } from 'node:fs';
import { validateSchema } from './schema.js';

export type Value = Exclude<SQLOutputValue, Uint8Array> | Buffer;
export type Row = Record<string, Value>;

export interface Statements {
	all(sql: string, parameters?: SQLInputValue[]): Row[];
	run(sql: string, parameters?: SQLInputValue[]): number;
}

export interface Database extends Statements {
	connection: DatabaseSync;
	transaction<T>(work: (transaction: Statements) => T): T;
	close(): void;
}

function decodeRow(row: Record<string, SQLOutputValue>): Row {
	const result: Row = {};
	for (const [key, value] of Object.entries(row)) {
		// node:sqlite returns Uint8Array; Express and base64 callers need Buffer.
		result[key] = value instanceof Uint8Array ? Buffer.from(value) : value;
	}
	return result;
}

export function openDatabase(filename: string): Database {
	// DatabaseSync creates files when opened read-write; check first to avoid
	// silently starting with an empty account database after a path typo.
	if (filename !== ':memory:') accessSync(filename);
	const database = new DatabaseSync(filename);
	try {
		validateSchema(database);
		database.exec(
			'PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;'
		);
	} catch (error) {
		database.close();
		throw error;
	}

	const statements: Statements = {
		all: (sql, parameters = []) =>
			database
				.prepare(sql)
				.all(...parameters)
				.map(decodeRow),
		run: (sql, parameters = []) => Number(database.prepare(sql).run(...parameters).changes)
	};

	function transaction<T>(work: (transaction: Statements) => T): T {
		database.exec('BEGIN IMMEDIATE');
		try {
			// No awaits inside a SQLite transaction: other requests must never share it.
			const result = work(statements);
			if (
				result !== null &&
				(typeof result === 'object' || typeof result === 'function') &&
				'then' in result &&
				typeof result.then === 'function'
			) {
				throw new Error('Transactions must be synchronous.');
			}
			database.exec('COMMIT');
			return result;
		} catch (error) {
			database.exec('ROLLBACK');
			throw error;
		}
	}

	return { ...statements, connection: database, transaction, close: () => database.close() };
}
