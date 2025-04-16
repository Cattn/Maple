import { friends, pendingRequests, SavedUser } from '$lib/store';
import { get } from 'svelte/store';
import { UserManager } from './api/UserManager';
import type { AddedFriend } from './types/addedfriends';

export async function refreshRequests() {
	pendingRequests.set(await UserManager.getRequests());
}

export async function refreshFriends() {
	friends.set([]);
	const fetchedFriends = await UserManager.getFriends();
	sortFriends(fetchedFriends);
}

async function sortFriends(unsorted: any) {
	friends.set([]);
	let newFriends = unsorted.map((friend: { user_id: any; friend_id: any }) => {
		if (friend.user_id === get(SavedUser).id) {
			return { user_id: get(SavedUser).id, friend_id: friend.friend_id };
		} else {
			return { user_id: get(SavedUser).id, friend_id: friend.user_id };
		}
	});
	newFriends.forEach(async (friend: any) => {
		const friendData = await UserManager.getUserbyId(friend.friend_id);
		const newFriend: AddedFriend = {
			id: friendData.id,
			name: friendData.name,
			username: friendData.username,
			nowPlaying: friendData.nowPlaying
		};
		friends.set([...get(friends), newFriend]);
	});
}
