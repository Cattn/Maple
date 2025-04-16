const mysql = require('mysql2');

const pool = mysql.createPool({
	host: 'localhost',
	user: 'root',
	password: 'admin',
	database: 'maple_auth',
	connectionLimit: 10,
	waitForConnections: true,
	queueLimit: 0
});

pool.getConnection((err, connection) => {
	if (err) {
		if (err.code === 'PROTOCOL_CONNECTION_LOST') {
			console.error('Database connection was closed.');
		}
		if (err.code === 'ER_CON_COUNT_ERROR') {
			console.error('Database has too many connections.');
		}
		if (err.code === 'ECONNREFUSED') {
			console.error('Database connection was refused.');
		}
		if (err.code === 'ER_ACCESS_DENIED_ERROR') {
			console.error('Access denied for user root@localhost');
		}
		return;
	}
	connection.release();
});

pool.on('error', (err) => {
	if (err.code === 'PROTOCOL_CONNECTION_LOST') {
		console.error('Database connection was closed.');
	}
	if (err.code === 'ER_CON_COUNT_ERROR') {
		console.error('Database has too many connections.');
	}
	if (err.code === 'ECONNREFUSED') {
		console.error('Database connection was refused.');
	}
});

module.exports = pool;
