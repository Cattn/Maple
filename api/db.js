const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { openDatabase } = require('./storage/sqlite');
const { databasePath } = require('./storage/config');

// Require an existing database so a path typo cannot silently hide accounts.
module.exports = openDatabase(databasePath());
