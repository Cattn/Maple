import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from '../config.js';
import { databasePath } from '../storage/config.js';
import { inspectFile } from '../storage/upgrade.js';

function main() {
	loadEnv();
	const { values } = parseArgs({ options: { source: { type: 'string' } } });
	const source = values.source
		? path.resolve(values.source)
		: databasePath(process.env.SQLITE_PATH);
	const report = inspectFile(source);
	console.log(JSON.stringify(report, null, 2));
	if (report.blocking.length > 0) {
		console.error(`Upgrade blocked by ambiguous identities: ${report.blocking.join(', ')}.`);
		process.exitCode = 1;
	} else if (report.nonconformingUsernames > 0) {
		console.log('Nonconforming usernames are kept and must be handled during enrollment.');
	}
}

try {
	main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Preflight failed: ${message}`);
	process.exitCode = 1;
}
