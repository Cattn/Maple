/* eslint-disable no-unused-vars */
const express = require('express'),
	cookieParser = require('cookie-parser');
const pool = require('../db');
const authenticateToken = require('../middleware/authToken');
const verifyUser = require('../middleware/verifyUser');
const multer = require('multer');

const router = express.Router();

router.use(express.json());
router.use(cookieParser());
router.use(authenticateToken);
router.use(verifyUser);

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

router.post('/setProfile/:id', upload.single('pfp'), (req, res) => {
	const id = req.params.id;

	if (!req.file || !req.file.buffer) {
		return res.status(400).json({ error: 'No file uploaded or invalid file.' });
	}

	const imageBuffer = req.file.buffer;

	if (imageBuffer.length > 3 * 1024 * 1024) {
		return res.status(400).json({ error: 'File size exceeds 3MB limit.' });
	}

	const getUserSql = 'SELECT username, id FROM users WHERE id = ?';
	pool.query(getUserSql, [id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const updatePfpSql = 'UPDATE users SET pfp = ? WHERE id = ?';
		pool.query(updatePfpSql, [imageBuffer, id], (updateError) => {
			if (updateError) {
				console.error(updateError);
				return res.status(500).json({ error: 'Error updating profile picture' });
			}
			return res.status(200).json({ message: 'Profile picture updated successfully' });
		});
	});
});

router.post('/setAlbumArt/:id', upload.single('albumArt'), (req, res) => {
	const id = req.params.id;

	if (!req.file || !req.file.buffer) {
		return res.status(400).json({ error: 'No file uploaded or invalid file.' });
	}

	const imageBuffer = req.file.buffer;

	if (imageBuffer.length > 3 * 1024 * 1024) {
		return res.status(400).json({ error: 'File size exceeds 3MB limit.' });
	}

	const getUserSql = 'SELECT username, id FROM users WHERE id = ?';
	pool.query(getUserSql, [id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const updatePfpSql =
			'INSERT INTO live_status (user_id, albumArt) VALUES (?, ?) ON DUPLICATE KEY UPDATE albumArt = VALUES(albumArt)';
		pool.query(updatePfpSql, [id, imageBuffer], (updateError) => {
			if (updateError) {
				console.error(updateError);
				return res.status(500).json({ error: 'Error updating album art' });
			}
			return res.status(200).json({ message: 'Album art updated successfully' });
		});
	});
});

router.post('/setDisplayName/:id', (req, res) => {
	const id = req.params.id;
	const displayName = req.body.displayName;

	if (!displayName) {
		return res.status(400).json({ error: 'Display name is required.' });
	}

	const getUserSql = 'SELECT username, id FROM users WHERE id = ?';
	pool.query(getUserSql, [id], (error, results) => {
		if (error) {
			console.error(error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const updateDisplayNameSql = 'UPDATE users SET name = ? WHERE id = ?';
		pool.query(updateDisplayNameSql, [displayName, id], (updateError) => {
			if (updateError) {
				console.error(updateError);
				return res.status(500).json({ error: 'Error updating display name' });
			}
			return res.status(200).json({ message: 'Display name updated successfully' });
		});
	});
});

module.exports = router;
