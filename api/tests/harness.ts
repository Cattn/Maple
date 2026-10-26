import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { createMaple } from '../app.js';
import type { Email } from '../auth/email.js';
import { loadConfig, type Config } from '../config.js';
import { createFile } from '../storage/create-file.js';
import { openDatabase } from '../storage/sqlite.js';
import { isRecord } from '../types/record.js';

export const origin = 'https://play.maple.music';
export const strongPassword = 'MapleSecret';

export const testEnv = {
	EMAIL_DELIVERY_ENABLED: 'true',
	BETTER_AUTH_SECRET: 'test-secret-that-is-long-enough-for-better-auth',
	RESEND_API_KEY: 're_test_never_used',
	EMAIL_FROM: 'Maple <noreply@example.test>'
};

export class Mailbox {
	messages: Email[] = [];
	failing = false;

	send = async (email: Email) => {
		if (this.failing) throw new Error('Synthetic delivery failure');
		this.messages.push(email);
	};

	link(to: string) {
		const message = this.messages.findLast((email) => email.to === to);
		const url = message?.text.match(/https?:\/\/\S+/)?.[0];
		assert.ok(url, `No link sent to ${to}`);
		return new URL(url);
	}
}

export class Client {
	private readonly cookies = new Map<string, string>();

	constructor(private readonly base: string) {}

	get cookie() {
		return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
	}

	setCookie(name: string, value: string) {
		this.cookies.set(name, value);
	}

	async request(target: string | URL, init: RequestInit = {}) {
		const url = new URL(target, this.base);
		const response = await fetch(new URL(url.pathname + url.search, this.base), {
			redirect: 'manual',
			...init,
			headers: { origin, cookie: this.cookie, ...init.headers }
		});
		for (const header of response.headers.getSetCookie()) {
			const [pair = '', ...attributes] = header.split(';');
			const index = pair.indexOf('=');
			const name = pair.slice(0, index).trim();
			const value = pair.slice(index + 1).trim();
			const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
			if (!value || expired) this.cookies.delete(name);
			else this.cookies.set(name, value);
		}
		return response;
	}

	post(target: string, body: unknown = {}) {
		return this.request(target, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	}

	socket() {
		return connect(this.base, {
			reconnection: false,
			extraHeaders: { cookie: this.cookie, origin }
		});
	}
}

export async function json(response: Response) {
	const body: unknown = await response.json();
	assert.ok(isRecord(body));
	return body;
}

export function next(socket: Socket, event: string) {
	return new Promise<unknown>((resolve) => socket.once(event, resolve));
}

export async function startMaple(
	adjust: (config: Config) => Config = (config) => config,
	populate: (db: ReturnType<typeof openDatabase>) => void = () => {}
) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maple-auth-test-'));
	const file = path.join(directory, 'maple.sqlite');
	await createFile(file, () => undefined);
	const db = openDatabase(file);
	populate(db);
	const mailbox = new Mailbox();
	const config = adjust(loadConfig({ ...testEnv, SQLITE_PATH: file }, false));
	const maple = createMaple(config, db, mailbox.send);
	maple.server.listen(0, '127.0.0.1');
	await once(maple.server, 'listening');
	const address: AddressInfo | string | null = maple.server.address();
	assert.ok(address && typeof address === 'object');
	const base = `http://127.0.0.1:${address.port}`;
	return {
		base,
		db,
		mailbox,
		maple,
		client: () => new Client(base),
		close: async () => {
			await maple.io.close();
			db.close();
			fs.rmSync(directory, { recursive: true, force: true });
		}
	};
}

export type Harness = Awaited<ReturnType<typeof startMaple>>;

export async function verifiedAccount(harness: Harness, username: string, email: string) {
	const client = harness.client();
	const signup = await client.post('/api/auth/sign-up/email', {
		username,
		email,
		password: strongPassword,
		name: username
	});
	assert.equal(signup.status, 200, JSON.stringify(await signup.clone().json()));
	const verified = await client.request(harness.mailbox.link(email));
	assert.equal(verified.status, 302);
	const id = harness.db.all('SELECT id FROM users WHERE username = ?', [username])[0]?.id;
	assert.equal(typeof id, 'string');
	return { client, id: String(id) };
}
