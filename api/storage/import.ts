import { createHash, type Hash } from 'node:crypto';
import { isRecord } from '../types/record.js';
import { tablesAt, type Column } from './schema.js';
import { createFile } from './create-file.js';

type Cell = null | string | number | Uint8Array;

export interface TableReport {
	rows: number;
	sha256: string;
}

export interface Source {
	count(table: string): Promise<number>;
	rows(table: string, columns: string[]): AsyncIterable<unknown>;
	close(): Promise<void>;
}

function cell(value: unknown, column: Column): Cell {
	if (value === null || typeof value === 'string') return value;
	if (column.integer && Number.isSafeInteger(value)) return Number(value);
	if (value instanceof Uint8Array) return Buffer.from(value);
	throw new Error('Unexpected source value type; refusing a potentially lossy conversion.');
}

function digestRow(digest: Hash, values: Cell[]) {
	// Encode types and row boundaries, so NULL, empty BLOB and empty TEXT differ.
	const encoded = values.map((value) => {
		if (value === null) return ['null'];
		if (typeof value === 'string') return ['text', value];
		if (typeof value === 'number') return ['integer', value];
		return ['blob', Buffer.from(value).toString('base64')];
	});
	digest.update(JSON.stringify(encoded) + '\n');
}

function quote(columns: Column[]) {
	return columns.map(({ name }) => `"${name}"`).join(', ');
}

export async function importSnapshot(
	source: Source,
	destination: string,
	{
		allowEmpty = false,
		version = 1,
		sourceVersion = 1
	}: { allowEmpty?: boolean; version?: number; sourceVersion?: number } = {}
) {
	const tables = tablesAt(sourceVersion);
	return createFile(
		destination,
		async (database) => {
			const report: Record<string, TableReport> = {};
			for (const [table, columns] of Object.entries(tables)) {
				const expectedCount = await source.count(table);
				const placeholders = columns.map(() => '?').join(', ');
				const insert = database.prepare(
					`INSERT INTO "${table}" (${quote(columns)}) VALUES (${placeholders})`
				);
				const digest = createHash('sha256');
				let count = 0;
				for await (const row of source.rows(
					table,
					columns.map(({ name }) => name)
				)) {
					if (!isRecord(row)) throw new Error(`Unexpected source row for ${table}.`);
					const values = columns.map((column) => cell(row[column.name], column));
					digestRow(digest, values);
					insert.run(...values);
					count++;
				}
				if (count !== expectedCount) throw new Error(`Source row count changed for ${table}.`);
				report[table] = { rows: count, sha256: digest.digest('hex') };
			}
			if (report.users?.rows === 0 && !allowEmpty) {
				throw new Error(
					'The source has no users. Check MYSQL_DATABASE, or explicitly pass --allow-empty.'
				);
			}
			return report;
		},
		(database, report) => {
			for (const [table, columns] of Object.entries(tables)) {
				const digest = createHash('sha256');
				let count = 0;
				const rows = database
					.prepare(`SELECT ${quote(columns)} FROM "${table}" ORDER BY rowid`)
					.iterate();
				for (const row of rows) {
					digestRow(
						digest,
						columns.map((column) => cell(row[column.name], column))
					);
					count++;
				}
				const expected = report[table];
				if (!expected || count !== expected.rows || digest.digest('hex') !== expected.sha256) {
					throw new Error(`Read-back verification failed for ${table}.`);
				}
			}
		},
		version,
		sourceVersion
	);
}
