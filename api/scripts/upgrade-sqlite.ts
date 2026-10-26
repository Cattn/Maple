import { parseArgs } from 'node:util';
import { upgradeFile } from '../storage/upgrade.js';

async function main() {
	const { values } = parseArgs({
		options: { source: { type: 'string' }, output: { type: 'string' } }
	});
	if (!values.source || !values.output) {
		throw new Error(
			'Pass --source /path/to/current.sqlite --output /path/to/new.sqlite. Existing files are never replaced.'
		);
	}
	const result = await upgradeFile(values.source, values.output);
	console.log(JSON.stringify({ integrity: 'ok', ...result }, null, 2));
	console.log(
		'Upgrade verified. The source was read only. Stop the API before upgrading, then point SQLITE_PATH at the new file.'
	);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Upgrade failed: ${message} No existing file was replaced.`);
	process.exitCode = 1;
});
