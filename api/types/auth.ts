export interface SessionUser {
	id: string;
	sessionId: string;
}

declare module 'express-serve-static-core' {
	interface Request {
		user?: SessionUser;
	}
}
