const path = require('node:path');

function databasePath() {
	const configured = process.env.SQLITE_PATH || 'data/maple.sqlite';
	// Relative paths are always relative to api/, regardless of the working directory.
	return path.resolve(__dirname, '..', configured);
}

module.exports = { databasePath };
