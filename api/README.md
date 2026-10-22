# Account API and SQLite

The API stores accounts, friendships, pending requests, and live status in SQLite.
Music libraries remain on the client. Node.js **22.13 or later** is required.
SQLite uses Node's built-in `node:sqlite` module, so no SQLite npm driver or
database server is needed.

`SQLITE_PATH` selects the database. An absolute path is recommended in production;
relative paths resolve under `api/`, even when launching from the repository root.
The default is `api/data/maple.sqlite`. The API requires an existing, versioned
database and fails at startup if it is missing or incompatible.

## New installation without existing accounts

From `api/`:

```sh
npm ci
cp .env.example .env
```

Edit `.env` to set a private `TOKEN_SECRET` and the desired `SQLITE_PATH`, then:

```sh
npm run db:init
npm start
```

`npm run dev` starts the development API. Initialization refuses existing files.
**Do not initialize an empty database when migrating existing accounts.**

## Migrate existing MySQL accounts

The supplied `maple_auth-2026-10-21_224657-dump.sql` contains schema only, with no
account data. The SQLite schema in `storage/schema.sql` is based on that dump.
To transfer accounts, run the migration tool yourself against your MySQL instance.
Alternatively, restore your own full data dump into an isolated local MySQL
instance and migrate that copy.

The importer:

- Opens a read-only, repeatable-read consistent snapshot in MySQL. It issues
  session/transaction controls, metadata reads, table reads, and a final rollback.
  It never inserts, updates, deletes, or changes the MySQL schema.
- Requires exactly the four expected InnoDB tables with their expected columns
  and types. Schema differences stop migration.
- Streams rows into a private temporary SQLite database in a single transaction.
  It preserves IDs, password hashes, image bytes, JSON text, nullable values,
  date strings, and duplicate relationship rows.
- Reopens the output, runs `integrity_check`, and compares each table's count and
  SHA-256 digest against the source rows, including every column and BLOB byte.
- Publishes the new file only after verification. Existing destinations,
  symlinks, and SQLite sidecar files are refused. Failures clean the temporary
  output; an interrupted process may leave a private `.maple-migration-*` directory.
- Refuses a source with no users unless `--allow-empty` is explicitly passed.

### Prepare and rehearse

Keep a full MySQL backup, including data and binary images. The supplied
schema-only file is **not** a data backup. For example, run your own export with
a consistent snapshot and hex encoding for BLOBs:

```sh
mysqldump --single-transaction --hex-blob --no-tablespaces -u YOUR_BACKUP_USER -p maple_auth > /your/private/backup/maple_auth-full.sql
```

Use your normal backup permissions. Store the export outside the public web root
and repository; it contains password hashes and private account data.

From `api/`, install migration dependencies:

```sh
npm ci --include=dev
```

`mysql2` is a development dependency used only by the migration tool. Normal API
startup never imports it. Production can use `npm ci --omit=dev` after migration.

Add migration settings to `api/.env`, using `.env.example` as a reference. Keep
your existing `TOKEN_SECRET`. Configure `MYSQL_HOST`, `MYSQL_PORT`,
`MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` locally. Use an account with
**SELECT-only access** to `maple_auth.*`; have your database administrator provision
it separately if needed. Do not pass passwords as command-line arguments.

Unix sockets are supported with `MYSQL_SOCKET`. For a remote MySQL server,
`MYSQL_SSL_CA` enables verified TLS with your CA file.

Rehearse using a new output filename:

```sh
npm run db:migrate:mysql -- --output /your/private/data/maple-rehearsal.sqlite
```

The command prints counts and SHA-256 digests for all four tables and reports
`integrity: "ok"` after verification. Compare the counts with your expected account
totals. A failed run exits nonzero and never replaces an existing file.
Subsequent MySQL writes are not copied into the rehearsal snapshot automatically.

### Final cutover

1. Stop every instance of the old API and any other process writing to these
   MySQL tables. Leave MySQL running for the read-only export. Keep writes stopped
   until the new API is verified; there is no continuous replication.
2. Run the migration again with a new final filename:

   ```sh
   npm run db:migrate:mysql -- --output /your/private/data/maple-production.sqlite
   ```

3. Check the successful integrity report and row counts. Set `SQLITE_PATH` in
   `api/.env` or the service environment to that exact absolute filename. Keep
   `TOKEN_SECRET` unchanged to preserve existing signed login cookies.
4. Ensure the API service user owns the database and can write to its parent
   directory. New files use mode `0600`; adjust ownership yourself if the migration
   ran as a different user.
5. Deploy this code and start the API with `npm start`. Check an existing login,
   profile pictures, display names, friendships, requests, now-playing data, and
   album art. Verify account creation and deletion using disposable accounts.
   Check Unicode usernames using their exact stored spelling; see below.
6. Keep the full backup, old code, and MySQL data while verifying the deployment.
   Remove MySQL migration credentials from the API environment when finished.

You can inspect the output with the SQLite CLI or a SQLite GUI:

```sh
sqlite3 /your/private/data/maple-production.sqlite 'PRAGMA integrity_check; SELECT COUNT(*) FROM users;'
```

### Rollback

Before accepting new writes on SQLite, stop the new API and restart the old code
against the unchanged MySQL data and original secret.

After SQLite accepts writes, MySQL is stale. Stop writes, back up SQLite, and
reconcile those changes before reverting. This tool does not copy new SQLite
changes back to MySQL. Do not run both versions as writable account services.

## Compatibility

SQLite's `NOCASE` preserves ASCII case-insensitive matching, such as `Alice` and
`alice`, including ID lookups. It does not reproduce MySQL's
`utf8mb4_0900_ai_ci` Unicode/accent equivalences: `é` and `e` are distinct, and
non-ASCII case variants can be distinct. All spelling is preserved, and exact
stored usernames continue to work. Check whether users rely on alternate Unicode
spellings before cutover. New registrations follow SQLite's comparison rules.

The schema preserves the original lack of unique constraints on
`users.id`, `users.username`, and relationship pairs. It retains
`live_status.user_id` uniqueness and adds non-unique lookup indexes. Data cleanup
is not part of migration. Date/time columns retain their original strings without
timezone conversion. JSON is stored as text and decoded for API responses.

## Storage and backups

The API uses WAL, a five-second busy timeout, and full synchronous durability.
Account deletion and friend acceptance writes use synchronous transactions.
SQLite calls run on the Node event loop; monitor latency for write-heavy workloads.

Keep the database on persistent local storage outside the web root, with space
for images and WAL files. Do not use shared network storage for the WAL database
or expect separate application hosts to share it. Container deployments need a
persistent volume for the whole database directory.

Use SQLite's online backup facility or the CLI `.backup` command with a new
destination:

```sh
sqlite3 /your/private/data/maple-production.sqlite ".backup '/your/private/backup/maple-backup.sqlite'"
```

Do not copy just the main database file while the API is running: recent commits
may be in `-wal`. Never delete live `-wal` or `-shm` files. Restore a backup only
with all API processes stopped and ensure no stale sidecars remain at the restore
destination. Database files and SQL dumps are gitignored; keep backups separately.
