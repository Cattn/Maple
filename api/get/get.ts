import express from 'express';
import { accountId, requireSession } from '../middleware/session.js';
import { serverError } from '../middleware/serverError.js';
import type { Services } from '../types/services.js';

export function createGetRouter({ auth, profiles, playback }: Services) {
	const router = express.Router();

	router.use(requireSession(auth));

	router.get('/me', (req, res) => {
		const id = accountId(req);
		const profile = profiles.own(id);
		const record = profiles.byId(id);
		if (!profile || !record) return res.status(404).json({ error: 'User not found' });
		return res.status(200).json({ ...profile, listening: playback.listening(record) });
	});

	router.use(serverError('Error fetching user'));

	return router;
}
