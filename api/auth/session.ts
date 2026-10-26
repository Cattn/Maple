import type { IncomingHttpHeaders } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
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
