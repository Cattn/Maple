const { tables } = require('./sqlite');

// This module is used only by the operator-run migration, never by the API.
async function openSource(options, createConnection = require('mysql2').createConnection) {
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
		const [actualTables] = await client.query(
			'SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
		);
		if (actualTables.length !== Object.keys(tables).length || actualTables.some(row => !Object.hasOwn(tables, row.TABLE_NAME) || row.ENGINE !== 'InnoDB')) {
			throw new Error('Expected exactly the four Maple InnoDB tables. Schema differs from the supplied dump.');
		}
		for (const [table, columns] of Object.entries(tables)) {
			const [actual] = await client.query(
				'SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [table]
			);
			if (JSON.stringify(actual.map(row => row.COLUMN_NAME)) !== JSON.stringify(columns) || actual.some(row => {
				const expected = ['pfp', 'albumArt'].includes(row.COLUMN_NAME) ? 'mediumblob'
					: row.COLUMN_NAME === 'playing' ? 'json'
						: ['creation_date', 'last_login'].includes(row.COLUMN_NAME) ? 'datetime' : 'varchar';
				return row.DATA_TYPE !== expected;
			})) throw new Error(`Unexpected MySQL schema for ${table}; migration stopped.`);
		}
	} catch (error) {
		connection.destroy();
		throw error;
	}
	return {
		count: async table => {
			const [[row]] = await client.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
			const count = Number(row.count);
			if (!Number.isSafeInteger(count)) throw new Error('Source row count exceeds safe integer range.');
			return count;
		},
		rows: (table, columns) => connection.query(`SELECT ${columns.map(c => `\`${c}\``).join(', ')} FROM \`${table}\``).stream({ highWaterMark: 16 }),
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

module.exports = { openSource };
