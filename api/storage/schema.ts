import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export const schema = readFileSync(new URL('schema.sql', import.meta.url), 'utf8');
export const tables = {
	friends_db: ['user_id', 'friend_id'],
	live_status: ['user_id', 'playing', 'albumArt'],
	pending_requests: ['user_id', 'friend_id'],
	users: ['id', 'username', 'password', 'pfp', 'name', 'creation_date', 'last_login']
};

const upgrades = [
	`DROP INDEX users_id;
	DROP INDEX users_username;
	CREATE UNIQUE INDEX users_id ON users(id COLLATE NOCASE);
	CREATE UNIQUE INDEX users_username ON users(username COLLATE NOCASE);`,
	`CREATE TABLE users_v3 (
		id TEXT COLLATE NOCASE NOT NULL,
		username TEXT COLLATE NOCASE NOT NULL,
		password TEXT,
		pfp BLOB,
		name TEXT,
		creation_date TEXT,
		last_login TEXT
	);
	INSERT INTO users_v3 (rowid, id, username, password, pfp, name, creation_date, last_login)
		SELECT rowid, id, username, password, pfp, name, creation_date, last_login FROM users;
	DROP TABLE users;
	ALTER TABLE users_v3 RENAME TO users;
	CREATE UNIQUE INDEX users_id ON users(id COLLATE NOCASE);
	CREATE UNIQUE INDEX users_username ON users(username COLLATE NOCASE);
	CREATE TABLE auth_user (
		"id" text not null primary key references users ("id") on delete cascade deferrable initially deferred,
		"name" text not null,
		"email" text not null unique,
		"emailVerified" integer not null,
		"image" text,
		"createdAt" date not null,
		"updatedAt" date not null,
		"username" text unique,
		"displayUsername" text
	);
	CREATE TABLE auth_session (
		"id" text not null primary key,
		"expiresAt" date not null,
		"token" text not null unique,
		"createdAt" date not null,
		"updatedAt" date not null,
		"ipAddress" text,
		"userAgent" text,
		"userId" text not null references auth_user ("id") on delete cascade
	);
	CREATE TABLE auth_account (
		"id" text not null primary key,
		"accountId" text not null,
		"providerId" text not null,
		"userId" text not null references auth_user ("id") on delete cascade,
		"accessToken" text,
		"refreshToken" text,
		"idToken" text,
		"accessTokenExpiresAt" date,
		"refreshTokenExpiresAt" date,
		"scope" text,
		"password" text,
		"createdAt" date not null,
		"updatedAt" date not null
	);
	CREATE TABLE auth_verification (
		"id" text not null primary key,
		"identifier" text not null,
		"value" text not null,
		"expiresAt" date not null,
		"createdAt" date not null,
		"updatedAt" date not null
	);
	CREATE TABLE auth_passkey (
		"id" text not null primary key,
		"name" text,
		"publicKey" text not null,
		"userId" text not null references auth_user ("id") on delete cascade,
		"credentialID" text not null,
		"counter" integer not null,
		"deviceType" text not null,
		"backedUp" integer not null,
		"transports" text,
		"createdAt" date,
		"aaguid" text
	);
	CREATE INDEX auth_session_userId_idx ON auth_session ("userId");
	CREATE INDEX auth_account_userId_idx ON auth_account ("userId");
	CREATE UNIQUE INDEX auth_account_credential ON auth_account ("userId") WHERE "providerId" = 'credential';
	CREATE INDEX auth_verification_identifier_idx ON auth_verification ("identifier");
	CREATE INDEX auth_passkey_userId_idx ON auth_passkey ("userId");
	CREATE INDEX auth_passkey_credentialID_idx ON auth_passkey ("credentialID");
	CREATE TRIGGER auth_user_profile AFTER INSERT ON auth_user
	BEGIN
		UPDATE users SET username = NEW."displayUsername" WHERE id = NEW."id";
		INSERT INTO users (id, username, creation_date)
			SELECT NEW."id", NEW."displayUsername", strftime('%Y-%m-%d %H:%M:%S', 'now')
			WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = NEW."id");
	END;
	CREATE TRIGGER auth_account_credential AFTER INSERT ON auth_account
	WHEN NEW."providerId" = 'credential'
	BEGIN
		UPDATE users SET password = NULL WHERE id = NEW."userId";
	END;`,
	`ALTER TABLE users ADD COLUMN listening_visibility TEXT NOT NULL DEFAULT 'public'
		CHECK (listening_visibility IN ('public', 'private'));
	ALTER TABLE live_status ADD COLUMN artwork_id TEXT;`
];

