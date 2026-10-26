import * as z from 'zod';

export const usernameLength = { min: 2, max: 32 };
export const passwordLength = { min: 8, max: 128 };
const usernameCharacters = /^[A-Za-z0-9._-]+$/;

export const usernameSchema = z
	.string()
	.min(usernameLength.min, 'Username must be at least 2 characters.')
	.max(usernameLength.max, 'Username must be at most 32 characters.')
	.regex(
		usernameCharacters,
		'Username may only use letters, digits, dots, dashes and underscores.'
	);

export const passwordSchema = z
	.string()
	.min(passwordLength.min, 'Password must be at least 8 characters.')
	.max(passwordLength.max, 'Password must be at most 128 characters.')
	.regex(/[A-Z]/, 'Password needs an uppercase letter.')
	.regex(/[a-z]/, 'Password needs a lowercase letter.');

export const emailSchema = z.email('Enter a valid email address.').max(254);

export function isValidUsername(value: unknown) {
	return usernameSchema.safeParse(value).success;
}

export function isClaimableUsername(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length >= usernameLength.min &&
		usernameCharacters.test(value)
	);
}

export function firstIssue(result: z.ZodSafeParseResult<unknown>) {
	return result.success ? undefined : (result.error.issues[0]?.message ?? 'Invalid value.');
}

export const displayNameSchema = z
	.string('Display name is required.')
	.trim()
	.min(1, 'Display name is required.')
	.max(64, 'Display name must be at most 64 characters.');
