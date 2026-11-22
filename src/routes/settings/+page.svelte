<script lang="ts">
	import { Button, Dialog, Switch } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { version, dev } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { toast } from 'svelte-sonner';
	import {
		isLoggedIn,
		SavedUser,
		appInstallPrompt,
		appInstalled,
		appUpdateReady,
		title
	} from '$lib/store';
	import {
		themeSettings,
		setThemeSettings,
		persistThemeSettings,
		DEFAULT_SOURCE_COLOR
	} from '$lib/theme/theme';
	import { UserManager } from '$lib/api/UserManager';
	import { loadSession } from '$lib/api/auth';
	import UserSettings from '$lib/preferences/usersettings';
	import { Settings } from '$lib/preferences/fetch';
	import { syncSocket } from '$lib/socketManager';
	import AccountSecurity from '$lib/components/AccountSecurity.svelte';
	import ThemeColorPicker from '$lib/components/ThemeColorPicker.svelte';
	import { OPFS } from '$lib/opfs';
	import { IFS, type LinkedFolder } from '$lib/ifs';
	import { createLibrary, refreshLinkedFolder, relinkFolder } from '$lib/library';
	import { albums, playlists, refreshLibrary, tracks } from '$lib/global.svelte';

	type SectionId = 'account' | 'appearance' | 'library' | 'connections' | 'app';

	let activeSection = $state<SectionId>(get(isLoggedIn) ? 'account' : 'appearance');
	let hasManuallyNavigated = false;
	let mobileTabsEl: HTMLElement | undefined = $state();
	let tabsCanScrollLeft = $state(false);
	let tabsCanScrollRight = $state(false);

	// Account / Profile state
	let name = $state($SavedUser?.name ?? '');
	let initialName = $state($SavedUser?.name ?? '');
	let listeningPublic = $state($SavedUser?.listeningVisibility !== 'private');
	let initialListeningPublic = $state($SavedUser?.listeningVisibility !== 'private');
	let pfpFile = $state<File | null>(null);
	let pfpPreview = $state<string | null>(null);
	let pfpUploading = $state(false);
	let copiedId = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	// PWA / App install state (function declarations kept at top level for pwa-install.test.mjs)
	let appWindow = $state(false);
	let installingApp = $state(false);
	let reloadingApp = $state(false);
	let installMessage = $state('');

	async function installApp() {
		const prompt = $appInstallPrompt;
		if (!prompt || installingApp) return;
		installingApp = true;
		installMessage = '';
		appInstallPrompt.set(null);
		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;
			if (choice.outcome === 'accepted') {
				installMessage = 'Installation requested. Your browser will confirm when it is complete.';
			}
		} catch (error) {
			installMessage = 'Installation could not start. Try Install app in your browser menu.';
			console.error('Unable to prompt for app installation:', error);
		} finally {
			installingApp = false;
		}
	}

	function reloadApp() {
		const registration = $appUpdateReady;
		if (!registration?.waiting || reloadingApp) return;
		reloadingApp = true;
		navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
			once: true
		});
		registration.waiting.postMessage({ type: 'SKIP_WAITING' });
	}

	// Integrations & Discord state
	const webhookSettings = new Settings('webhook');
	const initialWebhookEnabledValue =
		webhookSettings.get('enabled') !== null ? webhookSettings.get('enabled') : false;
	let webhookEnabled = $state<boolean>(initialWebhookEnabledValue);
	let initialWebhookEnabled = $state<boolean>(initialWebhookEnabledValue);

	const initialWebhookUrlValue =
		webhookSettings.get('url') !== null ? webhookSettings.get('url') : '';
	let webhookUrl = $state<string>(initialWebhookUrlValue);
	let initialWebhookUrl = $state<string>(initialWebhookUrlValue);

	const discordSettings = new Settings('discord');
	const initialDiscordRpcValue =
		discordSettings.get('enabled') !== null ? discordSettings.get('enabled') : false;
	let discordRpcEnabled = $state<boolean>(initialDiscordRpcValue);
	let initialDiscordRpcEnabled = $state<boolean>(initialDiscordRpcValue);

	// Preferences state
	const preferencesSettings = new Settings('preferences');
	let externalLyrics = $state<boolean>(UserSettings.preferences.addExternalLyrics);
	let initialExternalLyrics = $state<boolean>(UserSettings.preferences.addExternalLyrics);

	const initialSocketValue =
		preferencesSettings.get('socket') !== null ? preferencesSettings.get('socket') : true;
	let socketCommunicationEnabled = $state<boolean>(initialSocketValue);
	let initialSocketCommunicationEnabled = $state<boolean>(initialSocketValue);

	const initialJellyfinValue =
		preferencesSettings.get('jellyfinMode') !== null
			? preferencesSettings.get('jellyfinMode')
			: false;
	let jellyfinModeEnabled = $state<boolean>(initialJellyfinValue);
	let initialJellyfinModeEnabled = $state<boolean>(initialJellyfinValue);

	const initialP2pValue =
		preferencesSettings.get('p2p') !== null ? preferencesSettings.get('p2p') : true;
	let p2pTransfersEnabled = $state<boolean>(initialP2pValue);
	let initialP2pTransfersEnabled = $state<boolean>(initialP2pValue);

	const initialLoggingValue =
		preferencesSettings.get('showLogging') !== null
			? preferencesSettings.get('showLogging')
			: false;
	let loggingEnabled = $state<boolean>(initialLoggingValue);
	let initialLoggingEnabled = $state<boolean>(initialLoggingValue);

	const initialDevModeValue =
		preferencesSettings.get('devMode') !== null ? preferencesSettings.get('devMode') : false;
	let developerModeEnabled = $state<boolean>(initialDevModeValue);
	let initialDeveloperModeEnabled = $state<boolean>(initialDevModeValue);

	// Theme state (live preview on edit, persisted on Save)
	const initialTheme = get(themeSettings);
	let themeSourceColor = $state<string>(initialTheme.sourceColor || DEFAULT_SOURCE_COLOR);
	let initialThemeSourceColor = $state<string>(initialTheme.sourceColor || DEFAULT_SOURCE_COLOR);
	let themeDarkMode = $state<boolean>(initialTheme.isDarkMode);
	let initialThemeDarkMode = $state<boolean>(initialTheme.isDarkMode);

	// Library state
	let trackCount = $derived(tracks().length);
	let albumCount = $derived(albums().length);
	let playlistCount = $derived(playlists().length);
	let clearDialogOpen = $state(false);
	let clearingLibrary = $state(false);
	const linkedFolders = IFS.linkedFolders;
	let foldersLoadFailed = $state(false);
	let refreshingFolder = $state<string | null>(null);
	let unavailableFolders = $state<string[]>([]);
	let locationCheck = 0;
	let foldersByName = $derived(
		[...$linkedFolders].sort((a, b) => a.handle.name.localeCompare(b.handle.name))
	);
	let sourceCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const { source } of tracks()) {
			const id = source?.kind === 'linked-folder' ? source.folderId : 'internal';
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		return counts;
	});

	$effect(() => {
		if (activeSection !== 'library') return;
		foldersLoadFailed = false;
		IFS.loadFolders().catch(() => (foldersLoadFailed = true));
	});

	async function checkLocations(folders: LinkedFolder[]) {
		const check = ++locationCheck;
		const missing = await Promise.all(folders.map(async ({ id, handle }) =>
			(await IFS.needsRelink(handle)) ? id : null
		));
		if (check === locationCheck) unavailableFolders = missing.filter((id) => id !== null);
	}

	$effect(() => {
		if (activeSection !== 'library') return;
		const folders = $linkedFolders;
		const check = () => void checkLocations(folders);
		check();
		window.addEventListener('focus', check);
		return () => {
			window.removeEventListener('focus', check);
			locationCheck++;
		};
	});

	async function refreshSource(folder: LinkedFolder) {
		if (refreshingFolder || clearingLibrary) return;
		refreshingFolder = folder.id;
		try {
			if (unavailableFolders.includes(folder.id)) await relinkFolder(folder);
			else await refreshLinkedFolder(folder);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not access the linked folder.');
		} finally {
			refreshingFolder = null;
			if (activeSection === 'library') await checkLocations($linkedFolders);
		}
	}
	let saving = $state(false);

	// Sync profile fields whenever SavedUser updates
	$effect(() => {
		name = $SavedUser?.name ?? '';
		initialName = $SavedUser?.name ?? '';
		listeningPublic = $SavedUser?.listeningVisibility !== 'private';
		initialListeningPublic = listeningPublic;
	});

	// Keep active section valid when auth state changes
	$effect(() => {
		if (!$isLoggedIn && activeSection === 'account') {
			activeSection = 'appearance';
		} else if ($isLoggedIn && !hasManuallyNavigated) {
			activeSection = 'account';
		}
	});

	function updateTabsScrollState() {
		if (!mobileTabsEl) return;
		const { scrollLeft, scrollWidth, clientWidth } = mobileTabsEl;
		tabsCanScrollLeft = scrollLeft > 4;
		tabsCanScrollRight = scrollLeft + clientWidth < scrollWidth - 4;
	}

	function scrollMobileTabs(direction: -1 | 1) {
		if (!mobileTabsEl) return;
		mobileTabsEl.scrollBy({ left: direction * 160, behavior: 'smooth' });
	}

	$effect(() => {
		const el = mobileTabsEl;
		navItems.length;
		if (!el) return;
		const frame = requestAnimationFrame(updateTabsScrollState);
		const observer = new ResizeObserver(updateTabsScrollState);
		observer.observe(el);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

	function selectSection(id: SectionId, button?: HTMLElement | null) {
		hasManuallyNavigated = true;
		activeSection = id;
		button?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
	}

	function previewTheme(nextColor: string, nextDark: boolean) {
		themeSourceColor = nextColor;
		themeDarkMode = nextDark;
		setThemeSettings({ sourceColor: nextColor, isDarkMode: nextDark });
	}

	function handleFileSelect(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file) return;
		if (file.size > 3 * 1024 * 1024) {
			toast.error('Profile photo must be 3 MB or smaller.');
			return;
		}
		pfpFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			pfpPreview = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function clearStagedPhoto() {
		pfpFile = null;
		pfpPreview = null;
	}

	async function copyAccountId() {
		const id = $SavedUser?.id;
		if (!id) return;
		try {
			await navigator.clipboard.writeText(id);
			copiedId = true;
			toast.success('Account ID copied.');
			setTimeout(() => {
				copiedId = false;
			}, 2000);
		} catch {
			toast.error('Could not copy Account ID.');
		}
	}

	// Per-section change counters (only count logged-in-only fields when signed in)
	let accountChanges = $derived(
		$isLoggedIn ? Number(pfpFile !== null) + Number(name !== initialName) : 0
	);
	let appearanceChanges = $derived(
		Number(themeSourceColor.toLowerCase() !== initialThemeSourceColor.toLowerCase()) +
			Number(themeDarkMode !== initialThemeDarkMode)
	);
	let libraryChanges = $derived(
		Number(jellyfinModeEnabled !== initialJellyfinModeEnabled) +
			Number(externalLyrics !== initialExternalLyrics)
	);
	let connectionsChanges = $derived(
		($isLoggedIn
			? Number(listeningPublic !== initialListeningPublic) +
				Number(socketCommunicationEnabled !== initialSocketCommunicationEnabled) +
				Number(discordRpcEnabled !== initialDiscordRpcEnabled)
			: 0) + Number(webhookEnabled !== initialWebhookEnabled || webhookUrl !== initialWebhookUrl)
	);
	let appChanges = $derived(
		Number(p2pTransfersEnabled !== initialP2pTransfersEnabled) +
			Number(loggingEnabled !== initialLoggingEnabled) +
			Number(developerModeEnabled !== initialDeveloperModeEnabled)
	);

	let changedCount = $derived(
		accountChanges + appearanceChanges + libraryChanges + connectionsChanges + appChanges
	);
	let hasChanges = $derived(changedCount > 0);

	type NavItem = {
		id: SectionId;
		label: string;
		changes: number;
	};

	let navItems = $derived<NavItem[]>([
		...($isLoggedIn ? [{ id: 'account' as const, label: 'Account', changes: accountChanges }] : []),
		{ id: 'appearance', label: 'Appearance', changes: appearanceChanges },
		{ id: 'library', label: 'Library', changes: libraryChanges },
		{
			id: 'connections',
			label: $isLoggedIn ? 'Connections' : 'Integrations',
			changes: connectionsChanges
		},
		{ id: 'app', label: 'App', changes: appChanges }
	]);

	function discardChanges() {
		name = initialName;
		listeningPublic = initialListeningPublic;
		pfpFile = null;
		pfpPreview = null;
		webhookEnabled = initialWebhookEnabled;
		webhookUrl = initialWebhookUrl;
		discordRpcEnabled = initialDiscordRpcEnabled;
		p2pTransfersEnabled = initialP2pTransfersEnabled;
		externalLyrics = initialExternalLyrics;
		socketCommunicationEnabled = initialSocketCommunicationEnabled;
		jellyfinModeEnabled = initialJellyfinModeEnabled;
		loggingEnabled = initialLoggingEnabled;
		developerModeEnabled = initialDeveloperModeEnabled;
		previewTheme(initialThemeSourceColor, initialThemeDarkMode);
	}

	async function saveChanges() {
		if (!hasChanges || saving) return;
		saving = true;

		try {
			const loggedIn = get(isLoggedIn);

			if (loggedIn) {
				const profileChanged =
					pfpFile !== null || name !== initialName || listeningPublic !== initialListeningPublic;

				if (pfpFile) {
					pfpUploading = true;
					const result = await UserManager.updateProfilePicture(pfpFile);
					pfpUploading = false;
					if ('error' in result) {
						toast.error(result.error);
						return;
					}
					pfpFile = null;
					pfpPreview = null;
				}

				if (name !== initialName) {
					const result = await UserManager.updateDisplayName(name);
					if ('error' in result) {
						toast.error(result.error);
						return;
					}
					initialName = name;
				}

				if (listeningPublic !== initialListeningPublic) {
					const result = await UserManager.setListeningVisibility(
						listeningPublic ? 'public' : 'private'
					);
					if ('error' in result) {
						toast.error(result.error);
						return;
					}
					initialListeningPublic = listeningPublic;
				}

				if (profileChanged) await loadSession();

				if (socketCommunicationEnabled !== initialSocketCommunicationEnabled) {
					preferencesSettings.set('socket', socketCommunicationEnabled);
					UserSettings.preferences.socket = socketCommunicationEnabled;
					syncSocket();
					initialSocketCommunicationEnabled = socketCommunicationEnabled;
				}

				if (discordRpcEnabled !== initialDiscordRpcEnabled) {
					discordSettings.set('enabled', discordRpcEnabled);
					UserSettings.discord.enabled = discordRpcEnabled;
					initialDiscordRpcEnabled = discordRpcEnabled;
				}
			}

			if (externalLyrics !== initialExternalLyrics) {
				preferencesSettings.set('addExternalLyrics', externalLyrics);
				UserSettings.preferences.addExternalLyrics = externalLyrics;
				initialExternalLyrics = externalLyrics;
			}

			if (jellyfinModeEnabled !== initialJellyfinModeEnabled) {
				preferencesSettings.set('jellyfinMode', jellyfinModeEnabled);
				UserSettings.preferences.jellyfinMode = jellyfinModeEnabled;
				initialJellyfinModeEnabled = jellyfinModeEnabled;
			}

			if (p2pTransfersEnabled !== initialP2pTransfersEnabled) {
				preferencesSettings.set('p2p', p2pTransfersEnabled);
				UserSettings.preferences.p2p = p2pTransfersEnabled;
				initialP2pTransfersEnabled = p2pTransfersEnabled;
			}

			if (loggingEnabled !== initialLoggingEnabled) {
				preferencesSettings.set('showLogging', loggingEnabled);
				UserSettings.preferences.showLogging = loggingEnabled;
				initialLoggingEnabled = loggingEnabled;
			}

			if (developerModeEnabled !== initialDeveloperModeEnabled) {
				preferencesSettings.set('devMode', developerModeEnabled);
				UserSettings.preferences.devMode = developerModeEnabled;
				initialDeveloperModeEnabled = developerModeEnabled;
			}

			if (webhookEnabled !== initialWebhookEnabled || webhookUrl !== initialWebhookUrl) {
				webhookSettings.set('enabled', webhookEnabled);
				webhookSettings.set('url', webhookUrl);
				UserSettings.webhook.enabled = webhookEnabled;
				UserSettings.webhook.url = webhookUrl;
				initialWebhookEnabled = webhookEnabled;
				initialWebhookUrl = webhookUrl;
			}

			if (
				themeSourceColor.toLowerCase() !== initialThemeSourceColor.toLowerCase() ||
				themeDarkMode !== initialThemeDarkMode
			) {
				persistThemeSettings({ sourceColor: themeSourceColor, isDarkMode: themeDarkMode });
				initialThemeSourceColor = themeSourceColor;
				initialThemeDarkMode = themeDarkMode;
			}

			toast.success('Settings saved.');
		} finally {
			saving = false;
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && hasChanges) {
			event.preventDefault();
			void saveChanges();
		}
	}

	async function confirmClearLibrary() {
		if (clearingLibrary) return;
		clearingLibrary = true;
		clearDialogOpen = false;
		try {
			await OPFS.clearLibrary();
			await IFS.clearFolders();
			await OPFS.initializeLibrary();
			await refreshLibrary();
			toast.success('Library cleared.');
		} finally {
			clearingLibrary = false;
		}
	}

	onMount(async () => {
		appWindow = window.matchMedia(
			'(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen)'
		).matches;
		title.set('Settings');

		const storedTheme = get(themeSettings);
		themeSourceColor = storedTheme.sourceColor || DEFAULT_SOURCE_COLOR;
		initialThemeSourceColor = themeSourceColor;
		themeDarkMode = storedTheme.isDarkMode;
		initialThemeDarkMode = themeDarkMode;

		if (tracks().length === 0) {
			await refreshLibrary();
		}
	});

	onDestroy(() => {
		if (
			themeSourceColor.toLowerCase() !== initialThemeSourceColor.toLowerCase() ||
			themeDarkMode !== initialThemeDarkMode
		) {
			setThemeSettings({ sourceColor: initialThemeSourceColor, isDarkMode: initialThemeDarkMode });
		}
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#snippet sectionIcon(id: SectionId, size: number)}
	{#if id === 'account'}
		<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
			/>
		</svg>
	{:else if id === 'appearance'}
		<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M12 22q-2.05 0-3.875-.788t-3.187-2.15t-2.15-3.187T2 12q0-2.075.813-3.9t2.2-3.175T8.25 2.788T12.2 2q2 0 3.775.688t3.113 1.9t2.125 2.875T22 11.05q0 2.875-1.75 4.413T16 17h-1.85q-.225 0-.312.125t-.088.275q0 .3.375.863t.375 1.287q0 1.25-.687 1.85T12 22m-5.5-9q.65 0 1.075-.425T8 11.5t-.425-1.075T6.5 10t-1.075.425T5 11.5t.425 1.075T6.5 13m3-4q.65 0 1.075-.425T11 7.5t-.425-1.075T9.5 6t-1.075.425T8 7.5t.425 1.075T9.5 9m5 0q.65 0 1.075-.425T16 7.5t-.425-1.075T14.5 6t-1.075.425T13 7.5t.425 1.075T14.5 9m3 4q.65 0 1.075-.425T19 11.5t-.425-1.075T17.5 10t-1.075.425T16 11.5t.425 1.075T17.5 13"
			/>
		</svg>
	{:else if id === 'library'}
		<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
			/>
		</svg>
	{:else if id === 'connections'}
		<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M11 17H7q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h4v2H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h4zm-3-4v-2h8v2zm5 4v-2h4q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-4V7h4q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"
			/>
		</svg>
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M12 17q.425 0 .713-.288T13 16v-4q0-.425-.288-.712T12 11t-.712.288T11 12v4q0 .425.288.713T12 17m0-8q.425 0 .713-.288T13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9m0 13q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
			/>
		</svg>
	{/if}
{/snippet}

<div class="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-12 lg:px-8">
	<!-- Page Header -->
	<header class="mb-6 flex items-center justify-between gap-4 lg:mb-8">
		<div class="min-w-0">
			<h1 class="text-on-surface text-3xl font-black tracking-tight sm:text-4xl">Settings</h1>
			<p class="text-on-surface-variant mt-1 text-sm">
				{$isLoggedIn
					? 'Manage your account, appearance, library, and app preferences.'
					: 'Customize appearance, library, and app preferences on this device.'}
			</p>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if !$isLoggedIn}
				<Button variant="tonal" onclick={() => goto(resolve('/login'))}>Sign in</Button>
			{/if}
			<div class="hidden items-center gap-2 md:flex">
				{#if hasChanges}
					<Button variant="text" onclick={discardChanges} disabled={saving}>Discard</Button>
				{/if}
				<Button
					variant={hasChanges ? 'filled' : 'outlined'}
					disabled={!hasChanges || saving}
					onclick={saveChanges}
				>
					{#if saving}
						Saving...
					{:else if hasChanges}
						Save changes ({changedCount})
					{:else}
						Saved
					{/if}
				</Button>
			</div>
		</div>
	</header>

	<!-- Mobile / Tablet Sticky Pill Navigation -->
	<div
		class="bg-background/90 border-outline-variant/40 sticky top-0 z-20 -mx-4 mb-6 border-b backdrop-blur-md sm:-mx-6 lg:hidden"
	>
		<nav
			bind:this={mobileTabsEl}
			onscroll={updateTabsScrollState}
			aria-label="Settings sections"
			class="settings-tabs flex scroll-px-10 gap-2 overflow-x-auto scroll-smooth px-4 py-2.5 sm:px-6"
		>
			{#each navItems as item (item.id)}
				{@const active = activeSection === item.id}
				<button
					type="button"
					onclick={(e) => selectSection(item.id, e.currentTarget)}
					aria-current={active ? 'page' : undefined}
					class={[
						'flex shrink-0 cursor-pointer items-center gap-2 rounded-full border-none px-4 py-2 text-sm font-semibold transition-colors',
						active
							? 'bg-secondary-container text-on-secondary-container'
							: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
					]}
				>
					{@render sectionIcon(item.id, 18)}
					<span>{item.label}</span>
					{#if item.changes > 0}
						<span
							class="bg-primary h-2 w-2 rounded-full"
							aria-label={`${item.changes} unsaved changes`}
						></span>
					{/if}
				</button>
			{/each}
		</nav>

		{#if tabsCanScrollLeft}
			<div
				class="from-background via-background/85 pointer-events-none absolute inset-y-0 left-0 flex items-center bg-gradient-to-r to-transparent pr-6 pl-1.5"
			>
				<button
					type="button"
					onclick={() => scrollMobileTabs(-1)}
					aria-label="Scroll tabs left"
					class="bg-surface-container-high text-on-surface ring-outline-variant/60 pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none shadow-sm ring-1"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
						<path fill="currentColor" d="m14 18l-6-6l6-6l1.4 1.4l-4.6 4.6l4.6 4.6z" />
					</svg>
				</button>
			</div>
		{/if}

		{#if tabsCanScrollRight}
			<div
				class="from-background via-background/85 pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l to-transparent pr-1.5 pl-6"
			>
				<button
					type="button"
					onclick={() => scrollMobileTabs(1)}
					aria-label="Scroll tabs right"
					class="bg-surface-container-high text-on-surface ring-outline-variant/60 pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none shadow-sm ring-1"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
						<path fill="currentColor" d="M12.6 12L8 7.4L9.4 6l6 6l-6 6L8 16.6z" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- Two-Column Desktop Layout -->
	<div class="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
		<!-- Desktop Sticky Sidebar Nav -->
		<aside class="sticky top-6 hidden flex-col gap-1.5 lg:flex">
			<nav aria-label="Settings sections" class="flex flex-col gap-1">
				{#each navItems as item (item.id)}
					{@const active = activeSection === item.id}
					<button
						type="button"
						onclick={() => selectSection(item.id)}
						aria-current={active ? 'page' : undefined}
						class={[
							'flex w-full cursor-pointer items-center justify-between gap-3 rounded-full border-none px-4 py-3 text-left text-sm font-semibold transition-colors',
							active
								? 'bg-secondary-container text-on-secondary-container'
								: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface bg-transparent'
						]}
					>
						<span class="flex items-center gap-3">
							{@render sectionIcon(item.id, 20)}
							<span>{item.label}</span>
						</span>
						{#if item.changes > 0}
							<span
								class="bg-primary h-2 w-2 shrink-0 rounded-full"
								aria-label={`${item.changes} unsaved changes`}
							></span>
						{/if}
					</button>
				{/each}
			</nav>

			<div class="border-outline-variant/40 mt-4 border-t px-4 pt-4">
				<p class="text-on-surface-variant/75 text-xs">
					Maple • {dev ? 'Dev build' : `v${version}`}
				</p>
			</div>
		</aside>

		<!-- Active Section Content -->
		<main class="flex min-w-0 flex-col gap-6">
			{#if activeSection === 'account' && $isLoggedIn}
				<section class="flex flex-col gap-5">
					<div class="flex flex-col gap-1">
						<h2 class="text-on-surface text-xl font-bold tracking-tight">Account</h2>
						<p class="text-on-surface-variant text-sm">
							Your public profile, sign-in methods, and active sessions.
						</p>
					</div>

					<!-- Profile Group Card -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Profile
							</h3>
						</div>

						<div class="divide-outline-variant/40 divide-y">
							<!-- Avatar & identity -->
							<div class="flex flex-col items-center gap-5 px-5 py-5 sm:flex-row sm:items-center">
								<div class="relative shrink-0">
									<input
										type="file"
										accept="image/jpeg,image/png,image/gif"
										class="hidden"
										bind:this={fileInput}
										onchange={handleFileSelect}
									/>
									{#if pfpPreview}
										<img
											src={pfpPreview}
											alt="Profile preview"
											class="ring-primary/40 h-22 w-22 rounded-full object-cover ring-2"
										/>
									{:else if $SavedUser?.pfp}
										<img
											src={$SavedUser.pfp}
											alt="Profile"
											class="ring-outline-variant h-22 w-22 rounded-full object-cover ring-1"
										/>
									{:else}
										<div
											class="bg-primary-container text-on-primary-container flex h-22 w-22 items-center justify-center rounded-full"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="44"
												height="44"
												viewBox="0 0 24 24"
											>
												<path
													fill="currentColor"
													d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
												/>
											</svg>
										</div>
									{/if}
								</div>

								<div
									class="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left"
								>
									<div class="min-w-0">
										<p class="text-on-surface truncate text-lg font-bold">
											{name.trim() || $SavedUser?.username || 'Your account'}
										</p>
										<p class="text-on-surface-variant truncate text-sm">
											@{$SavedUser?.username ?? 'unknown'}
										</p>
									</div>

									<div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
										<Button
											variant="tonal"
											onclick={() => fileInput?.click()}
											disabled={pfpUploading || saving}
										>
											{#if pfpUploading}Uploading...{:else}Change photo{/if}
										</Button>
										{#if pfpPreview}
											<Button variant="text" onclick={clearStagedPhoto} disabled={pfpUploading}>
												Undo photo
											</Button>
										{/if}
									</div>
									<p class="text-on-surface-variant/80 text-xs">JPG, PNG, or GIF up to 3 MB.</p>
								</div>
							</div>

							<!-- Display name -->
							<div class="flex flex-col gap-2 px-5 py-4">
								<label for="display-name" class="text-on-surface text-sm font-semibold">
									Display name
								</label>
								<input
									type="text"
									id="display-name"
									bind:value={name}
									placeholder="Add an optional display name"
									class="bg-surface text-on-surface placeholder:text-on-surface-variant/60 ring-outline-variant focus:ring-primary w-full rounded-xl px-3.5 py-2.5 text-sm ring-1 transition focus:ring-2 focus:outline-none"
								/>
								<p class="text-on-surface-variant text-xs">
									Shown to friends instead of your username when set.
								</p>
							</div>

							<!-- Account metadata -->
							<div class="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
								<div class="min-w-0">
									<p class="text-on-surface-variant text-xs font-medium">Username</p>
									<p class="text-on-surface mt-0.5 truncate text-sm font-semibold">
										@{$SavedUser?.username ?? 'Not set'}
									</p>
								</div>
								<div class="min-w-0">
									<p class="text-on-surface-variant text-xs font-medium">Account ID</p>
									<div class="mt-0.5 flex items-center gap-2">
										<p class="text-on-surface min-w-0 truncate font-mono text-xs">
											{$SavedUser?.id ?? 'Not available'}
										</p>
										{#if $SavedUser?.id}
											<button
												type="button"
												onclick={copyAccountId}
												aria-label="Copy account ID"
												title="Copy account ID"
												class="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent transition-colors"
											>
												{#if copiedId}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="16"
														height="16"
														viewBox="0 0 24 24"
														class="text-primary"
													>
														<path
															fill="currentColor"
															d="m9.55 18l-5.7-5.7l1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z"
														/>
													</svg>
												{:else}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="16"
														height="16"
														viewBox="0 0 24 24"
													>
														<path
															fill="currentColor"
															d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm0-2h9V4H9zm-4 6q-.825 0-1.412-.587T3 20V6h2v14h11v2zm4-6V4z"
														/>
													</svg>
												{/if}
											</button>
										{/if}
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Security & Sessions -->
					<AccountSecurity />
				</section>
			{:else if activeSection === 'appearance'}
				<section class="flex flex-col gap-5">
					<div class="flex flex-col gap-1">
						<h2 class="text-on-surface text-xl font-bold tracking-tight">Appearance</h2>
						<p class="text-on-surface-variant text-sm">
							Changes preview immediately. Save to keep them across sessions.
						</p>
					</div>

					<!-- Theme Mode Group -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Color mode
							</h3>
						</div>

						<div
							class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="min-w-0">
								<p class="text-on-surface text-sm font-semibold">Theme</p>
								<p class="text-on-surface-variant mt-0.5 text-xs">
									Switch between light and dark surfaces.
								</p>
							</div>

							<div
								role="radiogroup"
								aria-label="Theme mode"
								class="bg-surface-container-highest grid w-full grid-cols-2 gap-1 rounded-full p-1 sm:w-auto sm:min-w-52"
							>
								<button
									type="button"
									role="radio"
									aria-checked={!themeDarkMode}
									onclick={() => previewTheme(themeSourceColor, false)}
									class={[
										'flex cursor-pointer items-center justify-center gap-2 rounded-full border-none px-4 py-2 text-xs font-semibold transition-all',
										!themeDarkMode
											? 'bg-primary text-on-primary shadow-sm'
											: 'text-on-surface-variant hover:text-on-surface bg-transparent'
									]}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M12 17q-2.075 0-3.537-1.463T7 12t1.463-3.537T12 7t3.538 1.463T17 12t-1.463 3.538T12 17m-7-4H1v-2h4zm18 0h-4v-2h4zM11 5V1h2v4zm0 18v-4h2v4zM6.4 7.75L3.875 5.325L5.3 3.85l2.4 2.5zm12.3 12.4l-2.425-2.525L17.6 16.25l2.525 2.425zM16.25 6.4l2.425-2.525L20.15 5.3l-2.5 2.4zM3.85 18.7l2.525-2.425L7.75 17.6l-2.425 2.525z"
										/>
									</svg>
									Light
								</button>
								<button
									type="button"
									role="radio"
									aria-checked={themeDarkMode}
									onclick={() => previewTheme(themeSourceColor, true)}
									class={[
										'flex cursor-pointer items-center justify-center gap-2 rounded-full border-none px-4 py-2 text-xs font-semibold transition-all',
										themeDarkMode
											? 'bg-primary text-on-primary shadow-sm'
											: 'text-on-surface-variant hover:text-on-surface bg-transparent'
									]}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M12 21q-3.75 0-6.375-2.625T3 12t2.625-6.375T12 3q.35 0 .688.025t.662.075q-1.025.725-1.638 1.888T11.1 7.5q0 2.25 1.575 3.825T16.5 12.9q1.375 0 2.525-.613T20.9 10.65q.05.325.075.662T21 12q0 3.75-2.625 6.375T12 21"
										/>
									</svg>
									Dark
								</button>
							</div>
						</div>
					</div>

					<!-- Accent Color Group -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Accent color
							</h3>
						</div>

						<div class="px-5 py-5">
							<ThemeColorPicker
								value={themeSourceColor}
								onchange={(hex) => previewTheme(hex, themeDarkMode)}
							/>
						</div>
					</div>
				</section>
			{:else if activeSection === 'library'}
				<section class="flex flex-col gap-5">
					<div class="flex flex-col gap-1">
						<h2 class="text-on-surface text-xl font-bold tracking-tight">Library</h2>
						<p class="text-on-surface-variant text-sm">
							Manage local tracks, folder import behavior, and lyrics.
						</p>
					</div>

					<!-- Local Storage Summary -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Storage
							</h3>
						</div>

						<div
							class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex items-center gap-3.5">
								<div
									class="bg-primary-container text-on-primary-container flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="24"
										height="24"
										viewBox="0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
										/>
									</svg>
								</div>
								<div class="min-w-0">
									<p class="text-on-surface text-base font-bold">
										{trackCount}
										{trackCount === 1 ? 'track' : 'tracks'}
									</p>
									<p class="text-on-surface-variant text-xs">
										{#if trackCount > 0}
											{albumCount}
											{albumCount === 1 ? 'album' : 'albums'} • {playlistCount}
											{playlistCount === 1 ? 'playlist' : 'playlists'} stored on this device
										{:else}
											Stored locally on this device
										{/if}
									</p>
								</div>
							</div>

							<Button variant="filled" onclick={() => createLibrary()}>Upload music</Button>
						</div>
					</div>

					<section
						aria-labelledby="library-sources"
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3
								id="library-sources"
								class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase"
							>
								Sources
							</h3>
						</div>
						<ul class="divide-outline-variant/40 m-0 list-none divide-y p-0">
							<li class="px-5 py-4">
								<p class="text-on-surface text-sm font-semibold">Internal</p>
								<p class="text-on-surface-variant mt-0.5 text-xs leading-relaxed">
									{sourceCounts.get('internal') ?? 0}
									{sourceCounts.get('internal') === 1 ? 'track' : 'tracks'} · Updated when you import music
								</p>
							</li>
							{#each foldersByName as folder (folder.id)}
								{@const count = sourceCounts.get(folder.id) ?? 0}
								{@const missing = unavailableFolders.includes(folder.id)}
								<li class="flex items-center justify-between gap-4 px-5 py-4">
									<div class="min-w-0 flex-1">
										<p class="text-on-surface flex items-center gap-2 text-sm font-semibold">
											<svg
												aria-hidden="true"
												class="text-on-surface-variant shrink-0"
												width="20"
												height="20"
												viewBox="0 0 24 24"
											>
												<path fill="currentColor" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
											</svg>
											<span class="min-w-0 wrap-anywhere">{folder.handle.name}</span>
										</p>
										<p class="text-on-surface-variant mt-0.5 text-xs leading-relaxed">
											{count} {count === 1 ? 'track' : 'tracks'} · {missing ? 'Folder unavailable' : 'Linked folder'}
										</p>
									</div>
									<Button
										variant="tonal"
										aria-label={`${missing ? 'Relink' : 'Refresh'} ${folder.handle.name}`}
										disabled={refreshingFolder !== null || clearingLibrary}
										onclick={() => refreshSource(folder)}
									>
										{#if missing}
											{refreshingFolder === folder.id ? 'Relinking…' : 'Relink'}
										{:else}
											{refreshingFolder === folder.id ? 'Refreshing…' : 'Refresh'}
										{/if}
									</Button>
								</li>
							{/each}
						</ul>
						{#if foldersLoadFailed || foldersByName.length}
							<p class="border-outline-variant/40 text-on-surface-variant border-t px-5 py-3 text-xs leading-relaxed">
								{foldersLoadFailed ? 'Could not load linked folders.' : 'Refresh a folder to find new music in it and its subfolders.'}
							</p>
						{/if}
					</section>

					<!-- Import & Lyrics Preferences -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Import &amp; lyrics
							</h3>
						</div>

						<div class="divide-outline-variant/40 divide-y">
							<div class="flex items-center justify-between gap-4 px-5 py-4">
								<div class="min-w-0 flex-1">
									<label
										for="jellyfin-import"
										class="text-on-surface block cursor-pointer text-sm font-semibold"
									>
										Jellyfin folder import
									</label>
									<p
										id="jellyfin-import-help"
										class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
									>
										Import album folders directly or grouped by artist.
									</p>
								</div>
								<label class="shrink-0 cursor-pointer">
									<Switch
										id="jellyfin-import"
										bind:checked={jellyfinModeEnabled}
										aria-describedby="jellyfin-import-help"
									/>
								</label>
							</div>

							<div class="flex items-center justify-between gap-4 px-5 py-4">
								<div class="min-w-0 flex-1">
									<label
										for="external-lyrics"
										class="text-on-surface block cursor-pointer text-sm font-semibold"
									>
										Add external lyrics
									</label>
									<p
										id="external-lyrics-help"
										class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
									>
										Add LRC or text files from a track’s context menu.
									</p>
								</div>
								<label class="shrink-0 cursor-pointer">
									<Switch
										id="external-lyrics"
										bind:checked={externalLyrics}
										aria-describedby="external-lyrics-help"
										aria-label="Add external lyrics"
									/>
								</label>
							</div>
						</div>
					</div>

					<!-- Danger Zone -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Danger zone
							</h3>
						</div>

						<div
							class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="min-w-0">
								<p class="text-on-surface text-sm font-semibold">Clear local library</p>
								<p class="text-on-surface-variant mt-0.5 text-xs leading-relaxed">
									Permanently delete all music, playlists, and artwork stored on this device.
								</p>
							</div>
							<button
								type="button"
								onclick={() => (clearDialogOpen = true)}
								disabled={clearingLibrary || refreshingFolder !== null}
								class="bg-error text-on-error hover:bg-error/90 shrink-0 cursor-pointer rounded-full border-none px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
							>
								Clear library
							</button>
						</div>
					</div>
				</section>
			{:else if activeSection === 'connections'}
				<section class="flex flex-col gap-5">
					<div class="flex flex-col gap-1">
						<h2 class="text-on-surface text-xl font-bold tracking-tight">
							{$isLoggedIn ? 'Connections' : 'Integrations'}
						</h2>
						<p class="text-on-surface-variant text-sm">
							{$isLoggedIn
								? 'Control social visibility, live sync, and Discord sharing.'
								: 'Connect Maple playback with external webhooks.'}
						</p>
					</div>

					{#if $isLoggedIn}
						<!-- Social & Live Sync (logged-in only) -->
						<div
							class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
						>
							<div class="border-outline-variant/40 border-b px-5 py-3.5">
								<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
									Social &amp; live sync
								</h3>
							</div>

							<div class="divide-outline-variant/40 divide-y">
								<div class="flex items-center justify-between gap-4 px-5 py-4">
									<div class="min-w-0 flex-1">
										<label
											for="public-listening"
											class="text-on-surface block cursor-pointer text-sm font-semibold"
										>
											Public listening
										</label>
										<p
											id="public-listening-help"
											class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
										>
											Friends can see what you’re playing and what you played last.
										</p>
									</div>
									<label class="shrink-0 cursor-pointer">
										<Switch
											id="public-listening"
											bind:checked={listeningPublic}
											aria-describedby="public-listening-help"
										/>
									</label>
								</div>

								<div class="flex items-center justify-between gap-4 px-5 py-4">
									<div class="min-w-0 flex-1">
										<label
											for="socket-communication"
											class="text-on-surface block cursor-pointer text-sm font-semibold"
										>
											Live server connection
										</label>
										<p
											id="socket-communication-help"
											class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
										>
											Get live updates for friends and playback activity.
										</p>
									</div>
									<label class="shrink-0 cursor-pointer">
										<Switch
											id="socket-communication"
											bind:checked={socketCommunicationEnabled}
											aria-describedby="socket-communication-help"
										/>
									</label>
								</div>
							</div>
						</div>
					{/if}

					<!-- Discord Group -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Discord
							</h3>
						</div>

						<div class="divide-outline-variant/40 divide-y">
							{#if $isLoggedIn}
								<div class="flex items-center justify-between gap-4 px-5 py-4">
									<div class="min-w-0 flex-1">
										<label
											for="discord-rpc"
											class="text-on-surface block cursor-pointer text-sm font-semibold"
										>
											Show playback on Discord
										</label>
										<p
											id="discord-rpc-help"
											class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
										>
											Broadcast your active track to Discord Rich Presence.
										</p>
									</div>
									<label class="shrink-0 cursor-pointer">
										<Switch
											id="discord-rpc"
											bind:checked={discordRpcEnabled}
											aria-describedby="discord-rpc-help"
										/>
									</label>
								</div>
							{/if}

							<div class="flex flex-col gap-4 px-5 py-4">
								<div class="flex items-center justify-between gap-4">
									<div class="min-w-0 flex-1">
										<label
											for="webhook-enabled"
											class="text-on-surface block cursor-pointer text-sm font-semibold"
										>
											Discord webhook
										</label>
										<p
											id="webhook-enabled-help"
											class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
										>
											Post your current track to a Discord channel automatically.
										</p>
									</div>
									<label class="shrink-0 cursor-pointer">
										<Switch
											id="webhook-enabled"
											bind:checked={webhookEnabled}
											aria-describedby="webhook-enabled-help"
										/>
									</label>
								</div>

								{#if webhookEnabled || webhookUrl.trim().length > 0}
									<div
										transition:slide={{ duration: 180 }}
										class="bg-surface-container flex flex-col gap-2 rounded-2xl p-4"
									>
										<label for="webhook-url" class="text-on-surface-variant text-xs font-semibold">
											Webhook URL
										</label>
										<input
											id="webhook-url"
											aria-describedby="webhook-url-help"
											type="url"
											bind:value={webhookUrl}
											placeholder="https://discord.com/api/webhooks/..."
											class="bg-surface text-on-surface placeholder:text-on-surface-variant/60 ring-outline-variant focus:ring-primary w-full rounded-xl px-3.5 py-2.5 text-sm ring-1 transition focus:ring-2 focus:outline-none"
										/>
										<p id="webhook-url-help" class="text-on-surface-variant text-xs">
											Leave blank to skip posting.
										</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</section>
			{:else if activeSection === 'app'}
				<section class="flex flex-col gap-5">
					<div class="flex flex-col gap-1">
						<h2 class="text-on-surface text-xl font-bold tracking-tight">App &amp; advanced</h2>
						<p class="text-on-surface-variant text-sm">
							Installation status, device networking, and developer tools.
						</p>
					</div>

					<!-- Maple App / PWA Group -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div
							class="border-outline-variant/40 flex items-center justify-between border-b px-5 py-3.5"
						>
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Maple app
							</h3>
							<span
								class="bg-surface-container-high text-on-surface-variant rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
							>
								Build {dev ? 'development' : version}
							</span>
						</div>

						<div class="divide-outline-variant/40 divide-y">
							<div
								class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<p class="text-on-surface text-sm font-semibold">App installation</p>
										{#if appWindow || $appInstalled}
											<span
												class="bg-primary/15 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
											>
												Installed
											</span>
										{/if}
									</div>
									<p class="text-on-surface-variant mt-0.5 text-xs leading-relaxed">
										{#if appWindow || $appInstalled}
											Maple is installed on this device.
										{:else if $appInstallPrompt}
											Install Maple for a faster, standalone app experience.
										{:else}
											Look for Install app or Add to home screen in your browser menu.
										{/if}
									</p>
									{#if installMessage && !$appInstalled}
										<p class="text-primary mt-1.5 text-xs font-medium" role="status">
											{installMessage}
										</p>
									{/if}
								</div>

								{#if !(appWindow || $appInstalled) && $appInstallPrompt}
									<div class="shrink-0">
										<Button variant="filled" onclick={installApp} disabled={installingApp}>
											Install Maple
										</Button>
									</div>
								{/if}
							</div>

							{#if $appUpdateReady}
								<div
									class="bg-primary-container/30 flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div class="min-w-0">
										<p class="text-on-surface text-sm font-semibold">Update available</p>
										<p class="text-on-surface-variant mt-0.5 text-xs">
											A newer version of Maple is ready to load.
										</p>
									</div>
									<div class="shrink-0">
										<Button variant="filled" onclick={reloadApp} disabled={reloadingApp}>
											Reload to update
										</Button>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Network Group -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Network
							</h3>
						</div>

						<div class="flex items-center justify-between gap-4 px-5 py-4">
							<div class="min-w-0 flex-1">
								<label
									for="p2p-transfers"
									class="text-on-surface block cursor-pointer text-sm font-semibold"
								>
									Peer-to-peer transfers
								</label>
								<p
									id="p2p-transfers-help"
									class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
								>
									Transfer your library to other devices via peer-to-peer connections.
								</p>
							</div>
							<label class="shrink-0 cursor-pointer">
								<Switch
									id="p2p-transfers"
									bind:checked={p2pTransfersEnabled}
									aria-describedby="p2p-transfers-help"
								/>
							</label>
						</div>
					</div>

					<!-- Developer Group -->
					<div
						class="bg-surface-container-low border-outline-variant/50 overflow-hidden rounded-3xl border"
					>
						<div class="border-outline-variant/40 border-b px-5 py-3.5">
							<h3 class="text-on-surface-variant text-xs font-semibold tracking-wider uppercase">
								Developer
							</h3>
						</div>

						<div class="divide-outline-variant/40 divide-y">
							<div class="flex items-center justify-between gap-4 px-5 py-4">
								<div class="min-w-0 flex-1">
									<label
										for="file-logging"
										class="text-on-surface block cursor-pointer text-sm font-semibold"
									>
										Logging
									</label>
									<p
										id="file-logging-help"
										class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
									>
										Save logs to a file for debugging purposes.
									</p>
								</div>
								<label class="shrink-0 cursor-pointer">
									<Switch
										id="file-logging"
										bind:checked={loggingEnabled}
										aria-describedby="file-logging-help"
									/>
								</label>
							</div>

							<div class="flex items-center justify-between gap-4 px-5 py-4">
								<div class="min-w-0 flex-1">
									<label
										for="developer-mode"
										class="text-on-surface block cursor-pointer text-sm font-semibold"
									>
										Developer mode
									</label>
									<p
										id="developer-mode-help"
										class="text-on-surface-variant mt-0.5 text-xs leading-relaxed"
									>
										Enable extra diagnostics and developer options.
									</p>
								</div>
								<label class="shrink-0 cursor-pointer">
									<Switch
										id="developer-mode"
										bind:checked={developerModeEnabled}
										aria-describedby="developer-mode-help"
									/>
								</label>
							</div>
						</div>
					</div>
				</section>
			{/if}
		</main>
	</div>
</div>

<!-- Floating Unsaved Changes Save Bar (Mobile only) -->
{#if hasChanges}
	<div
		transition:fly={{ y: 20, duration: 220, easing: cubicOut }}
		class="pointer-events-none fixed inset-x-3 bottom-40 z-30 md:hidden"
		role="region"
		aria-label="Unsaved settings changes"
	>
		<div
			class="bg-surface-container-highest/95 ring-primary/40 pointer-events-auto mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.28)] ring-1 backdrop-blur-md"
		>
			<div class="flex min-w-0 items-center gap-2.5">
				<span class="bg-primary h-2.5 w-2.5 shrink-0 rounded-full"></span>
				<p class="text-on-surface truncate text-sm font-semibold">
					{changedCount === 1 ? '1 unsaved change' : `${changedCount} unsaved changes`}
				</p>
			</div>

			<div class="flex shrink-0 items-center gap-1.5">
				<Button variant="text" onclick={discardChanges} disabled={saving}>Discard</Button>
				<Button variant="filled" onclick={saveChanges} disabled={saving}>
					{#if saving}
						Saving...
					{:else}
						Save
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}

<Dialog bind:open={clearDialogOpen} headline="Clear library?">
	<p>This permanently deletes all music, playlists, and artwork stored on this device.</p>
	{#snippet buttons()}
		<Button variant="text" onclick={() => (clearDialogOpen = false)}>Cancel</Button>
		<Button variant="filled" onclick={confirmClearLibrary} disabled={clearingLibrary}>Clear</Button>
	{/snippet}
</Dialog>

<style>
	.settings-tabs {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.settings-tabs::-webkit-scrollbar {
		display: none;
	}
</style>
