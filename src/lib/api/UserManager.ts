import { SERVER } from '$lib/api/server';
import { accountRevision, clearAccount } from '$lib/store';
import type { Friend, FriendRequests, ListeningVisibility, Profile, User } from '$lib/types';

type Result = { success: true } | { error: string };

async function request(path: string, init: RequestInit = {}) {
	const revision = accountRevision;
	const response = await fetch(`${SERVER}${path}`, {
		credentials: 'include',
		signal: AbortSignal.timeout(10000),
		...init
	});
	if (response.status === 401 && accountRevision === revision) clearAccount();
	return response;
}

async function read<T>(path: string): Promise<T | undefined> {
	try {
		const response = await request(path);
		if (response.ok) return await response.json();
	} catch (error) {
		console.error('Error:', error);
	}
}

async function send(path: string, init: RequestInit, fallback: string): Promise<Result> {
	try {
		const response = await request(path, init);
		if (response.ok) return { success: true };
		const data: { error?: string } = await response.json().catch(() => ({}));
		return { error: data.error || fallback };
	} catch (e) {
		console.error('Error:', e);
		return { error: fallback };
	}
}

function json(method: string, body: unknown): RequestInit {
	return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function form(fields: Record<string, string | File>): RequestInit {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.append(key, value);
	return { method: 'PUT', body: formData };
}

export class UserManager {
	public static getMe = async () => {
		const user = await read<User>('/get/me');
		return (
			user && {
				...user,
				pfp: user.pfp
					? `${SERVER}/public/get/pfp/${encodeURIComponent(user.id)}?v=${Date.now()}`
					: null
			}
		);
	};

	public static updateProfilePicture = (file: File) =>
		send('/user/manage/me/pfp', form({ pfp: file }), 'Failed to update profile picture');

	public static updateDisplayName = (displayName: string) =>
		send('/user/manage/me', json('PATCH', { displayName }), 'Failed to update display name');

	public static setListeningVisibility = (visibility: ListeningVisibility) =>
		send(
			'/user/manage/me/listening',
			json('PATCH', { visibility }),
			'Failed to update listening visibility'
		);

	public static setAlbumArt = (file: File, playbackId: string) =>
		send(
			'/user/manage/me/albumArt',
			{ ...form({ playbackId, albumArt: file }), signal: AbortSignal.timeout(15000) },
			'Failed to update album art'
		);

	public static getFriends = () => read<Friend[]>('/user/friends/me');

	public static getRequests = () => read<FriendRequests>('/user/friends/me/requests');

	public static addFriend = (id: string) =>
		send(
			`/user/friends/me/requests/${encodeURIComponent(id)}`,
			{ method: 'POST' },
			'Failed to send friend request'
		);

	public static acceptRequest = (id: string) =>
		send(
			`/user/friends/me/requests/${encodeURIComponent(id)}/accept`,
			{ method: 'POST' },
			'Failed to accept friend request'
		);

	public static rejectRequest = (id: string) =>
		send(
			`/user/friends/me/requests/${encodeURIComponent(id)}`,
			{ method: 'DELETE' },
			'Failed to remove friend request'
		);

	public static removeFriend = (id: string) =>
		send(
			`/user/friends/me/${encodeURIComponent(id)}`,
			{ method: 'DELETE' },
			'Failed to remove friend'
		);

	public static getUserName = (username: string) =>
		read<Profile>(`/public/get/user/${encodeURIComponent(username)}`);
}
