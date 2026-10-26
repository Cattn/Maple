import { accountRoom } from '../iomanager/io.js';
import type { Database, Statements } from '../storage/sqlite.js';
import type { FriendOutcome, FriendRequests, ListeningRecord } from '../types/profile.js';
import type { MapleServer } from '../types/socket.js';
import { listeningSql, profileSql, toListeningRecord, toProfile } from './profiles.js';

const pairSql = '(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)';
const friendIdsSql =
	'(SELECT friend_id FROM friends_db WHERE user_id = ? ' +
	'UNION SELECT user_id FROM friends_db WHERE friend_id = ?)';

type Work = (transaction: Statements, friend: string) => FriendOutcome;

function pair(id: string, friend: string) {
	return [id, friend, friend, id];
}

function areFriends(transaction: Statements, id: string, friend: string) {
	return transaction.all(`SELECT 1 FROM friends_db WHERE ${pairSql}`, pair(id, friend)).length > 0;
}

function hasRequest(transaction: Statements, from: string, to: string) {
	const sql = 'SELECT 1 FROM pending_requests WHERE user_id = ? AND friend_id = ?';
	return transaction.all(sql, [from, to]).length > 0;
}

export class FriendshipManager {
	constructor(
		private readonly db: Database,
		private readonly io: MapleServer
	) {}

	friends(id: string): ListeningRecord[] {
		return this.db
			.all(
				`${listeningSql} WHERE users.id <> ? AND users.id IN ${friendIdsSql} ORDER BY users.username`,
				[id, id, id]
			)
			.map(toListeningRecord);
	}

	friendIds(id: string) {
		return this.db
			.all(`SELECT id FROM users WHERE id <> ? AND id IN ${friendIdsSql}`, [id, id, id])
			.map((row) => String(row.id));
	}

	requests(id: string): FriendRequests {
		const sql = (from: string, to: string) =>
			`${profileSql} WHERE id <> ? AND id IN ` +
			`(SELECT ${from} FROM pending_requests WHERE ${to} = ?) ORDER BY username`;
		return {
			incoming: this.db.all(sql('user_id', 'friend_id'), [id, id]).map(toProfile),
			outgoing: this.db.all(sql('friend_id', 'user_id'), [id, id]).map(toProfile)
		};
	}

	request(id: string, friendId: string) {
		const change = this.change(id, friendId, (transaction, friend) => {
			if (areFriends(transaction, id, friend)) return 'friends';
			if (hasRequest(transaction, friend, id)) return 'incoming';
			if (hasRequest(transaction, id, friend)) return 'pending';
			transaction.run('INSERT INTO pending_requests (user_id, friend_id) VALUES (?, ?)', [
				id,
				friend
			]);
			return 'ok';
		});
		if (change.outcome === 'ok') {
			this.io.to(accountRoom(change.friend)).emit('friendRequest', { id });
		}
		return change.outcome;
	}

	accept(id: string, friendId: string) {
		const change = this.change(id, friendId, (transaction, friend) => {
			if (areFriends(transaction, id, friend)) return 'friends';
			if (!hasRequest(transaction, friend, id)) return 'noRequest';
			transaction.run(`DELETE FROM pending_requests WHERE ${pairSql}`, pair(id, friend));
			transaction.run('INSERT INTO friends_db (user_id, friend_id) VALUES (?, ?)', [id, friend]);
			return 'ok';
		});
		if (change.outcome === 'ok') {
			// const userSocket = await ioTools.getSocket(io, id);
			// if (userSocket && id !== friendId) {
			// 	ioTools.emitAll(id, "requestAccepted", { id: friendId, message: 'Friend request accepted!' }, io);
			// } else if (userSocket) {
			// 	ioTools.emitAll(id, "requestAccepted", { id: id, message: 'Friend request accepted!' }, io);
			// }

			const message = 'Friend request accepted!';
			this.io.to(accountRoom(change.friend)).emit('requestAccepted', { id, message });
			this.io.to(accountRoom(id)).emit('acceptedRequest', { id: change.friend, message });
		}
		return change.outcome;
	}

	decline(id: string, friendId: string) {
		return this.change(id, friendId, (transaction, friend) => {
			const deleted = transaction.run(
				`DELETE FROM pending_requests WHERE ${pairSql}`,
				pair(id, friend)
			);
			return deleted > 0 ? 'ok' : 'noRequest';
		}).outcome;
	}

	remove(id: string, friendId: string) {
		const change = this.change(id, friendId, (transaction, friend) => {
			const deleted = transaction.run(`DELETE FROM friends_db WHERE ${pairSql}`, pair(id, friend));
			return deleted > 0 ? 'ok' : 'notFriends';
		});
		if (change.outcome === 'ok') {
			this.io.to(accountRoom(id)).emit('friendRemoved', { id: change.friend });
			this.io.to(accountRoom(change.friend)).emit('friendRemoved', { id });
		}
		return change.outcome;
	}

	private change(id: string, friendId: string, work: Work) {
		return this.db.transaction((transaction): { outcome: FriendOutcome; friend: string } => {
			const friend = transaction.all('SELECT id FROM users WHERE id = ?', [friendId])[0]?.id;
			if (typeof friend !== 'string') return { outcome: 'missing', friend: friendId };
			if (friend.toLowerCase() === id.toLowerCase()) return { outcome: 'self', friend };
			return { outcome: work(transaction, friend), friend };
		});
	}
}
