import type { Request, RequestHandler } from 'express';
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

export function optionalSession(auth: Auth): RequestHandler {
	return (req, res, next) => {
		sessionUser(auth, req.headers).then((user) => {
			req.user = user;
			next();
		}, next);
	};
}

export function accountId(req: Request) {
	if (!req.user) throw new Error('Route is missing requireSession.');
	return req.user.id;
}
