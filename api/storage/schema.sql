-- Based on maple_auth's 2026-10-21 schema. Preserve nullable fields and
-- duplicate rows; do not introduce constraints that could discard legacy data.
CREATE TABLE friends_db (
	user_id TEXT COLLATE NOCASE,
	friend_id TEXT COLLATE NOCASE
);
CREATE TABLE live_status (
	user_id TEXT COLLATE NOCASE UNIQUE,
	playing TEXT CHECK (playing IS NULL OR json_valid(playing)),
	albumArt BLOB
);
CREATE TABLE pending_requests (
	user_id TEXT COLLATE NOCASE,
	friend_id TEXT COLLATE NOCASE
);
CREATE TABLE users (
	id TEXT COLLATE NOCASE NOT NULL,
	username TEXT COLLATE NOCASE NOT NULL,
	password TEXT NOT NULL,
	pfp BLOB,
	name TEXT,
	creation_date TEXT,
	last_login TEXT
);
CREATE INDEX users_id ON users(id);
CREATE INDEX users_username ON users(username);
CREATE INDEX friends_user ON friends_db(user_id);
CREATE INDEX friends_friend ON friends_db(friend_id);
CREATE INDEX requests_user ON pending_requests(user_id);
CREATE INDEX requests_friend ON pending_requests(friend_id);
PRAGMA user_version = 1;
