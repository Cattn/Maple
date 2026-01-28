import { SERVER } from '$lib/api/server';
import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
import { friendNowPlaying, SavedUser, UserInfo } from '$lib/store';
import type { User } from '$lib/types';
import { get } from 'svelte/store';

export class UserManager {
	public static register = async (username: string, password: string) => {
		try {
			const response = await fetch(`${SERVER}/login/create`, {
				credentials: 'include',
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = await response.json();
			return data;
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static login = async (username: string, password: string) => {
		try {
			const response = await fetch(`${SERVER}/login`, {
				credentials: 'include',
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const data = await response.json();
			const returnName = data.user.username;
			const id = data.user.id;
			UserInfo.set({ username: returnName, id: id });
			await this.getUser();
			return data;
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static getUser = async () => {
		try {
			const response = await fetch(`${SERVER}/get/user/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			const returnUser: User = {
				id: data.id,
				username: data.username,
				name: data.name,
				pfp: data.pfp ? `data:image/png;base64,${data.pfp}` : undefined
			};
			if (response.ok) {
				SavedUser.set(returnUser);
			}
			return returnUser;
		} catch (e) {
			console.error('Error:', e);
			return { id: '', username: '', name: '', pfp: undefined };
		}
	};

	public static checkSession = async () => {
		try {
			const response = await fetch(`${SERVER}/get/user/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'GET'
			});
			if (response.ok) {
				const data = await response.json();
				const returnUser: User = {
					id: data.id,
					username: data.username,
					name: data.name,
					pfp: data.pfp ? `data:image/png;base64,${data.pfp}` : undefined
				};
				UserInfo.set({ username: returnUser.username, id: returnUser.id });
				SavedUser.set(returnUser);
				return returnUser;
			}
			return null;
		} catch (e) {
			console.error('Error:', e);
			return null;
		}
	};

	public static updateProfilePicture = async (file: File) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const formData = new FormData();
			formData.append('pfp', file);

			const response = await fetch(`${SERVER}/user/manage/setProfile/${userId}`, {
				credentials: 'include',
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await this.getUser();
				return { success: true };
			}
			const data = await response.json();
			return { error: data.error || 'Failed to update profile picture' };
		} catch (e) {
			console.error('Error:', e);
			return { error: 'Failed to update profile picture' };
		}
	};

	public static updateDisplayName = async (displayName: string) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/manage/setDisplayName/${userId}`, {
				credentials: 'include',
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ displayName })
			});

			if (response.ok) {
				await this.getUser();
				return { success: true };
			}
			const data = await response.json();
			return { error: data.error || 'Failed to update display name' };
		} catch (e) {
			console.error('Error:', e);
			return { error: 'Failed to update display name' };
		}
	};

	public static getRequests = async () => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/friends/get/requests/${userId}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static getFriends = async () => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/friends/get/friends/${userId}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static removeFriend = async (id: string) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/friends/remove/${userId}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				refreshFriends();
				return data;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static getUserbyId = async (id: string) => {
		try {
			const response = await fetch(`${SERVER}/public/get/user/id/${id}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				if (data.nowPlaying) {
					friendNowPlaying.set(data.nowPlaying);
				}
				return data;
			} else {
				return;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static getUserName = async (username: string) => {
		try {
			const response = await fetch(`${SERVER}/public/get/user/${username}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			} else {
				return;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static acceptRequest = async (id: string) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/friends/accept/${userId}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static rejectRequest = async (id: string) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/friends/decline/${userId}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				refreshRequests();
				refreshFriends();
				return data;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static addFriend = async (id: string) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const response = await fetch(`${SERVER}/user/friends/add/${userId}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			return console.error('Error:', error);
		}
	};

	public static setAlbumArt = async (file: File) => {
		try {
			const userId = get(UserInfo)?.id;
			if (!userId) return { error: 'Not logged in' };

			const formData = new FormData();
			formData.append('albumArt', file);

			const response = await fetch(`${SERVER}/user/manage/setAlbumArt/${userId}`, {
				credentials: 'include',
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				return { success: true };
			}
			const data = await response.json();
			return { error: data.error || 'Failed to update album art' };
		} catch (e) {
			console.error('Error:', e);
			return { error: 'Failed to update album art' };
		}
	};

	public static isLoggedIn = async () => {
		const userId = get(UserInfo)?.id;
		return !!userId;
	};
}
