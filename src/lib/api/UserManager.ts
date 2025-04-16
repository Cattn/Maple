import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
import { SavedUser, UserInfo, friendNowPlaying } from '$lib/store';
import type { User } from '$lib/types/user';
import { toast } from 'svelte-sonner';
import { get } from 'svelte/store';

export class UserManager {
	private static DevServer = 'http://localhost:3000';
	private static PRODServer = 'https://maple.kolf.pro:3000';
	private static SERVER = this.PRODServer;

	public static register = async (username: string, password: string) => {
		try {
			const response: any = await fetch(`${this.SERVER}/login/create`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ username, password })
			});
			const data = await response.json();
			toast.success('Account created successfully!');
			return data;
		} catch (error) {
			toast.error('Error creating account: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static login = async (username: string, password: string) => {
		try {
			const response = await fetch(`${this.SERVER}/login`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ username, password })
			});
			const data = await response.json();
			const returnName = data.user.username;
			const id = data.user.id;
			UserInfo.set({ username: returnName, id: id });
			toast.success('Welcome back, ' + returnName + '!');
			this.getUser();
			return data;
		} catch (error) {
			toast.error('Error logging in: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static getUser = async () => {
		try {
			const response = await fetch(`${this.SERVER}/get/user/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();

			const returnUser: User = {
				id: data.id,
				username: data.username,
				name: data.name,
				pfp: data.pfp ? `data:image/png;base64,${data.pfp}` : null
			};

			if (response.ok) {
				SavedUser.set(returnUser);
			}
			return returnUser;
		} catch (error) {
			return {
				id: '',
				username: '',
				name: '',
				pfp: null
			};
		}
	};

	public static updateUser = async (user: User): Promise<User | void> => {
		try {
			let returnUser: User = {
				id: user.id,
				username: user.username,
				name: user.name,
				pfp: user.pfp
			};

			if (user.pfp) {
				const formData = new FormData();
				formData.append('pfp', user.pfp);
				formData.append('id', user.id);

				const pfpResponse = await fetch(`${this.SERVER}/user/manage/setProfile/${user.id}`, {
					credentials: 'include',
					method: 'POST',
					body: formData
				});

				const pfpData = await pfpResponse.json();
				if (pfpData.ok) {
					returnUser.pfp = pfpData.pfp;
				}
			}

			if (user.name) {
				const nameResponse = await fetch(`${this.SERVER}/user/manage/setDisplayName/${user.id}`, {
					credentials: 'include',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ displayName: user.name })
				});

				const nameData = await nameResponse.json();
				if (nameData.ok) {
					returnUser.name = nameData.name;
				}
			}
			const newUser = this.getUser();
			toast.success('Profile updated successfully!');
			return newUser;
		} catch (error) {
			toast.error('Error updating profile: "' + error + '"');
			console.error('Error:', error);
			return console.error('Error:', error);
		}
	};

	public static isLoggedIn = async () => {
		if (!get(UserInfo)?.id) {
			return false;
		}
		try {
			const response = await fetch(`${this.SERVER}/get/isAuthenticated/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'GET'
			}).then(async (res) => {
				const response2 = res.clone();
				return res;
			});
			let data;
			try {
				data = await response.json();
			} catch (error) {
				console.error('Error parsing response:', error);
			}
			return data;
		} catch (error) {
			return { isAuthenticated: false };
		}
	};

	public static logOut = async () => {
		try {
			const response = await fetch(`${this.SERVER}/get/logout/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				UserInfo.set({});
			} else {
				return data;
			}
			UserInfo.set({});
			SavedUser.set({} as User);
			toast.success('Logout successful!');
			location.reload();
			return data;
		} catch (error) {
			toast.error('Error logging out: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static getUserName = async (username: string) => {
		try {
			const response = await fetch(`${this.SERVER}/public/get/user/${username}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			} else {
				toast.error('Error fetching username: "' + data.error + '"');
				return;
			}
		} catch (error) {
			toast.error('Error fetching username: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static getUserbyId = async (id: string) => {
		try {
			const response = await fetch(`${this.SERVER}/public/get/user/id/${id}`, {
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
				toast.error('Error fetching user: "' + data.error + '"');
				return;
			}
		} catch (error) {
			toast.error('Error fetching user: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static acceptRequest = async (id: string) => {
		try {
			const response = await fetch(`${this.SERVER}/user/friends/accept/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			toast.error('Error accepting request: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static rejectRequest = async (id: string) => {
		try {
			const response = await fetch(`${this.SERVER}/user/friends/decline/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				toast.success('Request declined successfully!');
				refreshRequests();
				refreshFriends();
				return data;
			}
		} catch (error) {
			toast.error('Error rejecting request: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static addFriend = async (id: string) => {
		try {
			const response = await fetch(`${this.SERVER}/user/friends/add/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			toast.error('Error adding friend: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static getRequests = async () => {
		try {
			const response = await fetch(
				`${this.SERVER}/user/friends/get/requests/${get(UserInfo)?.id}`,
				{
					credentials: 'include',
					method: 'GET'
				}
			);
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			toast.error('Error getting requests: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static getFriends = async () => {
		try {
			const response = await fetch(`${this.SERVER}/user/friends/get/friends/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'GET'
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			toast.error('Error getting friends: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static removeFriend = async (id: string) => {
		try {
			const response = await fetch(`${this.SERVER}/user/friends/remove/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ friendId: id })
			});
			const data = await response.json();
			if (response.ok) {
				toast.success('Friend removed successfully!');
				refreshFriends();
				return data;
			}
		} catch (error) {
			toast.error('Error removing friend: "' + error + '"');
			return console.error('Error:', error);
		}
	};

	public static setAlbumArt = async (albumArt: File) => {
		try {
			const formData = new FormData();
			formData.append('albumArt', albumArt);
			formData.append('id', get(UserInfo)?.id);
			const response = await fetch(`${this.SERVER}/user/manage/setAlbumArt/${get(UserInfo)?.id}`, {
				credentials: 'include',
				method: 'POST',
				body: formData
			});
			const data = await response.json();
			if (response.ok) {
				return data;
			}
		} catch (error) {
			toast.error('Error setting album art: "' + error + '"');
			console.error('Error:', error);
			return null;
		}
	};
}
