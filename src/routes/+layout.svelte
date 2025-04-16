<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { UserManager } from '$lib/api/UserManager';
	import { PeerManager } from '$lib/api/PeerManager';
	import AccTopBar from '$lib/components/AccTopBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import MobileNavBar from '$lib/components/MobileNavBar.svelte';
	import MobileTopBar from '$lib/components/MobileTopBar.svelte';
	import SideBar from '$lib/components/SideBar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import UserSettings from '$lib/preferences/usersettings';
	import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
	import {
		collapsed,
		isLoggedIn,
		isSmallDevice,
		loadPreferencesStore,
		socket,
		title,
		UserInfo
	} from '$lib/store';
	import { io } from 'socket.io-client';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import '../app.pcss';
	import { socketManager } from '../lib/socketManager';
	//@ts-ignore
	import { pwaInfo } from 'virtual:pwa-info';
	//@ts-ignore
	import { registerSW } from 'virtual:pwa-register';
	$: webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';

	const intervalMS = 60 * 60 * 1000; // 1 hour

	if (browser) {
		registerSW({
			onNeedRefresh() {
				//need to add a prompt to the user to update the app
			},
			onOfflineReady() {
				// need to add a toast to the user that the app is ready to work offline
			},
			onRegistered(r: ServiceWorkerRegistration) {
				r &&
					setInterval(() => {
						r.update();
					}, intervalMS);
			}
		});
	}

	let isPWA = false;
	if (browser) {
		isPWA =
			window.matchMedia('(display-mode: standalone)').matches ||
			window.matchMedia('(display-mode: minimal-ui)').matches;
	}

	async function getUserData() {
		await UserManager.getUser();
	}

	// Create a writable store for sidebar state
	const sidebarOpen = writable(true);

	function toggleSidebar() {
		sidebarOpen.update(state => !state);
	}

	onMount(async () => {
		loadPreferencesStore.load();
		if ($UserInfo !== null) {
			await getUserData();
		}
		const authStatus = await UserManager.isLoggedIn();
		if (authStatus !== undefined) {
			isLoggedIn.set(authStatus.isAuthenticated);
		}
		if (browser) {
			if ($isLoggedIn) {
				if (UserSettings.preferences.socket) {
					const io2 = io('https://maple.kolf.pro:3000', {
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
				if (UserSettings.preferences.p2p) {
					PeerManager.createPeer();
				}
			}
		}
	});

	let bottomDiv: HTMLDivElement;

	let isExpanded = false;

	function expand() {
		if (bottomDiv.style.height === '100%') {
			bottomDiv.style.height = 'auto';
			isExpanded = false;
		} else {
			bottomDiv.style.height = '100%';
			isExpanded = true;
		}
	}
	let smallDevice = false;
	const attachListener = (p0: any) => {
		const mediaQuery = window.matchMedia('(max-width: 640px)');
		smallDevice = mediaQuery.matches;
		isSmallDevice.set(smallDevice);

		mediaQuery.addEventListener('change', (event) => {
			smallDevice = event.matches;
			isSmallDevice.set(smallDevice);
		});
	};
</script>

<svelte:window use:attachListener />
<svelte:head>
	<title>{$title}</title>
	{@html webManifestLink}
</svelte:head>
<Toaster position="top-right" />

<div class="flex h-screen flex-col overflow-hidden">
	{#if $page.url.pathname !== '/account/login' && $page.url.pathname !== '/account' && $page.url.pathname !== '/account/register' && $page.url.pathname !== '/account/preferences'}
		{#if !smallDevice}
			<div class="sticky top-0 z-10 border-b bg-background" class:pt-safe={isPWA}>
				<TopBar {toggleSidebar} sidebarOpen={$sidebarOpen} />
			</div>
		{:else}
			<div class="fixed inset-x-0 top-0 z-10 border-b bg-background" class:pt-safe={isPWA}>
				<MobileTopBar />
			</div>
		{/if}
		<div class="flex flex-1 overflow-hidden">
			{#if !smallDevice}
				<div class="flex-none transition-all duration-300" class:w-60={$sidebarOpen} class:w-16={!$sidebarOpen}>
					<SideBar open={$sidebarOpen} {toggleSidebar} />
				</div>
			{/if}
			{#if !smallDevice}
				<div class="scrollbar flex-1 overflow-auto">
					<slot />
				</div>
			{:else}
				<div class="scrollbar mb-36 mt-12 flex-1 overflow-auto">
					<slot />
				</div>
			{/if}
		</div>
	{:else}
		{#if !smallDevice}
			<div class="sticky top-0 z-10 border-b bg-background">
				<AccTopBar />
			</div>
		{:else}
			<div class="fixed inset-x-0 top-0 z-10 border-b bg-background">
				<AccTopBar />
			</div>
		{/if}
		<div class="flex flex-1 overflow-hidden">
			{#if !smallDevice}
				<div class="scrollbar flex-1 overflow-auto">
					<slot />
				</div>
			{:else}
				<div class="scrollbar mb-36 mt-12 flex-1 overflow-auto">
					<slot />
				</div>
			{/if}
		</div>
	{/if}
	{#if !smallDevice}
		<div bind:this={bottomDiv} class="sticky bottom-0 z-10 border-t bg-background transition">
			<BottomBar on:expand={expand} />
		</div>
	{:else}
		<div class="fixed inset-x-0 bottom-0 z-10 border-t bg-background" bind:this={bottomDiv}>
			<div class="mb-16 h-full">
				<BottomBar on:expand={expand} />
			</div>
			{#if !isExpanded}
				<div class="pb-safe absolute inset-x-0 bottom-0 bg-background">
					<MobileNavBar />
				</div>
			{/if}
		</div>
	{/if}
</div>
