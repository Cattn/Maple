import type { DatabaseSync } from 'node:sqlite';
import { isValidUsername } from '../validation/account.js';
import { validateKnownSchema } from './schema.js';

export interface RelationshipReport {
	rows: number;
	duplicates: number;
	reversed: number;
	self: number;
	nulls: number;
	orphans: number;
}

export interface PreflightReport {
	version: number;
	users: number;
	duplicateIds: number;
	duplicateUsernames: number;
	normalizedIdCollisions: number;
	normalizedUsernameCollisions: number;
	invalidUsernames: number;
	nonconformingUsernames: number;
	friends_db: RelationshipReport;
	pending_requests: RelationshipReport;
	blocking: string[];
}

function count(database: DatabaseSync, sql: string) {
	return Number(database.prepare(sql).get()?.count ?? 0);
}

function duplicates(database: DatabaseSync, column: string) {
	return count(
		database,
		`SELECT COALESCE(SUM(n), 0) AS count FROM (SELECT COUNT(*) AS n FROM users GROUP BY ${column} HAVING n > 1)`
	);
}

function collisions(values: unknown[]) {
	const groups = new Map<string, number>();
	for (const value of values) {
		if (typeof value !== 'string') continue;
		const key = value.normalize('NFKC').toLowerCase();
		groups.set(key, (groups.get(key) ?? 0) + 1);
	}
	return [...groups.values()].filter((size) => size > 1).reduce((sum, size) => sum + size, 0);
}

function relationships(database: DatabaseSync, table: string): RelationshipReport {
	const pairs = 'user_id IS NOT NULL AND friend_id IS NOT NULL';
	const orphan = (column: string) =>
		`(t.${column} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = t.${column}))`;
	return {
		rows: count(database, `SELECT COUNT(*) AS count FROM ${table}`),
		duplicates: count(
			database,
			`SELECT COALESCE(SUM(n), 0) AS count FROM (SELECT COUNT(*) AS n FROM ${table} WHERE ${pairs} GROUP BY user_id, friend_id HAVING n > 1)`
		),
		reversed: count(
			database,
			`SELECT COUNT(*) AS count FROM ${table} t WHERE t.user_id <> t.friend_id AND EXISTS (SELECT 1 FROM ${table} r WHERE r.user_id = t.friend_id AND r.friend_id = t.user_id)`
		),
		self: count(database, `SELECT COUNT(*) AS count FROM ${table} WHERE user_id = friend_id`),
		nulls: count(database, `SELECT COUNT(*) AS count FROM ${table} WHERE NOT (${pairs})`),
		orphans: count(
			database,
			`SELECT COUNT(*) AS count FROM ${table} t WHERE ${orphan('user_id')} OR ${orphan('friend_id')}`
		)
	};
}

export function preflight(database: DatabaseSync): PreflightReport {
	const version = validateKnownSchema(database);
	const integrity = database.prepare('PRAGMA integrity_check').all();
	if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') {
		throw new Error('SQLite source integrity check failed.');
	}
	const users = database.prepare('SELECT id, username FROM users').all();
	const usernames = users.map((user) => user.username);
	const report = {
		version,
		users: users.length,
		duplicateIds: duplicates(database, 'id'),
		duplicateUsernames: duplicates(database, 'username'),
		normalizedIdCollisions: collisions(users.map((user) => user.id)),
		normalizedUsernameCollisions: collisions(usernames),
		invalidUsernames: usernames.filter((name) => typeof name !== 'string' || !name.trim()).length,
		nonconformingUsernames: usernames.filter((name) => !isValidUsername(name)).length,
		friends_db: relationships(database, 'friends_db'),
		pending_requests: relationships(database, 'pending_requests')
	};
	const blocking = (['duplicateIds', 'duplicateUsernames'] as const).filter(
		(key) => report[key] > 0
	);
	return { ...report, blocking };
}
