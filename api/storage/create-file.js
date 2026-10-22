const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { schema, validateSchema } = require('./sqlite');

function assertNewDestination(destination) {
	for (const suffix of ['', '-wal', '-shm', '-journal']) {
		try {
			fs.lstatSync(destination + suffix);
		} catch (error) {
			if (error.code === 'ENOENT') continue;
			throw error;
		}
		throw new Error(`Destination already exists: ${destination + suffix}. Choose a new filename.`);
	}
}

// Build privately beside the destination; publish only after all validation.
// A hard link is atomic and refuses to replace even a concurrently created file.
async function createFile(destination, populate = async () => ({}), verify = () => {}) {
	assertNewDestination(destination);
	fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
	const temporaryDirectory = fs.mkdtempSync(path.join(path.dirname(destination), '.maple-migration-'));
	const temporaryFile = path.join(temporaryDirectory, 'database.sqlite');
	let database;
	try {
		fs.closeSync(fs.openSync(temporaryFile, 'wx', 0o600));
		database = new DatabaseSync(temporaryFile);
		database.exec('PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; BEGIN IMMEDIATE;');
		database.exec(schema);
		const report = await populate(database);
		database.exec('COMMIT');
		database.close();
		database = undefined;
		database = new DatabaseSync(temporaryFile, { readOnly: true });
		validateSchema(database);
		const integrity = database.prepare('PRAGMA integrity_check').all();
		if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
			throw new Error('SQLite integrity check failed.');
		}
		verify(database, report);
		database.close();
		database = undefined;
		assertNewDestination(destination);
		fs.linkSync(temporaryFile, destination);
		return report;
	} finally {
		if (database) database.close();
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
}

module.exports = { assertNewDestination, createFile };
