import express from 'express';
import { serverError } from '../middleware/serverError.js';
import type { Services } from '../types/services.js';
import { playbackIdPattern } from '../validation/playback.js';
import { sendImage } from './image.js';

export function createArtworkRouter({ links, profiles, playback }: Services) {
	const router = express.Router();

	router.get('/:id/:artworkId/:expires/:signature', (req, res) => {
		const { id, artworkId, signature } = req.params;
		const expires = /^\d{1,12}$/.test(req.params.expires) ? Number(req.params.expires) : NaN;
		const valid =
			playbackIdPattern.test(artworkId) &&
			links.verify({ id, artworkId, expires, signature }) &&
			playback.canShareArtwork(id, artworkId);
		const image = valid ? profiles.artwork(id, artworkId) : undefined;
		if (!image) return res.status(404).json({ error: 'Artwork not found' });
		res.set('Cache-Control', 'private, no-store');
		res.set('Referrer-Policy', 'no-referrer');
		return sendImage(res, artworkId, image);
	});

	router.use(serverError('Error fetching artwork'));

	return router;
}
