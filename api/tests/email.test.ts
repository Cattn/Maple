import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmailSender, resetPasswordEmail, verificationEmail } from '../auth/email.js';
import { loadConfig } from '../config.js';
import { testEnv } from './harness.js';

const message = { to: 'person@example.test', subject: 'Subject', text: 'Body' };

test('sends through the Resend HTTPS API with an injected request function', async () => {
	const calls: { url: string; init: RequestInit | undefined }[] = [];
	const send = createEmailSender(
		{ apiKey: 're_key', from: 'Maple <a@example.test>' },
		async (url, init) => {
			calls.push({ url: String(url), init });
			return new Response('{}', { status: 200 });
		}
	);
	await send(message);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.url, 'https://api.resend.com/emails');
	assert.equal(calls[0]?.init?.method, 'POST');
	assert.deepEqual(calls[0]?.init?.headers, {
		authorization: 'Bearer re_key',
		'content-type': 'application/json'
	});
	assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
		from: 'Maple <a@example.test>',
		to: ['person@example.test'],
		subject: 'Subject',
		text: 'Body'
	});
});

test('reports delivery failures without secrets or addresses', async () => {
	const send = createEmailSender(
		{ apiKey: 're_secret', from: 'a@example.test' },
		async () => new Response('person@example.test re_secret', { status: 422 })
	);
	await assert.rejects(send(message), (error: unknown) => {
		assert.ok(error instanceof Error);
		assert.equal(error.message, 'Email delivery failed with status 422.');
		return true;
	});
	await assert.rejects(createEmailSender(undefined)(message), /not configured/);
});

test('disabled delivery makes no Resend request even when credentials are configured', async () => {
	const config = loadConfig({ ...testEnv, EMAIL_DELIVERY_ENABLED: 'false' }, false);
	let requests = 0;
	const send = createEmailSender(config.email, async () => {
		requests++;
		return new Response('{}', { status: 200 });
	});
	await assert.rejects(send(message), /disabled/);
	assert.equal(requests, 0);
});

test('builds verification and reset messages around the given link', () => {
	const link = 'https://api.maple.music/api/auth/verify-email?token=t';
	assert.ok(verificationEmail('a@example.test', link).text.includes(link));
	assert.equal(resetPasswordEmail('a@example.test', link).to, 'a@example.test');
});
