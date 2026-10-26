import express from 'express';
import { optionalSession } from '../middleware/session.js';
import { serverError } from '../middleware/serverError.js';
import type { Services } from '../types/services.js';
import { sendImage } from './image.js';

export function createPublicGetRouter({ auth, profiles, playback }: Services) {
	const router = express.Router();

	router.use(['/user/id', '/albumArt'], optionalSession(auth));

	router.get('/user/:username', (req, res) => {
		const profile = profiles.byUsername(req.params.username);
		if (!profile) return res.status(404).json({ error: 'User not found' });
		return res.status(200).json(profile);
	});

	router.get('/user/id/:id', (req, res) => {
		const profile = profiles.byId(req.params.id);
		if (!profile) return res.status(404).json({ error: 'User not found' });
		return res.status(200).json(playback.show(profile, req.user?.id));
	});

	router.get('/pfp/:id', (req, res) => {
		const id = req.params.id;
		const image = profiles.picture(id);
		if (image === undefined) return res.status(404).json({ error: 'User not found' });
		if (image === null) return res.status(404).json({ error: 'User has no pfp' });
		return sendImage(res, id, image);
	});

	router.get('/albumArt/:id/:random', (req, res) => {
		const id = req.params.id;
		const art = profiles.albumArt(id);
		if (!art) return res.status(404).json({ error: 'User not found' });
		const visible = art.visibility === 'public' || art.id === req.user?.id;
		if (!visible || !art.image || (art.artwork && art.artwork !== req.params.random)) {
			return res.status(404).json({ error: 'User has no album art' });
		}
		return sendImage(res, id, art.image);
	});

	router.use(serverError('Error fetching user'));

	return router;
}
