const path = require('node:path');
const { parseArgs } = require('node:util');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { databasePath } = require('../storage/config');
const { createFile } = require('../storage/create-file');

async function main() {
	const { values } = parseArgs({ options: { output: { type: 'string' } } });
	const destination = values.output ? path.resolve(values.output) : databasePath();
	await createFile(destination);
	console.log(`Created empty SQLite database: ${destination}`);
}

main().catch(error => {
	console.error(`Initialization failed: ${error.message}`);
	process.exitCode = 1;
});
