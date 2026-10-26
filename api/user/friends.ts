import express from 'express';
import cookieParser from 'cookie-parser';
import { requireSession } from '../middleware/session.js';
import { verifyUser } from '../middleware/verifyUser.js';
import * as ioTools from '../iomanager/io.js';
import { field } from '../types/record.js';
import type { Services } from '../types/services.js';

const pairSql = '(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)';

export function createFriendsRouter({ db, io, auth }: Services) {
	const router = express.Router();

	router.use(express.json());
	router.use(cookieParser());
	router.use(requireSession(auth));
	router.use(verifyUser);

	router.post('/add/:id', async (req, res) => {
		const id = req.params.id;
		const friendId = field(req.body, 'friendId');

		if (typeof friendId !== 'string' || !friendId) {
			return res.status(400).json({ error: 'Friend ID is required.' });
		}

		try {
			const pair = [id, friendId, friendId, id];
			if (db.all(`SELECT * FROM friends_db WHERE ${pairSql}`, pair).length > 0) {
				ioTools.emitAll(io, id, 'error', 'You are already friends');
				return res.status(409).json({ error: 'You are already friends.' });
			}

			if (db.all(`SELECT * FROM pending_requests WHERE ${pairSql}`, pair).length > 0) {
				ioTools.emitAll(io, id, 'error', 'Friend request already sent/pending');
				return res.status(409).json({ error: 'Friend request already sent/pending.' });
			}

			db.run('INSERT INTO pending_requests (user_id, friend_id) VALUES (?, ?)', [id, friendId]);

			await ioTools.addFriend(io, id, friendId);
			return res.status(200).json({ message: 'Request sent successfully' });
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error adding friend' });
		}
	});

	router.post('/accept/:id', (req, res) => {
		const id = req.params.id;
		const friendId = field(req.body, 'friendId');

		if (typeof friendId !== 'string' || !friendId) {
			return res.status(400).json({ error: 'Friend ID is required.' });
		}

		try {
			const pair = [id, friendId, friendId, id];
			if (db.all(`SELECT * FROM friends_db WHERE ${pairSql}`, pair).length > 0) {
				ioTools.emitAll(io, id, 'error', 'You are already friends');
				return res.status(409).json({ error: 'You are already friends.' });
			}

			const pending = db.all('SELECT * FROM pending_requests WHERE user_id = ? AND friend_id = ?', [
				friendId,
				id
			]);
			if (pending.length === 0) {
				ioTools.emitAll(io, id, 'error', 'Friend request not found');
				return res.status(404).json({ error: 'Friend request not found' });
			}

			db.transaction((transaction) => {
				transaction.run('DELETE FROM pending_requests WHERE user_id = ? AND friend_id = ?', [
					friendId,
					id
				]);
				transaction.run('INSERT INTO friends_db (user_id, friend_id) VALUES (?, ?)', [
					id,
					friendId
				]);
			});

			// const userSocket = await ioTools.getSocket(io, id);
			// if (userSocket && id !== friendId) {
			// 	ioTools.emitAll(id, "requestAccepted", { id: friendId, message: 'Friend request accepted!' }, io);
			// } else if (userSocket) {
			// 	ioTools.emitAll(id, "requestAccepted", { id: id, message: 'Friend request accepted!' }, io);
			// }

			const message = 'Friend request accepted!';
			if (id !== friendId) {
				ioTools.emitAll(io, friendId, 'requestAccepted', { id, message });
				ioTools.emitAll(io, id, 'acceptedRequest', { id: friendId, message });
			} else {
				ioTools.emitAll(io, id, 'requestAccepted', { id: friendId, message });
				ioTools.emitAll(io, friendId, 'acceptedRequest', { id, message });
			}

			return res.status(200).json({ message: 'Friend request accepted successfully' });
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error processing friend request' });
		}
	});

	router.post('/decline/:id', (req, res) => {
		const id = req.params.id;
		const friendId = field(req.body, 'friendId');

		if (typeof friendId !== 'string' || !friendId) {
			return res.status(400).json({ error: 'Friend ID is required.' });
		}

		try {
			db.run(`DELETE FROM pending_requests WHERE ${pairSql}`, [id, friendId, friendId, id]);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error declining friend request' });
		}
		return res.status(200).json({ message: 'Friend request declined successfully' });
	});

	router.post('/remove/:id', (req, res) => {
		const id = req.params.id;
		const friendId = field(req.body, 'friendId');

		if (typeof friendId !== 'string' || !friendId) {
			return res.status(400).json({ error: 'Friend ID is required.' });
		}

		try {
			db.run(`DELETE FROM friends_db WHERE ${pairSql}`, [id, friendId, friendId, id]);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error removing friend' });
		}
		return res.status(200).json({ message: 'Friend removed successfully' });
	});

	router.get('/get/requests/:id', (req, res) => {
		try {
			const requests = db.all('SELECT * FROM pending_requests WHERE friend_id = ?', [
				req.params.id
			]);
			return res.status(200).json(requests);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching friend requests' });
		}
	});

	router.get('/get/friends/:id', (req, res) => {
		const id = req.params.id;

		try {
			const friends = db.all('SELECT * FROM friends_db WHERE user_id = ? OR friend_id = ?', [
				id,
				id
			]);
			return res.status(200).json(friends);
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching friends' });
		}
	});

	return router;
}
