import express from 'express';
import cookieParser from 'cookie-parser';
import type { Services } from '../types/services.js';

export function createPublicGetRouter({ db }: Services) {
	const router = express.Router();

	router.use(express.json());
	router.use(cookieParser());

	router.get('/user/:username', (req, res) => {
		let user;
		try {
			user = db.all('SELECT id, username, name FROM users WHERE username = ?', [
				req.params.username
			])[0];
		} catch (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		res.status(200).json(user);
	});

	router.get('/user/id/:id', (req, res) => {
		const id = req.params.id;

		try {
			const user = db.all('SELECT id, username, name FROM users WHERE id = ?', [id])[0];
			if (!user) {
				return res.status(404).json({ error: 'User not found' });
			}

			const status = db.all('SELECT playing FROM live_status WHERE user_id = ?', [id])[0];
			if (!status) {
				return res.status(200).json(user);
			}

			const playing = status.playing;
			// Match mysql2's default decoding of MySQL's JSON column.
			const nowPlaying: unknown = typeof playing === 'string' ? JSON.parse(playing) : playing;
			res.status(200).json({ ...user, nowPlaying });
		} catch (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
	});

	router.get('/pfp/:id', (req, res) => {
		const id = req.params.id;

		let user;
		try {
			user = db.all('SELECT pfp FROM users WHERE id = ?', [id])[0];
		} catch (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}
		if (!(user.pfp instanceof Buffer)) {
			return res.status(404).json({ error: 'User has no pfp' });
		}

		res.set('Content-Type', 'image/jpeg');
		res.set('Content-Disposition', `attachment; filename="${id}.jpg"`);
		res.send(user.pfp);
	});

	router.get('/albumArt/:id/:random', (req, res) => {
		const id = req.params.id;

		let status;
		try {
			status = db.all('SELECT albumArt FROM live_status WHERE user_id = ?', [id])[0];
		} catch (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (!status) {
			return res.status(404).json({ error: 'User not found' });
		}
		if (!(status.albumArt instanceof Buffer)) {
			return res.status(404).json({ error: 'User has no album art' });
		}

		res.set('Content-Type', 'image/jpeg');
		res.set('Content-Disposition', `attachment; filename="${id}.jpg"`);
		res.send(status.albumArt);
	});

	return router;
}
