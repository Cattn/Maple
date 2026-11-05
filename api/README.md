# Account API and SQLite

The API stores accounts, friendships, pending requests, and live status in SQLite.
Music libraries remain on the client. Node.js **22.13 or later** is required.
SQLite uses Node's built-in `node:sqlite` module, so no SQLite npm driver or
database server is needed.

`SQLITE_PATH` selects the database. An absolute path is recommended in production;
relative paths resolve under `api/`, even when launching from the repository root.
The default is `api/data/maple.sqlite`. The API requires an existing, versioned
database and fails at startup if it is missing or incompatible.

## Local development testing

Use Node.js **22.13 or later**. For a disposable local setup, run these commands
from the repository root in two terminals.

Terminal 1 (API):

```sh
cd api
npm ci --include=dev
npm run preview
```

Terminal 2 (frontend, from the repository root):

```sh
npm ci --include=dev
npm run dev -- --port 5173 --strictPort
```

Open **http://localhost:5173**. The API runs at **http://localhost:3000**.
Register a test account and open the verification link printed in the API terminal.
Password reset emails also print there. To test legacy enrollment, sign in with
username `legacy` and password `LegacyPreview1`, then follow the enrollment flow.

API preview generates its own secret and temporary database; no `.env`, build,
MySQL, or email service is needed. Ctrl+C stops it and deletes its database.
Stop any other API on port 3000 first. Use `localhost` consistently, and remove any
frontend `PUBLIC_API_URL` override pointing to a remote API.

For persistent local data, follow the installation steps below once, then run
`npm run dev` from `api/` alongside the frontend. Keep the local URL defaults in
`api/.env`. This mode needs real email delivery settings for verification and
password resets; use API preview for testing those flows without sending emails.

## New installation without existing accounts

From `api/`:

```sh
npm ci --include=dev
npm run build
cp .env.example .env
```

Generate a private `BETTER_AUTH_SECRET` (works in PowerShell and Unix shells):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Copy the output into `api/.env`:

```dotenv
BETTER_AUTH_SECRET=paste-generated-value-here
```

Keep this value private and reuse it across restarts. Set the desired `SQLITE_PATH`, then:

```sh
npm run db:init
npm start
```

`npm run dev` starts the development API. Initialization refuses existing files.
**Do not initialize an empty database when migrating existing accounts.**

`npm start` and the `db:*` commands run compiled files under `dist/`. Run
`npm run build` after installing dependencies and whenever the API source changes.
The build requires development dependencies; production can omit them after building.

For production email verification and password resets, set `EMAIL_DELIVERY_ENABLED=true`,
`RESEND_API_KEY`, and `EMAIL_FROM` in `.env`. Check the public URLs, CORS, and passkey
settings in `.env.example` for your deployment.

## Migrating existing accounts

See [MIGRATION.md](MIGRATION.md) for MySQL migration, SQLite upgrades, compatibility,
and rollback instructions.

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
