import { createAuthClient } from 'better-auth/client';
import { usernameClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { get } from 'svelte/store';
import { SERVER } from '$lib/api/server';
import { UserManager } from '$lib/api/UserManager';
import { accountRevision, clearAccount, isLoggedIn, SavedUser } from '$lib/store';
import type { User } from '$lib/types';

export const authClient = createAuthClient({
	baseURL: SERVER,
	plugins: [usernameClient(), passkeyClient()]
});

export type AuthError = { code?: string; message?: string } | null;

export function errorMessage(error: AuthError, fallback = 'Something went wrong. Try again.') {
	return error?.message || fallback;
}

export function verifiedURL() {
	return `${window.location.origin}/verified`;
}

export function enrollLegacyAccount(body: {
	username: string;
	password: string;
	email: string;
	newUsername?: string;
}) {
	return authClient.$fetch<{ status: boolean; email: string }, { code?: string; message?: string }>(
		'/legacy/enroll',
		{
			method: 'POST',
			body: { ...body, callbackURL: verifiedURL() }
		}
	);
}

let loading: { revision: number; promise: Promise<User | undefined> } | undefined;

export function loadSession(fresh = false) {
	if (fresh) clearAccount();
	const revision = accountRevision;
	if (loading?.revision === revision) return loading.promise;
	const promise = UserManager.getMe()
		.then((user) => {
			if (accountRevision !== revision) return undefined;
			const current = get(SavedUser);
			if (user && current && current.id !== user.id) clearAccount();
			if (user) {
				SavedUser.set(user);
				isLoggedIn.set(true);
			}
			return user;
		})
		.finally(() => {
			if (loading?.promise === promise) loading = undefined;
		});
	loading = { revision, promise };
	return promise;
}

export async function signOut(everywhere = false): Promise<AuthError> {
	if (everywhere) {
		const { error } = await authClient.revokeSessions();
		if (error) return error;
	}
	const { error } = await authClient.signOut();
	if (error && !everywhere) return error;
	clearAccount();
	return null;
}
