import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import multer from 'multer';
import { accountRoom, disconnectAccount } from '../iomanager/io.js';
import { accountId, requireSession } from '../middleware/session.js';
import { serverError } from '../middleware/serverError.js';
import { field } from '../types/record.js';
import type { Services } from '../types/services.js';
import { displayNameSchema, firstIssue } from '../validation/account.js';
import { imageFormat } from '../validation/image.js';
import { listeningVisibilitySchema, playbackIdPattern } from '../validation/playback.js';

const maxImageMegabytes = 3;
const imageTypes = ['image/jpeg', 'image/png', 'image/gif'];

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: maxImageMegabytes * 1024 * 1024, files: 1 },
	fileFilter: (req, file, cb) => cb(null, imageTypes.includes(file.mimetype))
});

const uploadError: ErrorRequestHandler = (error: unknown, req, res, next) => {
	if (!(error instanceof multer.MulterError)) return next(error);
	if (error.code === 'LIMIT_FILE_SIZE') {
		return res.status(413).json({ error: `File size exceeds ${maxImageMegabytes}MB limit.` });
	}
	return res.status(400).json({ error: error.message });
};

function uploadedImage(req: Request, res: Response) {
	if (!req.file?.buffer.length || !imageFormat(req.file.buffer)) {
		res.status(400).json({ error: 'Upload a JPG, PNG or GIF image.' });
		return;
	}
	return req.file.buffer;
}

export function createManageUserRouter({ io, auth, profiles, playback, friendships }: Services) {
	const router = express.Router();

	router.use(express.json());
	router.use(requireSession(auth));

	router.patch('/me', (req, res) => {
		const displayName = displayNameSchema.safeParse(field(req.body, 'displayName'));
		if (!displayName.success) return res.status(400).json({ error: firstIssue(displayName) });

		if (!profiles.rename(accountId(req), displayName.data)) {
			return res.status(404).json({ error: 'User not found' });
		}
		return res.status(200).json({ message: 'Display name updated successfully' });
	});

	router.patch('/me/listening', (req, res) => {
		const id = accountId(req);
		const visibility = listeningVisibilitySchema.safeParse(field(req.body, 'visibility'));
		if (!visibility.success) return res.status(400).json({ error: firstIssue(visibility) });

		if (!profiles.setVisibility(id, visibility.data)) {
			return res.status(404).json({ error: 'User not found' });
		}
		playback.visibilityChanged(id);
		return res.status(200).json({ message: 'Listening visibility updated successfully' });
	});

	router.put('/me/pfp', upload.single('pfp'), requireSession(auth), (req, res) => {
		const image = uploadedImage(req, res);
		if (!image) return;

		if (!profiles.setPicture(accountId(req), image)) {
			return res.status(404).json({ error: 'User not found' });
		}
		return res.status(200).json({ message: 'Profile picture updated successfully' });
	});

	router.put('/me/albumArt', upload.single('albumArt'), requireSession(auth), (req, res) => {
		const playbackId = field(req.body, 'playbackId');
		if (typeof playbackId !== 'string' || !playbackIdPattern.test(playbackId)) {
			return res.status(400).json({ error: 'playbackId is invalid.' });
		}
		const image = uploadedImage(req, res);
		if (!image) return;

		if (!req.user || !playback.storeArtwork(req.user, playbackId, image)) {
			return res.status(409).json({ error: 'Playback is no longer current.' });
		}
		return res.status(200).json({ message: 'Album art updated successfully' });
	});

	router.delete('/me', (req, res) => {
		const id = accountId(req);
		const friends = friendships.friendIds(id);
		profiles.delete(id);
		playback.end(id);
		for (const friend of friends) io.to(accountRoom(friend)).emit('friendRemoved', { id });
		disconnectAccount(io, id);
		return res.status(200).json({ message: 'User data successfully deleted.' });
	});

	router.use(uploadError);
	router.use(serverError('Error updating user'));

	return router;
}
