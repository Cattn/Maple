import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createMaple } from '../app.js';
import type { SendEmail } from '../auth/email.js';
import { loadConfig } from '../config.js';
import { createFile } from '../storage/create-file.js';
import { openDatabase, type Database } from '../storage/sqlite.js';

const prefix = 'maple-preview-';
const host = '127.0.0.1';
const port = 3000;
const legacy = { username: 'legacy', password: 'LegacyPreview1' };

const printEmail: SendEmail = async ({ to, subject, text }) => {
	console.log(`\n[PREVIEW] Email to ${to}: ${subject}\n${text}\n`);
};

function describe(error: Error) {
	return 'code' in error && error.code === 'EADDRINUSE'
		? `Port ${port} is already in use. Stop the other API server and try again.`
		: error.message;
}

async function assertPortFree() {
	for (const address of [host, '::1']) {
		await new Promise<void>((resolve, reject) => {
			const probe = net.createServer();
			probe.once('error', (error) => {
				if (
					address === '::1' &&
					'code' in error &&
					['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(String(error.code))
				)
					resolve();
				else reject(error);
			});
			probe.listen(port, address, () =>
				probe.close((error) => (error ? reject(error) : resolve()))
			);
		});
	}
}

function removeOwnedDirectory(directory: string) {
	const stats = fs.lstatSync(directory, { throwIfNoEntry: false });
	if (!stats) return;
	const owned =
		stats.isDirectory() &&
		!stats.isSymbolicLink() &&
		path.basename(directory).startsWith(prefix) &&
		path.dirname(fs.realpathSync(directory)) === fs.realpathSync(os.tmpdir());
	if (!owned) throw new Error(`Refusing to remove unexpected path: ${directory}`);
	fs.rmSync(directory, { recursive: true, force: true });
}

async function main() {
	await assertPortFree();
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	let db: Database | undefined;
	const cleanup = () => {
		db?.close();
		db = undefined;
		removeOwnedDirectory(directory);
	};
	try {
		const databasePath = path.join(directory, 'maple.sqlite');
		await createFile(databasePath, (database) => {
			database
				.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)')
				.run(randomUUID(), legacy.username, bcrypt.hashSync(legacy.password, 10));
		});
		const config = loadConfig(
			{
				BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
				SQLITE_PATH: databasePath,
				PORT: String(port)
			},
			true
		);
		db = openDatabase(config.databasePath);
		const { server, io } = createMaple(config, db, printEmail);

		let stopping = false;
		const stop = (code: number) => {
			if (stopping) return;
			stopping = true;
			io.close(() => {
				cleanup();
				console.log('[PREVIEW] Stopped and deleted the preview database.');
				process.exitCode = code;
			});
			server.closeAllConnections();
		};
		for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
			process.once(signal, () => stop(0));
		}
		server.once('error', (error) => {
			console.error(`[PREVIEW] Server error: ${describe(error)}`);
			stop(1);
		});
		server.listen(port, host, () => {
			console.log(`[PREVIEW] Disposable API running at ${config.apiURL} for ${config.frontendURL}`);
			console.log(`[PREVIEW] Temporary database: ${databasePath}`);
			console.log(`[PREVIEW] Legacy account: ${legacy.username} / ${legacy.password}`);
			console.log('[PREVIEW] Emails are printed here, not sent. Press Ctrl+C to stop.');
		});
	} catch (error) {
		cleanup();
		throw error;
	}
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? describe(error) : String(error);
	console.error(`[PREVIEW] Startup failed: ${message}`);
	process.exitCode = 1;
});
