/* eslint-disable no-unused-vars */
const express = require('express'),
	cookieParser = require('cookie-parser');
const pool = require('../db');
const authenticateToken = require('../middleware/authToken');
const verifyUser = require('../middleware/verifyUser');
const socket = require('../socket');
const ioTools = require('../iomanager/io.js');

const router = express.Router();

const io = socket.getIO();

router.use(express.json());
router.use(cookieParser());
router.use(authenticateToken);
router.use(verifyUser);

router.post('/add/:id', async (req, res) => {
	const id = req.params.id;
	const friendId = req.body.friendId;

	if (!friendId) {
		return res.status(400).json({ error: 'Friend ID is required.' });
	}

	try {
		const [alreadyFriends] = await pool
			.promise()
			.query(
				'SELECT * FROM friends_db WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
				[id, friendId, friendId, id]
			);

		if (alreadyFriends.length > 0) {
			const userSocket = await ioTools.getSocket(io, id);
			if (userSocket) {
				ioTools.emit(userSocket, 'error', 'You are already friends', io);
			}
			return res.status(409).json({ error: 'You are already friends.' });
		}

		const [existingRequests] = await pool
			.promise()
			.query(
				'SELECT * FROM pending_requests WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
				[id, friendId, friendId, id]
			);

		if (existingRequests.length > 0) {
			const userSocket = await ioTools.getSocket(io, id);
			if (userSocket) {
				ioTools.emit(userSocket, 'error', 'Friend request already sent/pending', io);
			}
			return res.status(409).json({ error: 'Friend request already sent/pending.' });
		}

		await pool
			.promise()
			.query('INSERT INTO pending_requests (user_id, friend_id) VALUES (?, ?)', [id, friendId]);

		const friendSocket = await ioTools.getSocket(io, friendId);
		if (friendSocket) {
			ioTools.addFriend(id, friendId, friendSocket, io);
		}
		return res.status(200).json({ message: 'Request sent successfully' });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: 'Error adding friend' });
	}
});

router.post('/accept/:id', async (req, res) => {
	const id = req.params.id;
	const friendId = req.body.friendId;

	if (!friendId) {
		return res.status(400).json({ error: 'Friend ID is required.' });
	}

	try {
		const [alreadyFriends] = await pool
			.promise()
			.query(
				'SELECT * FROM friends_db WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
				[id, friendId, friendId, id]
			);

		if (alreadyFriends.length > 0) {
			const userSocket = await ioTools.getSocket(io, id);
			if (userSocket) {
				ioTools.emit(userSocket, 'error', 'You are already friends', io);
			}
			return res.status(409).json({ error: 'You are already friends.' });
		}

		const [pendingResults] = await pool
			.promise()
			.query('SELECT * FROM pending_requests WHERE user_id = ? AND friend_id = ?', [friendId, id]);

		if (pendingResults.length === 0) {
			const userSocket = await ioTools.getSocket(io, id);
			if (userSocket) {
				ioTools.emit(userSocket, 'error', 'Friend request not found', io);
			}
			return res.status(404).json({ error: 'Friend request not found' });
		}

		await pool
			.promise()
			.query('DELETE FROM pending_requests WHERE user_id = ? AND friend_id = ?', [friendId, id]);

		await pool
			.promise()
			.query('INSERT INTO friends_db (user_id, friend_id) VALUES (?, ?)', [id, friendId]);

		const userSocket = await ioTools.getSocket(io, id);
		if (userSocket && id !== friendId) {
			ioTools.emit(
				userSocket,
				'requestAccepted',
				{ id: friendId, message: 'Friend request accepted!' },
				io
			);
		} else if (userSocket) {
			ioTools.emit(
				userSocket,
				'requestAccepted',
				{ id: id, message: 'Friend request accepted!' },
				io
			);
		}

		const friendSocket = await ioTools.getSocket(io, friendId);
		if (friendSocket) {
			ioTools.emit(
				friendSocket,
				'requestAccepted',
				{ id: id, message: 'Friend request accepted!' },
				io
			);
		}

		return res.status(200).json({ message: 'Friend request accepted successfully' });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: 'Error processing friend request' });
	}
});

router.post('/decline/:id', (req, res) => {
	const id = req.params.id;
	const friendId = req.body.friendId;

	if (!friendId) {
		return res.status(400).json({ error: 'Friend ID is required.' });
	}

	const sql =
		'DELETE FROM pending_requests WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)';

	pool.query(sql, [id, friendId, friendId, id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error declining friend request' });
		}
		return res.status(200).json({ message: 'Friend request declined successfully' });
	});
});

router.post('/remove/:id', (req, res) => {
	const id = req.params.id;
	const friendId = req.body.friendId;

	if (!friendId) {
		return res.status(400).json({ error: 'Friend ID is required.' });
	}

	const sql =
		'DELETE FROM friends_db WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)';

	pool.query(sql, [id, friendId, friendId, id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error removing friend' });
		}
		return res.status(200).json({ message: 'Friend removed successfully' });
	});
});

router.get('/get/requests/:id', (req, res) => {
	const id = req.params.id;

	const sql = 'SELECT * FROM pending_requests WHERE friend_id = ?';

	pool.query(sql, [id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching friend requests' });
		}
		return res.status(200).json(results);
	});
});

router.get('/get/friends/:id', (req, res) => {
	const id = req.params.id;

	const sql = 'SELECT * FROM friends_db WHERE user_id = ? OR friend_id = ?';

	pool.query(sql, [id, id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching friends' });
		}
		return res.status(200).json(results);
	});
});

module.exports = router;
