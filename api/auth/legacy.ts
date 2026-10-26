import * as z from 'zod';
import { randomUUID } from 'node:crypto';
import type { BetterAuthPlugin, User } from 'better-auth';
import {
	APIError,
	createAuthEndpoint,
	originCheck,
	sendVerificationEmailFn
} from 'better-auth/api';
import type { Database } from '../storage/sqlite.js';
import {
	emailSchema,
	firstIssue,
	isClaimableUsername,
	usernameSchema
} from '../validation/account.js';

const enrollBody = z.object({
	username: z.string(),
	password: z.string().max(1024),
	email: z.string().max(254),
	newUsername: z.string().max(256).optional(),
	callbackURL: z.string().optional()
});

function failure(
	status: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'CONFLICT',
	code: string,
	message: string
) {
	return APIError.from(status, { code, message });
}

const invalidCredentials = () =>
	failure('UNAUTHORIZED', 'INVALID_LEGACY_CREDENTIALS', 'Invalid username or password.');
const inProgress = () =>
	failure('CONFLICT', 'ENROLLMENT_CHANGED', 'This account changed during enrollment. Try again.');

export function findLegacyAccount(db: Database, username: string) {
	const row = db.all('SELECT id, username, password FROM users WHERE username = ?', [username])[0];
	if (!row || typeof row.id !== 'string' || typeof row.username !== 'string') return undefined;
	return {
		id: row.id,
		username: row.username,
		hash: typeof row.password === 'string' ? row.password : undefined
	};
}

export function legacyEnrollment(db: Database) {
	return {
		id: 'legacy-enrollment',
		endpoints: {
			enrollLegacyAccount: createAuthEndpoint(
				'/legacy/enroll',
				{
					method: 'POST',
					body: enrollBody,
					use: [originCheck((ctx) => ctx.body.callbackURL)]
				},
				async (ctx) => {
					const { internalAdapter, password } = ctx.context;
					const parsedEmail = emailSchema.safeParse(ctx.body.email.trim().toLowerCase());
					if (!parsedEmail.success) {
						throw failure('BAD_REQUEST', 'INVALID_EMAIL', firstIssue(parsedEmail) ?? '');
					}
					const email = parsedEmail.data;
					const legacy = findLegacyAccount(db, ctx.body.username);
					if (!legacy) {
						await password.hash(ctx.body.password);
						throw invalidCredentials();
					}
					const { id } = legacy;
					const proof =
						legacy.hash ?? (await internalAdapter.findCredentialAccount(id))?.password ?? undefined;
					if (!proof || !(await password.verify({ hash: proof, password: ctx.body.password }))) {
						throw invalidCredentials();
					}

					let user: User | null = await internalAdapter.findUserById(id);
					if (user?.emailVerified) {
						throw failure(
							'CONFLICT',
							'ALREADY_ENROLLED',
							'This account is already enrolled. Sign in instead.'
						);
					}
					const owner = await internalAdapter.findUserByEmail(email);
					if (owner && owner.user.id !== id) {
						throw failure('CONFLICT', 'EMAIL_UNAVAILABLE', 'Use a different email address.');
					}

					let username = legacy.username;
					if (!user) {
						if (!isClaimableUsername(username)) {
							if (ctx.body.newUsername === undefined) {
								throw failure(
									'BAD_REQUEST',
									'USERNAME_REPLACEMENT_REQUIRED',
									'Your old username is no longer allowed. Choose a new username.'
								);
							}
							const parsed = usernameSchema.safeParse(ctx.body.newUsername);
							if (!parsed.success) {
								throw failure('BAD_REQUEST', 'INVALID_USERNAME', firstIssue(parsed) ?? '');
							}
							username = parsed.data;
							if (db.all('SELECT 1 FROM users WHERE username = ? AND id <> ?', [username, id])[0]) {
								throw failure('CONFLICT', 'USERNAME_TAKEN', 'That username is already taken.');
							}
						}
					}
					try {
						db.transaction((transaction) => {
							const currentUser = transaction.all('SELECT * FROM auth_user WHERE id = ?', [id])[0];
							if (currentUser?.emailVerified) {
								throw failure(
									'CONFLICT',
									'ALREADY_ENROLLED',
									'This account is already enrolled. Sign in instead.'
								);
							}
							const credential = transaction.all(
								"SELECT password FROM auth_account WHERE userId = ? AND providerId = 'credential'",
								[id]
							)[0];
							const currentHash = transaction.all('SELECT password FROM users WHERE id = ?', [
								id
							])[0]?.password;
							if (currentHash !== proof && credential?.password !== proof) throw inProgress();
							if (
								transaction.all('SELECT id FROM auth_user WHERE email = ? AND id <> ?', [
									email,
									id
								])[0]
							) {
								throw failure('CONFLICT', 'EMAIL_UNAVAILABLE', 'Use a different email address.');
							}
							const now = new Date().toISOString();
							if (!currentUser) {
								transaction.run(
									'INSERT INTO auth_user (id, name, email, emailVerified, createdAt, updatedAt, username, displayUsername) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
									[id, username, email, now, now, username.toLowerCase(), username]
								);
							} else if (currentUser.email !== email) {
								transaction.run('UPDATE auth_user SET email = ?, updatedAt = ? WHERE id = ?', [
									email,
									now,
									id
								]);
							}
							if (!credential) {
								transaction.run(
									"INSERT INTO auth_account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, 'credential', ?, ?, ?, ?)",
									[randomUUID(), id, id, proof, now, now]
								);
							}
						});
					} catch (error) {
						if (error instanceof APIError) throw error;
						const conflict = db.all('SELECT id FROM auth_user WHERE email = ? AND id <> ?', [
							email,
							id
						])[0];
						if (conflict)
							throw failure('CONFLICT', 'EMAIL_UNAVAILABLE', 'Use a different email address.');
						if (db.all('SELECT id FROM users WHERE username = ? AND id <> ?', [username, id])[0]) {
							throw failure('CONFLICT', 'USERNAME_TAKEN', 'That username is already taken.');
						}
						console.error('[AUTH] Legacy account claim failed');
						throw APIError.from('INTERNAL_SERVER_ERROR', {
							code: 'ENROLLMENT_FAILED',
							message: 'Your account could not be enrolled. Please try again.'
						});
					}
					user = await internalAdapter.findUserById(id);
					if (!user) throw inProgress();

					try {
						await sendVerificationEmailFn(ctx, user);
					} catch {
						console.error('[AUTH] Legacy enrollment verification email failed');
						throw APIError.from('SERVICE_UNAVAILABLE', {
							code: 'EMAIL_DELIVERY_FAILED',
							message:
								'Your account is enrolled, but the verification email could not be sent. Try again shortly.'
						});
					}
					return ctx.json({ status: true, email: user.email });
				}
			)
		},
		rateLimit: [{ pathMatcher: (path) => path === '/legacy/enroll', window: 60, max: 5 }]
	} satisfies BetterAuthPlugin;
}
