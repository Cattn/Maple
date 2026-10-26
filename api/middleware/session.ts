import type { RequestHandler } from 'express';
import type { Auth } from '../auth/auth.js';
import { sessionUser } from '../auth/session.js';

export function requireSession(auth: Auth): RequestHandler {
	return (req, res, next) => {
		sessionUser(auth, req.headers).then((user) => {
			if (!user) return res.sendStatus(401);
			req.user = user;
			next();
		}, next);
	};
}
