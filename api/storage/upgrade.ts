import { accessSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { assertNewDestination } from './create-file.js';
import { importSnapshot, type Source } from './import.js';
import { preflight } from './preflight.js';
import { currentVersion } from './schema.js';

export function inspectFile(filename: string) {
	accessSync(filename);
	const database = new DatabaseSync(filename, { readOnly: true });
	try {
		database.exec('BEGIN');
		return preflight(database);
	} finally {
		database.close();
	}
}

export async function upgradeFile(sourceFile: string, destination: string) {
	const source = path.resolve(sourceFile);
	destination = path.resolve(destination);
	accessSync(source);
	let outputPath = destination;
	try {
		outputPath = path.join(realpathSync(path.dirname(destination)), path.basename(destination));
	} catch (error) {
		if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
	}
	const key = (filename: string) =>
		process.platform === 'win32' ? filename.toLowerCase() : filename;
	if (
		[source, realpathSync(source)].some((filename) =>
			['', '-wal', '-shm', '-journal'].some((suffix) => key(filename + suffix) === key(outputPath))
		)
	) {
		throw new Error('The output must be a new file, not the source or its sidecar files.');
	}
	assertNewDestination(destination);
	const database = new DatabaseSync(source, { readOnly: true });
	try {
		database.exec('BEGIN');
		const report = preflight(database);
		if (report.version === currentVersion) {
			throw new Error(`Source is already at schema version ${currentVersion}; nothing to upgrade.`);
		}
		if (report.blocking.length > 0) {
			throw new Error(`Upgrade blocked by ambiguous identities: ${report.blocking.join(', ')}.`);
		}
		const snapshot: Source = {
			count: async (table) =>
				Number(database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get()?.count),
			rows: async function* (table, columns) {
				yield* database
					.prepare(
						`SELECT ${columns.map((column) => `"${column}"`).join(', ')} FROM "${table}" ORDER BY rowid`
					)
					.iterate();
			},
			close: async () => {}
		};
		const tables = await importSnapshot(snapshot, destination, {
			allowEmpty: true,
			version: currentVersion,
			sourceVersion: report.version
		});
		return { preflight: report, tables };
	} finally {
		database.close();
	}
}
