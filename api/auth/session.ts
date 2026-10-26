import type { IncomingHttpHeaders } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import type { Database } from '../storage/sqlite.js';
import type { SessionUser } from '../types/auth.js';
import type { Auth } from './auth.js';

export async function sessionUser(
	auth: Auth,
	headers: IncomingHttpHeaders
): Promise<SessionUser | undefined> {
	const session = await auth.api.getSession({
		headers: fromNodeHeaders(headers),
		query: { disableRefresh: true }
	});
	if (!session?.user.emailVerified) return undefined;
	return { id: session.user.id, sessionId: session.session.id };
}

export function activeSession(db: Database, user: SessionUser) {
	const row = db.all(
		'SELECT auth_session."expiresAt" FROM auth_session ' +
			'JOIN auth_user ON auth_user.id = auth_session."userId" ' +
			'WHERE auth_session.id = ? AND auth_session."userId" = ? AND auth_user."emailVerified" = 1',
		[user.sessionId, user.id]
	)[0];
	const expiresAt = Date.parse(String(row?.expiresAt));
	return expiresAt > Date.now() ? expiresAt : undefined;
}
