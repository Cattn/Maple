/* eslint-disable no-unused-vars */
const express = require('express'),
cookieParser = require('cookie-parser');
const pool = require('../db');
const { createHash } = require('node:crypto');

const router = express.Router();

router.use(express.json());
router.use(cookieParser());

router.get('/user/:username', (req, res) => {
	const username = req.params.username;
	const sql = 'SELECT id, username, name FROM users WHERE username = ?';

	pool.query(sql, [username], (error, results) => {
		if (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		res.status(200).json(results[0]);
	});
});

router.get('/user/id/:id', async (req, res) => {
  const id = req.params.id;

  try {
	const [userResults] = await pool.promise().query(
	  'SELECT id, username, name FROM users WHERE id = ?',
	  [id]
	);

	if (userResults.length === 0) {
	  return res.status(404).json({ error: 'User not found' });
	}

	const [nowPlayingResults] = await pool.promise().query(
	  'SELECT playing FROM live_status WHERE user_id = ?',
	  [id]
	);

	const userObject = userResults[0];
	if (nowPlayingResults.length > 0) {
	  userObject.nowPlaying = nowPlayingResults[0].playing;
	}

	res.status(200).json(userObject);
  } catch (error) {
	console.error('Error fetching user:', error);
	return res.status(500).json({ error: 'Error fetching user' });
  }
});

router.get('/pfp/:id', (req, res) => {
	const id = req.params.id;
	const sql = 'SELECT pfp FROM users WHERE id = ?';

	pool.query(sql, [id], (error, results) => {
		if (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const user = results[0];
		if (!user.pfp) {
			return res.status(404).json({ error: 'User has no pfp' });
		}

		res.set('Content-Type', 'image/jpeg');
		res.set('Content-Disposition', `attachment; filename="${id}.jpg"`);
		res.send(user.pfp);
	});
});

router.get('/albumArt/:id/:random', (req, res) => {
	const id = req.params.id;
	const sql = 'SELECT albumArt FROM live_status WHERE user_id = ?';

	pool.query(sql, [id], (error, results) => {
		if (error) {
			console.error('Error fetching user:', error);
			return res.status(500).json({ error: 'Error fetching user' });
		}
		if (results.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const user = results[0];
		if (!user.albumArt) {
			return res.status(404).json({ error: 'User has no album art' });
		}

		// RPC URLs identify exact bytes. Never serve a later/earlier track's cover
		// under another track's ID; legacy random cache-busters remain supported.
		if (/^[a-f0-9]{64}$/.test(req.params.random)) {
			const artworkId = createHash('sha256').update(user.albumArt).digest('hex');
			if (artworkId !== req.params.random) {
				res.set('Cache-Control', 'no-store');
				return res.status(404).json({ error: 'Requested album art is no longer current' });
			}
		}

		res.set('Content-Type', 'image/jpeg');
		res.set('Content-Disposition', `attachment; filename="${id}.jpg"`);
		res.send(user.albumArt);
	});
});

module.exports = router;
