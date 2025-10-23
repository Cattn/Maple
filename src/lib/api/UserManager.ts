import { SERVER } from '$lib/api/server';
import { SavedUser, UserInfo } from '$lib/store';
import type { User } from '$lib/types';
import { toast } from 'svelte-sonner';
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
                pfp: data.pfp ? `data:image/png;base64,${data.pfp}` : null
            };
            if (response.ok) {
                SavedUser.set(returnUser);
            }
            return returnUser;
        } catch (_error) {
            return { id: '', username: '', name: '', pfp: null } as User;
        }
    };
}

