const path = require('node:path');
const { readFileSync } = require('node:fs');
const { parseArgs } = require('node:util');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { openSource } = require('../storage/mysql-source');
const { importSnapshot } = require('../storage/import');
const { assertNewDestination } = require('../storage/create-file');

async function main() {
	const { values } = parseArgs({ options: {
		output: { type: 'string' }, 'allow-empty': { type: 'boolean', default: false }
	} });
	if (!values.output) throw new Error('Pass --output /absolute/path/to/new.sqlite. Existing files are never replaced.');
	const destination = path.resolve(values.output);
	assertNewDestination(destination);
	for (const key of ['MYSQL_USER', 'MYSQL_DATABASE']) {
		if (!process.env[key]) throw new Error(`${key} must be set in api/.env or the environment.`);
	}
	const port = Number(process.env.MYSQL_PORT || 3306);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MYSQL_PORT must be a valid port.');
	const source = await openSource({
		host: process.env.MYSQL_HOST || '127.0.0.1', port,
		user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
		database: process.env.MYSQL_DATABASE,
		...(process.env.MYSQL_SOCKET ? { socketPath: process.env.MYSQL_SOCKET } : {}),
		...(process.env.MYSQL_SSL_CA ? { ssl: { ca: readFileSync(process.env.MYSQL_SSL_CA, 'utf8'), rejectUnauthorized: true } } : {})
	});
	try {
		const report = await importSnapshot(source, destination, { allowEmpty: values['allow-empty'] });
		console.log(JSON.stringify({ destination, integrity: 'ok', tables: report }, null, 2));
		console.log('Migration verified. MySQL was read only. Configure SQLITE_PATH to use this file.');
	} finally {
		await source.close();
	}
}

main().catch(error => {
	// Do not log SQL, rows, connection options, passwords or account data.
	console.error(`Migration failed (${error.code || error.name}). No existing destination was replaced. Check the source schema, connection settings, and destination permissions.`);
	if (!error.sql && !error.sqlMessage) console.error(error.message);
	process.exitCode = 1;
});
