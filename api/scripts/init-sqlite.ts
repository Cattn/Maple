import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from '../config.js';
import { databasePath } from '../storage/config.js';
import { createFile } from '../storage/create-file.js';

async function main() {
	loadEnv();
	const { values } = parseArgs({ options: { output: { type: 'string' } } });
	const destination = values.output
		? path.resolve(values.output)
		: databasePath(process.env.SQLITE_PATH);
	await createFile(destination, () => undefined);
	console.log(`Created empty SQLite database: ${destination}`);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Initialization failed: ${message}`);
	process.exitCode = 1;
});
