import type { ErrorRequestHandler } from 'express';
import { field } from '../types/record.js';

export function serverError(message: string): ErrorRequestHandler {
	return (error: unknown, req, res, next) => {
		if (res.headersSent) return next(error);
		const type = field(error, 'type');
		if (type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
		if (type === 'entity.too.large')
			return res.status(413).json({ error: 'Request body is too large' });
		console.error(error);
		res.status(500).json({ error: message });
	};
}
