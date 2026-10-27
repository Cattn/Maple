import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { username, USERNAME_ERROR_CODES } from 'better-auth/plugins/username';
import { passkey } from '@better-auth/passkey';
import { NodeSqliteDialect } from '@better-auth/kysely-adapter/node-sqlite-dialect';
import type { ZodType } from 'zod';
import { clientIPHeader, type Config } from '../config.js';
import type { Database } from '../storage/sqlite.js';
import { field } from '../types/record.js';
import {
	firstIssue,
	isClaimableUsername,
	passwordLength,
	passwordSchema,
	usernameLength,
	usernameSchema
} from '../validation/account.js';
import { resetPasswordEmail, verificationEmail, type SendEmail } from './email.js';
import { findLegacyAccount, legacyEnrollment } from './legacy.js';
import { password } from './password.js';

function assertValid(schema: ZodType, value: unknown, code: string) {
	const result = schema.safeParse(value);
	if (!result.success)
		throw APIError.from('BAD_REQUEST', { code, message: firstIssue(result) ?? '' });
}

export interface AuthOptions {
	config: Config;
	db: Database;
	sendEmail: SendEmail;
	onSessionRevoked: (sessionId: string) => void;
}

export function createAuth({ config, db, sendEmail, onSessionRevoked }: AuthOptions) {
	const legacyUsernameLength = Number(
		db.all('SELECT MAX(length(username)) AS length FROM users')[0]?.length ?? usernameLength.max
	);
	return betterAuth({
		appName: 'Maple',
		baseURL: config.apiURL,
		secret: config.authSecret,
		trustedOrigins: config.corsOrigins,
		database: {
			dialect: new NodeSqliteDialect({ database: db.connection }),
			type: 'sqlite',
			transaction: false
		},
		user: { modelName: 'auth_user', changeEmail: { enabled: true } },
		session: { modelName: 'auth_session' },
		account: { modelName: 'auth_account', accountLinking: { enabled: false } },
		verification: { modelName: 'auth_verification' },
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			revokeSessionsOnPasswordReset: true,
			minPasswordLength: passwordLength.min,
			maxPasswordLength: 1024,
			password,
			sendResetPassword: ({ user, url }) => sendEmail(resetPasswordEmail(user.email, url))
		},
		emailVerification: {
			sendOnSignUp: true,
			sendOnSignIn: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: ({ user, url }) => sendEmail(verificationEmail(user.email, url)),
			afterEmailVerification: async (user) => {
				if (!user?.emailVerified) {
					throw APIError.from('BAD_REQUEST', {
						code: 'ENROLLMENT_CHANGED',
						message: 'This account changed during verification. Request a new link.'
					});
				}
			}
		},
		databaseHooks: {
			session: {
				create: {
					after: async (session) => {
						db.run('UPDATE users SET last_login = ? WHERE id = ?', [
							new Date().toISOString().slice(0, 19).replace('T', ' '),
							session.userId
						]);
					}
				},
				delete: { after: async (session) => onSessionRevoked(session.id) }
			}
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (
					[
						'/passkey/generate-register-options',
						'/passkey/verify-registration',
						'/passkey/list-user-passkeys',
						'/passkey/delete-passkey',
						'/passkey/update-passkey'
					].includes(ctx.path)
				) {
					const session = await getSessionFromCtx(ctx);
					if (!session?.user.emailVerified) {
						throw APIError.from('UNAUTHORIZED', {
							code: 'EMAIL_NOT_VERIFIED',
							message: 'Verify your email address before managing passkeys.'
						});
					}
				}
				if (
					[
						'/sign-up/email',
						'/sign-in/email',
						'/sign-in/username',
						'/send-verification-email',
						'/legacy/enroll',
						'/change-email'
					].includes(ctx.path) &&
					field(ctx.body, 'callbackURL') === undefined
				) {
					ctx.body.callbackURL = config.frontendURL;
				}
				if (ctx.path === '/request-password-reset' && field(ctx.body, 'redirectTo') === undefined) {
					ctx.body.redirectTo = `${config.frontendURL}/reset-password`;
				}
				const newPassword = field(
					ctx.body,
					ctx.path === '/sign-up/email' ? 'password' : 'newPassword'
				);
				if (ctx.path === '/sign-up/email' || newPassword !== undefined) {
					assertValid(passwordSchema, newPassword, 'PASSWORD_POLICY');
				}
				if (ctx.path === '/sign-up/email') {
					const name = field(ctx.body, 'username');
					assertValid(usernameSchema, name, USERNAME_ERROR_CODES.INVALID_USERNAME.code);
					if (db.all('SELECT 1 FROM users WHERE username = ?', [String(name)])[0]) {
						throw APIError.from('BAD_REQUEST', USERNAME_ERROR_CODES.USERNAME_IS_ALREADY_TAKEN);
					}
					ctx.body.displayUsername = name;
					ctx.body.name = name;
				}
				if (ctx.path === '/sign-in/username') {
					const legacy = findLegacyAccount(db, String(field(ctx.body, 'username')));
					const attempt = field(ctx.body, 'password');
					if (
						legacy?.hash &&
						typeof attempt === 'string' &&
						(await password.verify({ hash: legacy.hash, password: attempt }))
					) {
						throw APIError.from('FORBIDDEN', {
							code: 'LEGACY_ENROLLMENT_REQUIRED',
							message: 'Add an email address to finish moving your account.'
						});
					}
				}
			})
		},
		disabledPaths: ['/update-user', '/is-username-available'],
		rateLimit: { enabled: config.rateLimit },
		advanced: {
			ipAddress: { ipAddressHeaders: [clientIPHeader] },
			cookiePrefix: 'maple',
			useSecureCookies: config.production,
			...(config.production ? { defaultCookieAttributes: { sameSite: 'none', secure: true } } : {})
		},
		telemetry: { enabled: false },
		logger: {
			level: 'warn',
			log: (level) => {
				if (level === 'error') console.error('[AUTH] Authentication operation failed');
			}
		},
		plugins: [
			username({
				minUsernameLength: usernameLength.min,
				maxUsernameLength: Math.max(usernameLength.max, legacyUsernameLength),
				usernameValidator: isClaimableUsername,
				immutableUsername: true
			}),
			passkey({
				rpID: config.passkey.rpID,
				rpName: 'Maple',
				origin: config.passkey.origins,
				schema: { passkey: { modelName: 'auth_passkey' } }
			}),
			legacyEnrollment(db)
		]
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth['$Infer']['Session'];
