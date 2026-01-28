<script lang="ts">
	import '../app.css';
	import '../main.css';
	import SideBar from '$lib/components/SideBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import MobileNowPlaying from '$lib/components/MobileNowPlaying.svelte';
	import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';
	import { isLoggedIn, title, loadPreferencesStore, SavedUser, socket, UserInfo } from '$lib/store';
	import { UserManager } from '$lib/api/UserManager';
	import { onMount } from 'svelte';
	import { Snackbar } from 'm3-svelte';
	import { initTheme } from '$lib/theme/theme';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { socketManager } from '$lib/socketManager';
	import { io } from 'socket.io-client';
	import { browser } from '$app/environment';
	import UserSettings from '$lib/preferences/usersettings';
	import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
	import { SERVER } from '$lib/api/server';
	import { Toaster } from 'svelte-sonner';

	let { children, data } = $props();

	onMount(async () => {
		initTheme();
		loadPreferencesStore.load();

		const hasOnboarded = localStorage.getItem('hasOnboarded');
		const currentPath = $page.url.pathname;
		const excludedPaths = ['/onboard', '/login', '/register'];
		if (!hasOnboarded && !excludedPaths.includes(currentPath)) {
			goto('/onboard');
		}

		const isLoggedInValue = await UserManager.checkSession();
		if (isLoggedInValue) {
			isLoggedIn.set(true);
		} else {
			isLoggedIn.set(false);
		}

		const user = await UserManager.getUser();
		if (user) {
			SavedUser.set(user);
		}

		if (browser) {
			if ($isLoggedIn) {
				if (UserSettings.preferences.socket) {
					const io2 = io(`${SERVER}`, {
						withCredentials: true
					});
					socket.set(io2);
					$socket?.on('connect', () => {
						console.log('Connected to server');
					});
					socketManager();
					refreshFriends();
					refreshRequests();
				}
			}
		}
	});
</script>

<Toaster position="bottom-right" />

<svelte:head>
	<title>{$title}</title>
</svelte:head>

<SideBar />
<div
	class="fixed inset-0 bottom-36 left-0 overflow-x-hidden overflow-y-auto md:bottom-30 md:left-23"
>
	<div>
		{@render children()}
	</div>
</div>

<div class="hidden md:block">
	<BottomBar />
</div>

<div class="block md:hidden">
	<MobileNowPlaying />
	<MobileBottomNav />
</div>
<Snackbar />
