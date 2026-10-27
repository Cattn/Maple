import mysql, { type ConnectionOptions } from 'mysql2';
import { isRecord } from '../types/record.js';
import { tables } from './schema.js';
import type { Source } from './import.js';

function records(value: unknown) {
	if (!Array.isArray(value) || !value.every(isRecord)) {
		throw new Error('Unexpected MySQL response; migration stopped.');
	}
	return value;
}

function expectedType(column: unknown) {
	if (column === 'pfp' || column === 'albumArt') return 'mediumblob';
	if (column === 'playing') return 'json';
	if (column === 'creation_date' || column === 'last_login') return 'datetime';
	return 'varchar';
}

// This module is used only by the operator-run migration, never by the API.
export async function openSource(
	options: ConnectionOptions,
	createConnection = mysql.createConnection
): Promise<Source> {
	const connection = createConnection({
		...options,
		charset: 'utf8mb4',
		dateStrings: true,
		jsonStrings: true,
		multipleStatements: false
	});
	const client = connection.promise();
	try {
		await client.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
		// MySQL snapshot/access-mode syntax:
		// https://dev.mysql.com/doc/refman/8.0/en/commit.html
		await client.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
		const [tableResult] = await client.query(
			'SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
		);
		const actualTables = records(tableResult);
		if (
			actualTables.length !== Object.keys(tables).length ||
			actualTables.some(
				(row) =>
					typeof row.TABLE_NAME !== 'string' ||
					!Object.hasOwn(tables, row.TABLE_NAME) ||
					row.ENGINE !== 'InnoDB'
			)
		) {
			throw new Error(
				'Expected exactly the four Maple InnoDB tables. Schema differs from the supplied dump.'
			);
		}
		for (const [table, columns] of Object.entries(tables)) {
			const [columnResult] = await client.query(
				'SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
				[table]
			);
			const actual = records(columnResult);
			if (
				JSON.stringify(actual.map((row) => row.COLUMN_NAME)) !== JSON.stringify(columns) ||
				actual.some((row) => row.DATA_TYPE !== expectedType(row.COLUMN_NAME))
			) {
				throw new Error(`Unexpected MySQL schema for ${table}; migration stopped.`);
			}
		}
	} catch (error) {
		connection.destroy();
		throw error;
	}
	return {
		count: async (table) => {
			const [result] = await client.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
			const count = Number(records(result)[0]?.count);
			if (!Number.isSafeInteger(count)) {
				throw new Error('Source row count exceeds safe integer range.');
			}
			return count;
		},
		rows: (table, columns) =>
			connection
				.query(`SELECT ${columns.map((column) => `\`${column}\``).join(', ')} FROM \`${table}\``)
				.stream({ highWaterMark: 16 }),
		close: async () => {
			try {
				// End the read-only snapshot; there is nothing to commit to MySQL.
				await client.query('ROLLBACK');
				await client.end();
			} finally {
				connection.destroy();
			}
		}
	};
}
