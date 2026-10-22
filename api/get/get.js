/* eslint-disable no-unused-vars */
const express = require('express'),
	cookieParser = require('cookie-parser');
const db = require('../db');
const authenticateToken = require('../middleware/authToken');
const verifyUser = require('../middleware/verifyUser');

const router = express.Router();

router.use(express.json());
router.use(cookieParser());
router.use(authenticateToken);
router.use(verifyUser);

router.get('/user/:id', (req, res) => {
	const id = req.user.id;
	const sql = 'SELECT username, id, name, pfp FROM users WHERE id = ?';

	db.query(sql, [id], (error, results) => {
		if (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const user = results[0];
		const response = {
			username: user.username,
			id: user.id,
			name: user.name,
			pfp: user.pfp ? user.pfp.toString('base64') : null
		};

		return res.status(200).json(response);
	});
});

router.get('/isAuthenticated/:id', (req, res) => {
	return res.status(200).json({ isAuthenticated: true });
});

router.get('/logout/:id', (req, res) => {
	require('../iomanager/rpc').disconnectAccount(req.user.id);
	res.clearCookie('token');
	return res.status(200).json({ message: 'Logout successful' });
});

module.exports = router;
