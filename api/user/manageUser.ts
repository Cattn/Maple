import express, { type Request, type RequestHandler, type Response } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { requireSession } from '../middleware/session.js';
import { verifyUser } from '../middleware/verifyUser.js';
import { field } from '../types/record.js';
import type { Services } from '../types/services.js';

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 3 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'));
		}
	}
});

function imageUpload(name: string): RequestHandler<{ id: string }> {
	return upload.single(name);
}

export function createManageUserRouter({ db, rpc, auth }: Services) {
	const router = express.Router();

	router.use(express.json());
	router.use(cookieParser());
	router.use(requireSession(auth));
	router.use(verifyUser);

	function userExists(res: Response, id: string) {
		try {
			if (db.all('SELECT username, id FROM users WHERE id = ?', [id]).length > 0) return true;
			res.status(404).json({ error: 'User not found' });
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: 'Error fetching user' });
		}
		return false;
	}

	function uploadedImage(req: Request, res: Response) {
		if (!req.file || !req.file.buffer) {
			res.status(400).json({ error: 'No file uploaded or invalid file.' });
			return;
		}
		if (req.file.buffer.length > 9 * 1024 * 1024) {
			res.status(400).json({ error: 'File size exceeds 9MB limit.' });
			return;
		}
		return req.file.buffer;
	}

	router.post('/setProfile/:id', imageUpload('pfp'), (req, res) => {
		const id = req.params.id;
		const imageBuffer = uploadedImage(req, res);
		if (!imageBuffer) return;

		if (!userExists(res, id)) return;

		try {
			db.run('UPDATE users SET pfp = ? WHERE id = ?', [imageBuffer, id]);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error updating profile picture' });
		}
		return res.status(200).json({ message: 'Profile picture updated successfully' });
	});

	router.post('/setAlbumArt/:id', imageUpload('albumArt'), (req, res) => {
		const id = req.params.id;
		const imageBuffer = uploadedImage(req, res);
		if (!imageBuffer) return;

		if (!userExists(res, id)) return;

		try {
			db.run(
				'INSERT INTO live_status (user_id, albumArt) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET albumArt = excluded.albumArt',
				[id, imageBuffer]
			);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error updating album art' });
		}
		// Notify RPC listeners only after the cover has been committed to storage.
		rpc.artworkUploaded(id, field(req.body, 'artworkRequestId'));
		return res.status(200).json({ message: 'Album art updated successfully' });
	});

	router.post('/setDisplayName/:id', (req, res) => {
		const id = req.params.id;
		const displayName = field(req.body, 'displayName');

		if (typeof displayName !== 'string' || !displayName) {
			return res.status(400).json({ error: 'Display name is required.' });
		}

		if (!userExists(res, id)) return;

		try {
			db.run('UPDATE users SET name = ? WHERE id = ?', [displayName, id]);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error updating display name' });
		}
		return res.status(200).json({ message: 'Display name updated successfully' });
	});

	router.delete('/delete/:id', (req, res) => {
		const id = req.params.id;

		try {
			db.transaction((transaction) => {
				transaction.run('DELETE FROM pending_requests WHERE user_id = ? OR friend_id = ?', [
					id,
					id
				]);
				transaction.run('DELETE FROM friends_db WHERE user_id = ? OR friend_id = ?', [id, id]);
				transaction.run('DELETE FROM live_status WHERE user_id = ?', [id]);
				transaction.run('DELETE FROM users WHERE id = ?', [id]);
			});
			rpc.disconnectAccount(id);
			return res.status(200).json({ message: 'User data successfully deleted.' });
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error deleting user' });
		}
	});

	return router;
}
