import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadEnv } from '../config.js';
import { isRecord } from '../types/record.js';
import { openSource } from '../storage/mysql-source.js';
import { importSnapshot } from '../storage/import.js';
import { assertNewDestination } from '../storage/create-file.js';

async function main() {
	loadEnv();
	const { values } = parseArgs({
		options: {
			output: { type: 'string' },
			'allow-empty': { type: 'boolean', default: false }
		}
	});
	if (!values.output) {
		throw new Error(
			'Pass --output /absolute/path/to/new.sqlite. Existing files are never replaced.'
		);
	}
	const destination = path.resolve(values.output);
	assertNewDestination(destination);
	for (const key of ['MYSQL_USER', 'MYSQL_DATABASE']) {
		if (!process.env[key]) throw new Error(`${key} must be set in api/.env or the environment.`);
	}
	const port = Number(process.env.MYSQL_PORT || 3306);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('MYSQL_PORT must be a valid port.');
	}
	const { MYSQL_SOCKET, MYSQL_SSL_CA } = process.env;
	const source = await openSource({
		host: process.env.MYSQL_HOST || '127.0.0.1',
		port,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD,
		database: process.env.MYSQL_DATABASE,
		...(MYSQL_SOCKET ? { socketPath: MYSQL_SOCKET } : {}),
		...(MYSQL_SSL_CA
			? { ssl: { ca: readFileSync(MYSQL_SSL_CA, 'utf8'), rejectUnauthorized: true } }
			: {})
	});
	try {
		const report = await importSnapshot(source, destination, {
			allowEmpty: values['allow-empty']
		});
		console.log(JSON.stringify({ destination, integrity: 'ok', tables: report }, null, 2));
		console.log(
			'Migration verified. MySQL was read only. Run db:preflight and db:upgrade on this file before configuring SQLITE_PATH.'
		);
	} finally {
		await source.close();
	}
}

main().catch((error: unknown) => {
	const details: Record<string, unknown> = isRecord(error) ? error : {};
	// Do not log SQL, rows, connection options, passwords or account data.
	console.error(
		`Migration failed (${String(details.code || details.name)}). No existing destination was replaced. Check the source schema, connection settings, and destination permissions.`
	);
	if (!details.sql && !details.sqlMessage) console.error(details.message);
	process.exitCode = 1;
});
