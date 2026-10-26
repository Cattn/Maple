import type { Database, Row, Value } from '../storage/sqlite.js';
import type { LastPlayed, ListeningVisibility, Track } from '../types/playback.js';
import type { ListeningRecord, OwnProfile, Profile } from '../types/profile.js';
import { field } from '../types/record.js';

export const profileSql = 'SELECT id, username, name FROM users';
export const listeningSql =
	'SELECT users.id, users.username, users.name, users.listening_visibility, ' +
	'live_status.playing, live_status.artwork_id FROM users ' +
	'LEFT JOIN live_status ON live_status.user_id = users.id';

export function toProfile(row: Row): Profile {
	return {
		id: String(row.id),
		username: String(row.username),
		name: typeof row.name === 'string' ? row.name : null
	};
}

function visibility(value: Value | undefined): ListeningVisibility {
	return value === 'public' ? 'public' : 'private';
}

function lastPlayed(row: Row): LastPlayed | null {
	if (typeof row.playing !== 'string') return null;
	// Match mysql2's default decoding of MySQL's JSON column.
	const played: unknown = JSON.parse(row.playing);
	const [title, artist, album] = ['title', 'artist', 'album'].map((key) => field(played, key));
	if (typeof title !== 'string' || typeof artist !== 'string' || typeof album !== 'string') {
		return null;
	}
	const duration = field(played, 'duration');
	const playedAt = field(played, 'playedAt') ?? field(played, 'timePlayed');
	return {
		title,
		artist,
		album,
		duration: typeof duration === 'number' ? duration : null,
		playedAt: typeof playedAt === 'string' ? playedAt : null,
		artwork: typeof row.artwork_id === 'string' ? row.artwork_id : null
	};
}

export function toListeningRecord(row: Row): ListeningRecord {
	return {
		...toProfile(row),
		visibility: visibility(row.listening_visibility),
		lastPlayed: lastPlayed(row)
	};
}

function image(value: Value | undefined) {
	return value instanceof Buffer ? value : null;
}

export class ProfileManager {
	constructor(private readonly db: Database) {}

	own(id: string): OwnProfile | undefined {
		const row = this.db.all(
			'SELECT id, username, name, pfp, listening_visibility FROM users WHERE id = ?',
			[id]
		)[0];
		if (!row) return undefined;
		return {
			...toProfile(row),
			pfp: image(row.pfp)?.toString('base64') ?? null,
			listeningVisibility: visibility(row.listening_visibility)
		};
	}

	byId(id: string) {
		const row = this.db.all(`${listeningSql} WHERE users.id = ?`, [id])[0];
		return row && toListeningRecord(row);
	}

	byUsername(username: string) {
		const row = this.db.all(`${profileSql} WHERE username = ?`, [username])[0];
		return row && toProfile(row);
	}

	picture(id: string) {
		const row = this.db.all('SELECT pfp FROM users WHERE id = ?', [id])[0];
		return row && image(row.pfp);
	}

	albumArt(id: string) {
		const row = this.db.all(
			'SELECT users.id, users.listening_visibility, live_status.albumArt, live_status.artwork_id FROM users ' +
				'LEFT JOIN live_status ON live_status.user_id = users.id WHERE users.id = ?',
			[id]
		)[0];
		if (!row) return undefined;
		return {
			id: String(row.id),
			visibility: visibility(row.listening_visibility),
			artwork: typeof row.artwork_id === 'string' ? row.artwork_id : null,
			image: image(row.albumArt)
		};
	}

	artwork(id: string, artworkId: string) {
		const row = this.db.all(
			'SELECT albumArt FROM live_status WHERE user_id = ? AND artwork_id = ?',
			[id, artworkId]
		)[0];
		return image(row?.albumArt) ?? undefined;
	}

	rename(id: string, name: string) {
		return this.db.run('UPDATE users SET name = ? WHERE id = ?', [name, id]) > 0;
	}

	setVisibility(id: string, visibility: ListeningVisibility) {
		const sql = 'UPDATE users SET listening_visibility = ? WHERE id = ?';
		return this.db.run(sql, [visibility, id]) > 0;
	}

	setPicture(id: string, picture: Buffer) {
		return this.db.run('UPDATE users SET pfp = ? WHERE id = ?', [picture, id]) > 0;
	}

	recordPlay(id: string, track: Track) {
		const played = JSON.stringify({ ...track, playedAt: new Date().toISOString() });
		return this.db.transaction((transaction) => {
			if (transaction.all('SELECT 1 FROM users WHERE id = ?', [id]).length === 0) return false;
			transaction.run(
				'INSERT INTO live_status (user_id, playing, albumArt, artwork_id) VALUES (?, ?, NULL, NULL) ' +
					'ON CONFLICT(user_id) DO UPDATE SET playing = excluded.playing, ' +
					'albumArt = NULL, artwork_id = NULL',
				[id, played]
			);
			return true;
		});
	}

	setAlbumArt(id: string, artworkId: string, albumArt: Buffer) {
		const sql = 'UPDATE live_status SET albumArt = ?, artwork_id = ? WHERE user_id = ?';
		return this.db.run(sql, [albumArt, artworkId, id]) > 0;
	}

	rekeyArtwork(id: string, artworkId: string) {
		return (
			this.db.run('UPDATE live_status SET artwork_id = ? WHERE user_id = ?', [artworkId, id]) > 0
		);
	}

	delete(id: string) {
		this.db.transaction((transaction) => {
			transaction.run('DELETE FROM pending_requests WHERE user_id = ? OR friend_id = ?', [id, id]);
			transaction.run('DELETE FROM friends_db WHERE user_id = ? OR friend_id = ?', [id, id]);
			transaction.run('DELETE FROM live_status WHERE user_id = ?', [id]);
			transaction.run('DELETE FROM users WHERE id = ?', [id]);
		});
	}
}
