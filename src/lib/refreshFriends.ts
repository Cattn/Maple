import { get } from 'svelte/store';
import { accountRevision, friends, pendingRequests, SavedUser } from '$lib/store';
import { UserManager } from './api/UserManager';

async function forAccount<T>(load: () => Promise<T | undefined>, apply: (value: T) => void) {
	const account = get(SavedUser)?.id;
	const revision = accountRevision;
	if (!account) return;
	const value = await load();
	if (value && get(SavedUser)?.id === account && accountRevision === revision) apply(value);
}

export function refreshRequests() {
	return forAccount(UserManager.getRequests, (requests) => pendingRequests.set(requests));
}

let friendsRevision = 0;

export function invalidateFriends() {
	friendsRevision++;
}

export function refreshFriends(): Promise<void> {
	const revision = friendsRevision;
	return forAccount(UserManager.getFriends, (list) => {
		if (revision !== friendsRevision) void refreshFriends();
		else friends.set(list);
	});
}
