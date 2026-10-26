import { browser } from '$app/environment';
import { friends, isLoggedIn, pendingRequests, socket } from '$lib/store';
import { io } from 'socket.io-client';
import { toast } from 'svelte-sonner';
import { get } from 'svelte/store';
import { loadSession } from './api/auth';
import { SERVER } from './api/server';
import { UserManager } from './api/UserManager';
import { watchPlayback } from './playback';
import UserSettings from './preferences/usersettings';
import { invalidateFriends, refreshFriends, refreshRequests } from './refreshFriends';
import type { MapleSocket, Profile } from './types';

function label(profile: Profile) {
	return (profile.name || profile.username) + ' (' + profile.username + ')';
}

async function friendship(
	data: { id: string; message: string },
	message: (friend: string) => string
) {
	console.log(data);
	await Promise.all([refreshFriends(), refreshRequests()]);
	const friend = get(friends).find((friend) => friend.id === data.id);
	if (friend) toast.success(message(label(friend)));
}

function listen(client: MapleSocket) {
	let checkedSession = false;
	client.on('connect', () => {
		checkedSession = false;
		console.log('[CLIENT] Socket connected');
	});

	client.on('connect_error', async () => {
		if (client.active || checkedSession) return;
		checkedSession = true;
		if ((await loadSession()) && get(socket) === client) client.connect();
	});

	client.on('disconnect', async (reason) => {
		if (reason === 'io server disconnect' && (await loadSession()) && get(socket) === client) {
			client.connect();
		}
	});

	client.on('friendRequest', async ({ id }) => {
		await refreshRequests();
		const friend = get(pendingRequests).incoming.find((request) => request.id === id);
		if (!friend) return;
		toast.success('Friend request from: ' + label(friend), {
			action: {
				label: 'Accept',
				onClick: () => {
					UserManager.acceptRequest(id);
				}
			}
		});
	});

	client.on('requestAccepted', (data) =>
		friendship(data, (friend) => friend + ' accepted your friend request!')
	);

	client.on('acceptedRequest', (data) =>
		friendship(data, (friend) => 'You are now friends with ' + friend + '!')
	);

	client.on('listening', (data) => {
		invalidateFriends();
		console.log('[CLIENT] Received listening event:', data);
		friends.update((current) =>
			current.map((friend) =>
				friend.id === data.id ? { ...friend, listening: data.listening } : friend
			)
		);
	});

	client.on('friendRemoved', ({ id }) => {
		invalidateFriends();
		friends.update((current) => current.filter((friend) => friend.id !== id));
		pendingRequests.update(({ incoming, outgoing }) => ({
			incoming: incoming.filter((request) => request.id !== id),
			outgoing: outgoing.filter((request) => request.id !== id)
		}));
	});

	watchPlayback(client);
}

export function syncSocket() {
	const current = get(socket);
	if (!get(isLoggedIn) || !UserSettings.preferences.socket) {
		current?.disconnect();
		socket.set(null);
		return;
	}
	if (current) return;
	const client: MapleSocket = io(SERVER, { withCredentials: true });
	listen(client);
	socket.set(client);
}

if (browser) {
	const unsubscribe = isLoggedIn.subscribe((loggedIn) => {
		syncSocket();
		if (loggedIn) {
			void refreshFriends();
			void refreshRequests();
		}
	});
	import.meta.hot?.dispose(() => {
		unsubscribe();
		get(socket)?.disconnect();
		socket.set(null);
	});
}
