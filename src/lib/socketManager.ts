import { browser } from '$app/environment';
import { socket as importedSocket, friends } from '$lib/store';
import { toast } from 'svelte-sonner';
import { get } from 'svelte/store';
import { UserManager } from './api/UserManager';
import { refreshFriends, refreshRequests } from './refreshFriends';

export const socketManager = () => {
	if (browser) {
		let socket = get(importedSocket);

		socket?.on('connect', () => {
			console.log('[CLIENT] Socket connected');
		});

		socket?.on('friendRequest', async (data) => {
			const id = data.id;
			const friend = await UserManager.getUserbyId(id);
			toast.success('Friend request from: ' + friend.name + ' (' + friend.username + ')', {
				action: {
					label: 'Accept',
					onClick: () => {
						UserManager.acceptRequest(id);
					}
				}
			});
			refreshRequests();
		});

		socket?.on('notFound', async () => {
			toast.error('Friend request failed: User not found');
		});

		socket?.on('error', async (data) => {
			toast.error(data);
		});

		socket?.on('requestAccepted', async (data) => {
			console.log(data);
			const id = data.id;
			const friend = await UserManager.getUserbyId(id);
			toast.success(friend.name + ' (' + friend.username + ') accepted your friend request!');
			refreshFriends();
			refreshRequests();
		});

		socket?.on('acceptedRequest', async (data) => {
			console.log(data);
			const id = data.id;
			const friend = await UserManager.getUserbyId(id);
			toast.success('You are now friends with ' + friend.name + ' (' + friend.username + ')!');
			refreshFriends();
			refreshRequests();
		});

		socket?.on('nowPlaying', async (data) => {
			console.log('[CLIENT] Received nowPlaying event:', data);
			console.log('[CLIENT] Current socket ID:', socket?.id);
			if (data.id && data.nowPlaying) {
				friends.update((currentFriends) => {
					return currentFriends.map((friend) => {
						if (friend.id === data.id) {
							return {
								...friend,
								nowPlaying: {
									title: data.nowPlaying.title,
									artist: data.nowPlaying.artist,
									album: data.nowPlaying.album
								}
							};
						}
						return friend;
					});
				});
			}
		});
	}
};
