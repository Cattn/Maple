import path from 'node:path';
import dotenv from 'dotenv';
import { apiRoot, databasePath } from './storage/config.js';

const productionOrigins = [
	'https://api.maple.music',
	'https://discord.com',
	'https://canary.discord.com',
	'https://ptb.discord.com',
	'https://play.maple.music',
	'https://beta.maple.music'
];

const productionPasskeyOrigins = ['https://play.maple.music', 'https://beta.maple.music'];
export const clientIPHeader = 'x-maple-client-ip';

export interface EmailConfig {
	apiKey: string;
	from: string;
}

export interface Config {
	port: number;
	databasePath: string;
	corsOrigins: string[];
	rateLimit: boolean;
	production: boolean;
	authSecret: string;
	apiURL: string;
	frontendURL: string;
	trustedProxies: string[];
	passkey: { rpID: string; origins: string[] };
	email: EmailConfig | undefined;
}

export function loadEnv() {
	dotenv.config({ path: path.join(apiRoot, '.env') });
}

function list(value: string | undefined) {
	return value
		?.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function url(name: string, value: string) {
	try {
		const parsed = new URL(value);
		if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
			throw new Error('Invalid URL');
		}
		return parsed.origin;
	} catch {
		throw new Error(`${name} must be an absolute URL.`);
	}
}

export function loadConfig(env: NodeJS.ProcessEnv, dev: boolean): Config {
	const authSecret = env.BETTER_AUTH_SECRET;
	if (!authSecret || authSecret.length < 32) {
		throw new Error('BETTER_AUTH_SECRET must be set to at least 32 random characters.');
	}
	const port = Number(env.PORT || 3000);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('PORT must be an integer between 1 and 65535.');
	}
	const frontendURL = url(
		'FRONTEND_URL',
		env.FRONTEND_URL || (dev ? 'http://localhost:5173' : 'https://play.maple.music')
	);
	if (
		env.EMAIL_DELIVERY_ENABLED !== undefined &&
		!['true', 'false'].includes(env.EMAIL_DELIVERY_ENABLED)
	) {
		throw new Error('EMAIL_DELIVERY_ENABLED must be true or false.');
	}
	const emailEnabled = env.EMAIL_DELIVERY_ENABLED === 'true';
	const email =
		emailEnabled && env.RESEND_API_KEY && env.EMAIL_FROM
			? { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }
			: undefined;
	if (emailEnabled && !email) {
		throw new Error('RESEND_API_KEY and EMAIL_FROM must be set when email delivery is enabled.');
	}
	return {
		port,
		databasePath: databasePath(env.SQLITE_PATH),
		corsOrigins: list(env.CORS_ORIGINS) ?? (dev ? [frontendURL] : productionOrigins),
		rateLimit: !dev,
		production: !dev,
		authSecret,
		apiURL: url(
			'API_URL',
			env.API_URL || (dev ? `http://localhost:${port}` : 'https://api.maple.music')
		),
		frontendURL,
		trustedProxies: list(env.TRUSTED_PROXIES) ?? [],
		passkey: {
			rpID: env.PASSKEY_RP_ID || (dev ? 'localhost' : 'maple.music'),
			origins: list(env.PASSKEY_ORIGINS) ?? (dev ? [frontendURL] : productionPasskeyOrigins)
		},
		email
	};
}
