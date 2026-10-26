import express from 'express';
import cookieParser from 'cookie-parser';
import { requireSession } from '../middleware/session.js';
import { verifyUser } from '../middleware/verifyUser.js';
import type { Services } from '../types/services.js';

export function createGetRouter({ db, auth }: Services) {
	const router = express.Router();

	router.use(express.json());
	router.use(cookieParser());
	router.use(requireSession(auth));
	router.use(verifyUser);

	router.get('/user/:id', (req, res) => {
		const id = req.user?.id;
		if (!id) return res.sendStatus(401);

		let user;
		try {
			user = db.all('SELECT username, id, name, pfp FROM users WHERE id = ?', [id])[0];
		} catch (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		return res.status(200).json({
			username: user.username,
			id: user.id,
			name: user.name,
			pfp: user.pfp instanceof Buffer ? user.pfp.toString('base64') : null
		});
	});

	router.get('/isAuthenticated/:id', (req, res) => {
		return res.status(200).json({ isAuthenticated: true });
	});

	return router;
}
