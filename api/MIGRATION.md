# Account migration and database upgrades

See the [API README](README.md) for installation, local development, and storage backups.

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
npm run build
```

`mysql2` is a development dependency used only by the migration tool. Normal API
startup never imports it. Production can use `npm ci --omit=dev` after migration.

Add migration settings to `api/.env`, using `.env.example` as a reference. Keep
your existing `BETTER_AUTH_SECRET`. Configure `MYSQL_HOST`, `MYSQL_PORT`,
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

The MySQL importer produces a legacy SQLite database. Inspect it and upgrade it to
a separate new file before starting the current API:

```sh
npm run db:preflight -- --source /your/private/data/maple-rehearsal.sqlite
npm run db:upgrade -- --source /your/private/data/maple-rehearsal.sqlite --output /your/private/data/maple-rehearsal-upgraded.sqlite
```

Resolve any blocking ambiguous identities reported by preflight before upgrading.
Upgrade refuses existing destinations and leaves the source unchanged.

### Final cutover

1. Stop every instance of the old API and any other process writing to these
   MySQL tables. Leave MySQL running for the read-only export. Keep writes stopped
   until the new API is verified; there is no continuous replication.
2. Run the migration again with a new final filename:

   ```sh
   npm run db:migrate:mysql -- --output /your/private/data/maple-production.sqlite
   ```

3. Check the successful integrity report and row counts. Run `db:preflight` and
   `db:upgrade` as above on the final import, using a new output filename. Set
   `SQLITE_PATH` in `api/.env` or the service environment to the **upgraded** file.
   Keep `BETTER_AUTH_SECRET` unchanged across restarts.
4. Ensure the API service user owns the database and can write to its parent
   directory. New files use mode `0600`; adjust ownership yourself if the migration
   ran as a different user.
5. Deploy the built code and start the API with `npm start`. Existing accounts
   must enroll an email address to complete migration to Better Auth. Check this flow,
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

The MySQL import preserves the original lack of unique constraints on `users.id`,
`users.username`, and relationship pairs. The required SQLite upgrade adds unique
case-insensitive indexes on user IDs and usernames, Better Auth tables, and
listening visibility and artwork fields. Ambiguous identities block the upgrade;
they are not automatically merged or discarded. Relationship pairs remain
non-unique, and `live_status.user_id` remains unique. Legacy date/time columns retain
their original strings without timezone conversion. JSON is stored as text and
decoded for API responses.

For an existing SQLite installation, build the API, stop its writers, back up the
database, and use `db:preflight` and `db:upgrade` with its current file as `--source`.
Set `SQLITE_PATH` to the new upgraded file before restarting. Do not run `db:init`.

