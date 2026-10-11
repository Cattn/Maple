/* eslint-disable no-unused-vars */
const pool = require('../db');

module.exports = {
	addFriend: async function (user, friend, socket, io) {
		try {
			const clients = await this.getSocket(io, friend);
			if (clients.length > 0) {
				console.log(`[IO] Found ${clients.length} sockets for user ${friend}, emitting friendRequest`);
				clients.forEach(client => {
					io.to(client.id).emit('friendRequest', { id: user });
				});
			}
		} catch (error) {
			console.error(error);
		}
	},

	getSocket: async function (io, id) {
		try {
			console.log(`[IO] Getting socket for ${id}`);
			const clients = await io.fetchSockets();
			console.log(`[IO] Found ${clients.length} sockets`);
			const userSockets = clients.filter(client => client.user.id === id);
			console.log(`[IO] Found ${userSockets.length} sockets for user ${id}`);
			return userSockets;
		} catch (error) {
			console.error(error);
			return [];
		}
	},

	nowPlaying: function (user, friends, io, nowPlaying) {
		try {
			console.log(`[IO] Processing nowPlaying for user ${user} with ${friends.length} friends`);
			pool.promise().query(
				'INSERT INTO live_status (user_id, playing) VALUES (?, ?) ' +
				'ON DUPLICATE KEY UPDATE playing = VALUES(playing)',
				[user, JSON.stringify(nowPlaying)]
			);
			friends.forEach(async (friend) => {
				const targetId = friend.user_id === user ? friend.friend_id : friend.user_id;
				console.log(`[IO] Looking for sockets for friend ${targetId} (relationship: ${JSON.stringify(friend)})`);
				
				const clients = await this.getSocket(io, targetId);
				if (clients.length > 0) {
					console.log(`[IO] Found ${clients.length} sockets for friend ${targetId}`);
					const message = { nowPlaying: nowPlaying, id: user };
					clients.forEach(client => {
						console.log(`[IO] Emitting to socket ${client.id} for user ${targetId}:`, message);
						io.to(client.id).emit('nowPlaying', message);
					});
				} else {
					console.log(`[IO] No sockets found for friend ${targetId}`);
				}	
			})
		} catch (error) {
			console.error('[ERROR] Error in nowPlaying:', error);
		}
	},

	emit: async function (socket, event, data, io) {
		try {
			const clients = await this.getSocket(io, socket.user.id);
			if (clients.length > 0) {
				console.log(`[IO] Found ${clients.length} sockets for user ${socket.user.id}, emitting ${event}`);
				clients.forEach(client => {
					io.to(client.id).emit(event, data);
				});
			}
		} catch (error) {
			console.error(error);
		}
	},

	discordRPC: function (user, _friends, io, nowPlaying, target) {
		try {
			const rpcData = nowPlaying.playing === false ? { playing: false } : {
				artist: nowPlaying.artist || undefined,
				title: nowPlaying.title || undefined,
				state: nowPlaying.artist ? `by ${nowPlaying.artist}` : undefined,
				largeImageKey: nowPlaying.image ? `data:image/jpeg;base64,${nowPlaying.image}` : "maple",
				largeImageText: nowPlaying.album || undefined,
				id: user,
				album: nowPlaying.album || undefined,
				artworkId: nowPlaying.artworkId,
				artworkWait: nowPlaying.artworkWait,
				playing: true,
				position: nowPlaying.position,
				duration: nowPlaying.duration,
				playbackRate: nowPlaying.playbackRate ?? 1,
				smallImageKey: "play",
				smallText: "Listening to Maple",
				buttons: [
					{
						label: "Listen on Maple",
						url: `https://maple.kolf.pro/user/${user}`
					}
				]
			};

			const clients = target ? [target] : [...io.sockets.sockets.values()].filter(client => client.user.id === user);
			if (clients.length > 0) {
				console.log(`[IO] Found ${clients.length} sockets for user ${user}, emitting discordRPC`);
				clients.forEach(client => {
					client.emit('rpcUpdate', rpcData);
				});
			}
		} catch (error) {
			console.error('[ERROR] Error in discordRPC:', error);
		}
	},

	emitAll: async function (id, title, data, io) {
		try {
			const clients = await this.getSocket(io, id);
			if (clients.length > 0) {
				console.log(`[IO] Found ${clients.length} sockets for user ${id}, emitting to ALL clients`)
				clients.forEach(client => {
					client.emit(title, data)
				})
			}
			else {
				console.log(`[IO] No sockets found for user ${id}, NOT emitting to ALL clients`)
			}
		} catch (error) {
			console.error('[ERROR] Error in emitAll: \n', error);
		}
	}
};
