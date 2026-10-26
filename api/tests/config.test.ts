import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { apiRoot, databasePath } from '../storage/config.js';
import { testEnv } from './harness.js';

const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devEnv = { BETTER_AUTH_SECRET: testEnv.BETTER_AUTH_SECRET };

test('relative database paths resolve under api/', () => {
	assert.equal(apiRoot, expectedRoot);
	assert.equal(databasePath(''), path.join(expectedRoot, 'data', 'maple.sqlite'));
	assert.equal(databasePath('other/x.sqlite'), path.join(expectedRoot, 'other', 'x.sqlite'));
	const absolute = path.resolve('/tmp/maple.sqlite');
	assert.equal(databasePath(absolute), absolute);
});

test('production config keeps public origins, passkey RP and rate limiting', () => {
	const config = loadConfig({ ...testEnv, SQLITE_PATH: 'db.sqlite' }, false);
	assert.equal(config.port, 3000);
	assert.equal(config.rateLimit, true);
	assert.equal(config.production, true);
	assert.deepEqual(config.corsOrigins, [
		'https://api.maple.music',
		'https://discord.com',
		'https://canary.discord.com',
		'https://ptb.discord.com',
		'https://play.maple.music',
		'https://beta.maple.music'
	]);
	assert.equal(JSON.stringify(config).includes('kolf'), false);
	assert.equal(config.apiURL, 'https://api.maple.music');
	assert.equal(config.frontendURL, 'https://play.maple.music');
	assert.deepEqual(config.trustedProxies, []);
	assert.deepEqual(config.passkey, {
		rpID: 'maple.music',
		origins: ['https://play.maple.music', 'https://beta.maple.music']
	});
	assert.deepEqual(config.email, { apiKey: testEnv.RESEND_API_KEY, from: testEnv.EMAIL_FROM });
	assert.equal(config.databasePath, path.join(expectedRoot, 'db.sqlite'));
});

test('development config allows the local frontend without rate limiting or email', () => {
	const config = loadConfig(devEnv, true);
	assert.deepEqual(config.corsOrigins, ['http://localhost:5173']);
	assert.equal(config.rateLimit, false);
	assert.equal(config.apiURL, 'http://localhost:3000');
	assert.deepEqual(config.passkey, { rpID: 'localhost', origins: ['http://localhost:5173'] });
	assert.equal(config.email, undefined);
});

test('config accepts explicit URLs, origins and passkey settings', () => {
	const config = loadConfig(
		{
			...testEnv,
			API_URL: 'https://auth.example.test/ignored',
			FRONTEND_URL: 'https://app.example.test',
			CORS_ORIGINS: 'https://app.example.test, https://other.example.test',
			PASSKEY_RP_ID: 'example.test',
			PASSKEY_ORIGINS: 'https://app.example.test',
			TRUSTED_PROXIES: 'loopback, 10.0.0.0/8'
		},
		false
	);
	assert.equal(config.apiURL, 'https://auth.example.test');
	assert.equal(config.frontendURL, 'https://app.example.test');
	assert.deepEqual(config.corsOrigins, ['https://app.example.test', 'https://other.example.test']);
	assert.deepEqual(config.passkey, { rpID: 'example.test', origins: ['https://app.example.test'] });
	assert.deepEqual(config.trustedProxies, ['loopback', '10.0.0.0/8']);
	assert.throws(() => loadConfig({ ...testEnv, API_URL: 'not a url' }, false), /API_URL/);
	assert.throws(() => loadConfig({ ...testEnv, API_URL: 'file:///tmp' }, false), /API_URL/);
});

test('config requires an auth secret and credentials for explicitly enabled delivery', () => {
	assert.throws(() => loadConfig({}, true), /BETTER_AUTH_SECRET/);
	assert.throws(() => loadConfig({ BETTER_AUTH_SECRET: 'short' }, true), /BETTER_AUTH_SECRET/);
	assert.throws(
		() => loadConfig({ TOKEN_SECRET: testEnv.BETTER_AUTH_SECRET }, true),
		/BETTER_AUTH_SECRET/
	);
	assert.equal(loadConfig(devEnv, false).email, undefined);
	assert.throws(
		() => loadConfig({ ...devEnv, EMAIL_DELIVERY_ENABLED: 'true' }, false),
		/RESEND_API_KEY and EMAIL_FROM/
	);
	assert.throws(
		() =>
			loadConfig(
				{ ...devEnv, EMAIL_DELIVERY_ENABLED: 'true', RESEND_API_KEY: testEnv.RESEND_API_KEY },
				false
			),
		/RESEND_API_KEY and EMAIL_FROM/
	);
});

test('credentials alone cannot enable email delivery', () => {
	assert.equal(
		loadConfig({ ...testEnv, EMAIL_DELIVERY_ENABLED: undefined }, false).email,
		undefined
	);
	assert.equal(loadConfig({ ...testEnv, EMAIL_DELIVERY_ENABLED: 'false' }, false).email, undefined);
	assert.throws(
		() => loadConfig({ ...testEnv, EMAIL_DELIVERY_ENABLED: 'yes' }, false),
		/EMAIL_DELIVERY_ENABLED/
	);
});

test('config accepts a deployment port and rejects invalid ports', () => {
	assert.equal(loadConfig({ ...testEnv, PORT: '8080' }, false).port, 8080);
	for (const port of ['0', '-1', '65536', '3.5', 'invalid']) {
		assert.throws(() => loadConfig({ ...testEnv, PORT: port }, false), /PORT/);
	}
});
