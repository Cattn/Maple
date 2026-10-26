const { createHash } = require('node:crypto');
const { tables } = require('./sqlite');
const { createFile } = require('./create-file');

function digestRow(digest, values) {
	// Encode types and row boundaries, so NULL, empty BLOB and empty TEXT differ.
	digest.update(JSON.stringify(values.map(value => {
		if (value === null) return ['null'];
		if (value instanceof Uint8Array) return ['blob', Buffer.from(value).toString('base64')];
		if (typeof value === 'string') return ['text', value];
		throw new Error('Unexpected source value type; refusing a potentially lossy conversion.');
	})) + '\n');
}

async function importSnapshot(source, destination, { allowEmpty = false } = {}) {
	return createFile(destination, async database => {
		const report = {};
		for (const [table, columns] of Object.entries(tables)) {
			const expectedCount = await source.count(table);
			const insert = database.prepare(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
			const digest = createHash('sha256');
			let count = 0;
			for await (const row of source.rows(table, columns)) {
				const values = columns.map(column => row[column]);
				digestRow(digest, values);
				insert.run(...values);
				count++;
			}
			if (count !== expectedCount) throw new Error(`Source row count changed for ${table}.`);
			report[table] = { rows: count, sha256: digest.digest('hex') };
		}
		if (report.users.rows === 0 && !allowEmpty) {
			throw new Error('The source has no users. Check MYSQL_DATABASE, or explicitly pass --allow-empty.');
		}
		return report;
	}, (database, report) => {
		for (const [table, columns] of Object.entries(tables)) {
			const digest = createHash('sha256');
			let count = 0;
			for (const row of database.prepare(`SELECT ${columns.map(c => `"${c}"`).join(', ')} FROM "${table}" ORDER BY rowid`).iterate()) {
				digestRow(digest, columns.map(column => row[column]));
				count++;
			}
			if (count !== report[table].rows || digest.digest('hex') !== report[table].sha256) {
				throw new Error(`Read-back verification failed for ${table}.`);
			}
		}
	});
}

module.exports = { importSnapshot };