export const currentVersion = upgrades.length + 1;

export function readVersion(database: DatabaseSync) {
	return Number(database.prepare('PRAGMA user_version').get()?.user_version);
}

export function upgradeSchema(database: DatabaseSync, from: number, to = currentVersion) {
	for (let version = from + 1; version <= to; version++) {
		const sql = upgrades[version - 2];
		if (!sql) throw new Error(`No SQLite upgrade to schema version ${version}.`);
		database.exec(sql);
		database.exec(`PRAGMA user_version = ${version}`);
	}
}

function tableNames(database: DatabaseSync) {
	return database
		.prepare(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid"
		)
		.all()
		.map(({ name }) => String(name));
}

function columns(database: DatabaseSync, table: string) {
	return database.prepare(`PRAGMA table_info("${table}")`).all();
}

function shape(database: DatabaseSync) {
	return JSON.stringify({
		objects: database
			.prepare(
				"SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'view', 'trigger', 'index') ORDER BY type, name"
			)
			.all()
			.map(({ type, name, sql }) => (type === 'table' ? [type, name] : [type, name, sql])),
		tables: tableNames(database)
			.sort()
			.map((table) => ({
				columns: columns(database, table).map(({ name, type, notnull, dflt_value, pk }) => [
					name,
					type,
					notnull,
					dflt_value,
					pk
				]),
				foreignKeys: database
					.prepare(`PRAGMA foreign_key_list("${table}")`)
					.all()
					.map(({ table, from, to, on_delete }) => [table, from, to, on_delete]),
				indexes: database
					.prepare(`PRAGMA index_list("${table}")`)
					.all()
					.map(({ name, unique, partial }) => ({
						name,
						unique,
						partial,
						keys: database
							.prepare(`PRAGMA index_xinfo("${String(name)}")`)
							.all()
							.filter((column) => column.key)
							.map((column) => [column.name, column.coll, column.desc])
					}))
					.sort((a, b) => String(a.name).localeCompare(String(b.name)))
			}))
	});
}

export interface Column {
	name: string;
	integer: boolean;
}

interface Reference {
	shape: string;
	tables: Record<string, Column[]>;
}

const references = new Map<number, Reference>();

function reference(version: number) {
	let expected = references.get(version);
	if (!expected) {
		const database = new DatabaseSync(':memory:');
		try {
			database.exec(schema);
			upgradeSchema(database, 1, version);
			expected = {
				shape: shape(database),
				tables: Object.fromEntries(
					tableNames(database).map((table) => [
						table,
						columns(database, table).map(({ name, type }) => ({
							name: String(name),
							integer: String(type).toLowerCase() === 'integer'
						}))
					])
				)
			};
		} finally {
			database.close();
		}
		references.set(version, expected);
	}
	return expected;
}

export function tablesAt(version: number) {
	return reference(version).tables;
}

export function validateSchema(database: DatabaseSync, version = currentVersion) {
	const actual = readVersion(database);
	if (actual === 0) {
		throw new Error('SQLite database is not initialized. Run db:init or db:migrate:mysql first.');
	}
	if (actual >= 1 && actual < version) {
		throw new Error(
			`SQLite schema version ${actual} is outdated (expected ${version}). Run db:preflight, then db:upgrade into a new file and point SQLITE_PATH at it.`
		);
	}
	if (actual !== version) {
		throw new Error(`Unsupported SQLite schema version ${actual} (expected ${version}).`);
	}
	if (shape(database) !== reference(version).shape) {
		throw new Error(`Unexpected SQLite schema for version ${version}.`);
	}
}

export function validateKnownSchema(database: DatabaseSync) {
	const version = readVersion(database);
	validateSchema(database, version >= 1 && version <= currentVersion ? version : currentVersion);
	return version;
}
