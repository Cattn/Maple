<script lang="ts">
	import { Card, Button } from 'm3-svelte';
	import ColorPicker from 'svelte-awesome-color-picker';
	import { isLoggedIn, UserInfo, SavedUser, socket } from '$lib/store';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { title } from '$lib/store';
	import { themeSettings, setThemeSettings, persistThemeSettings } from '$lib/theme/theme';
	import { UserManager } from '$lib/api/UserManager';
	import UserSettings from '$lib/preferences/usersettings';
	import { Settings } from '$lib/preferences/fetch';
	import { io } from 'socket.io-client';
	import { SERVER } from '$lib/api/server';
	import { socketManager } from '$lib/socketManager';
	import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
	import { OPFS } from '$lib/opfs';
	import { createLibrary } from '$lib/library';

	let name = $state('');
	let initialName = $state('');
	const webhookSettings = new Settings('webhook');
	const initialWebhookEnabledValue =
		webhookSettings.get('enabled') !== null ? webhookSettings.get('enabled') : false;
	let webhookEnabled = $state(initialWebhookEnabledValue);
	let initialWebhookEnabled = $state(initialWebhookEnabledValue);
	const initialWebhookUrlValue =
		webhookSettings.get('url') !== null ? webhookSettings.get('url') : '';
	let webhookUrl = $state(initialWebhookUrlValue);
	let initialWebhookUrl = $state(initialWebhookUrlValue);
	const discordSettings = new Settings('discord');
	const initialDiscordRpcValue =
		discordSettings.get('enabled') !== null ? discordSettings.get('enabled') : false;
	let discordRpcEnabled = $state(initialDiscordRpcValue);
	let initialDiscordRpcEnabled = $state(initialDiscordRpcValue);
	let p2pTransfersEnabled = $state(true);
	let initialP2pTransfersEnabled = $state(true);
	const preferencesSettings = new Settings('preferences');
	const initialSocketValue =
		preferencesSettings.get('socket') !== null ? preferencesSettings.get('socket') : true;
	let socketCommunicationEnabled = $state(initialSocketValue);
	let initialSocketCommunicationEnabled = $state(initialSocketValue);
	const initialJellyfinValue =
		preferencesSettings.get('jellyfinMode') !== null
			? preferencesSettings.get('jellyfinMode')
			: false;
	let jellyfinModeEnabled = $state(initialJellyfinValue);
	let initialJellyfinModeEnabled = $state(initialJellyfinValue);
	let loggingEnabled = $state(false);
	let initialLoggingEnabled = $state(false);
	let developerModeEnabled = $state(false);
	let initialDeveloperModeEnabled = $state(false);
	const initialTheme = get(themeSettings);
	let themeSourceColor = $state<string | null>(initialTheme.sourceColor);
	let initialThemeSourceColor = $state(initialTheme.sourceColor);
	let themeDarkMode = $state(initialTheme.isDarkMode);
	let initialThemeDarkMode = $state(initialTheme.isDarkMode);
	let themePreviewColor = $derived(themeSourceColor ?? initialThemeSourceColor);
	let themeInitialized = false;

	let pfpFile = $state<File | null>(null);
	let pfpPreview = $state<string | null>(null);
	let pfpUploading = $state(false);
	let fileInput: HTMLInputElement;

	let mobileFileInput: HTMLInputElement;
	let mobileUploading = $state(false);
	let trackCount = $state(0);

	$effect(() => {
		name = $SavedUser?.name ?? '';
		initialName = $SavedUser?.name ?? '';
	});

	$effect(() => {
		const { sourceColor, isDarkMode } = $themeSettings;
		if (!themeInitialized) {
			themeSourceColor = sourceColor;
			themeDarkMode = isDarkMode;
			initialThemeSourceColor = sourceColor;
			initialThemeDarkMode = isDarkMode;
			themeInitialized = true;
			return;
		}
		themeSourceColor = sourceColor;
		themeDarkMode = isDarkMode;
	});

	$effect(() => {
		if (themeSourceColor) {
			setThemeSettings({ sourceColor: themeSourceColor, isDarkMode: themeDarkMode });
		} else {
			setThemeSettings({ isDarkMode: themeDarkMode });
		}
	});

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			if (file.size > 3 * 1024 * 1024) {
				return;
			}
			pfpFile = file;
			const reader = new FileReader();
			reader.onload = () => {
				pfpPreview = reader.result as string;
			};
			reader.readAsDataURL(file);
		}
	};

	let hasChanges = $derived(
		name !== initialName ||
			webhookEnabled !== initialWebhookEnabled ||
			webhookUrl !== initialWebhookUrl ||
			discordRpcEnabled !== initialDiscordRpcEnabled ||
			p2pTransfersEnabled !== initialP2pTransfersEnabled ||
			socketCommunicationEnabled !== initialSocketCommunicationEnabled ||
			jellyfinModeEnabled !== initialJellyfinModeEnabled ||
			loggingEnabled !== initialLoggingEnabled ||
			developerModeEnabled !== initialDeveloperModeEnabled ||
			themePreviewColor !== initialThemeSourceColor ||
			themeDarkMode !== initialThemeDarkMode ||
			pfpFile !== null
	);

	const saveChanges = async () => {
		if (pfpFile) {
			pfpUploading = true;
			const result = await UserManager.updateProfilePicture(pfpFile);
			pfpUploading = false;
			if (result.error) {
				return;
			}
			pfpFile = null;
			pfpPreview = null;
		}

		if (name !== initialName) {
			const result = await UserManager.updateDisplayName(name);
			if (result.error) {
				return;
			}
			initialName = name;
		}

		if (socketCommunicationEnabled !== initialSocketCommunicationEnabled) {
			preferencesSettings.set('socket', socketCommunicationEnabled);
			UserSettings.preferences.socket = socketCommunicationEnabled;

			const currentSocket = get(socket);
			const isLoggedInValue = get(isLoggedIn);

			if (socketCommunicationEnabled) {
				if (!isLoggedInValue) {
					socketCommunicationEnabled = false;
					initialSocketCommunicationEnabled = false;
					return;
				}
				if (!currentSocket || !currentSocket.connected) {
					const io2 = io(`${SERVER}`, {
						withCredentials: true
					});
					socket.set(io2);
					const newSocket = get(socket);
					newSocket?.on('connect', () => {
						console.log('Connected to server');
					});
					socketManager();
					refreshFriends();
					refreshRequests();
				}
			} else {
				if (currentSocket) {
					currentSocket.disconnect();
					socket.set(null);
				}
			}
			initialSocketCommunicationEnabled = socketCommunicationEnabled;
		}

		if (jellyfinModeEnabled !== initialJellyfinModeEnabled) {
			preferencesSettings.set('jellyfinMode', jellyfinModeEnabled);
			UserSettings.preferences.jellyfinMode = jellyfinModeEnabled;
			initialJellyfinModeEnabled = jellyfinModeEnabled;
		}

		if (webhookEnabled !== initialWebhookEnabled || webhookUrl !== initialWebhookUrl) {
			webhookSettings.set('enabled', webhookEnabled);
			webhookSettings.set('url', webhookUrl);
			UserSettings.webhook.enabled = webhookEnabled;
			UserSettings.webhook.url = webhookUrl;
			initialWebhookEnabled = webhookEnabled;
			initialWebhookUrl = webhookUrl;
		}

		if (discordRpcEnabled !== initialDiscordRpcEnabled) {
			discordSettings.set('enabled', discordRpcEnabled);
			UserSettings.discord.enabled = discordRpcEnabled;
			initialDiscordRpcEnabled = discordRpcEnabled;
		}

		const sourceColor = themePreviewColor;
		persistThemeSettings({ sourceColor, isDarkMode: themeDarkMode });
		initialThemeSourceColor = sourceColor;
		initialThemeDarkMode = themeDarkMode;
	};

	const handleMobileFileSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			mobileUploading = true;
			try {
				await createLibrary(files);
				const tracks = await OPFS.get().tracks();
				trackCount = tracks.length;
			} finally {
				mobileUploading = false;
				if (mobileFileInput) {
					mobileFileInput.value = '';
				}
			}
		}
	};

	const refreshTrackCount = async () => {
		try {
			const tracks = await OPFS.get().tracks();
			trackCount = tracks.length;
		} catch {
			trackCount = 0;
		}
	};

	onMount(async () => {
		title.set('Settings');
		await refreshTrackCount();
	});
</script>

<div class="flex w-full justify-center px-4 py-12">
	<div class="flex w-full max-w-6xl flex-col gap-8">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex flex-col gap-1">
				<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Settings</p>
				<h1 class="text-4xl font-black">Account</h1>
				<p class="text-on-surface-variant text-sm">Manage your Maple account.</p>
			</div>
			<Button variant="filled" disabled={!hasChanges} onclick={saveChanges}>Save changes</Button>
		</div>

		<div class="grid grid-cols-1 gap-6">
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-1">
						<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Profile</p>
						<p class="text-on-surface-variant text-sm">Update how your account appears.</p>
					</div>
				</div>

				<Card variant="outlined" class="flex flex-col gap-6 p-6">
					<div class="flex flex-col gap-6 sm:flex-row sm:items-center">
						<div class="relative flex items-center justify-center">
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
									alt="Profile Preview"
									class="ring-primary/20 h-28 w-28 rounded-full object-cover ring-2"
								/>
							{:else if $SavedUser?.pfp}
								<img
									src={$SavedUser?.pfp}
									alt="Profile"
									class="ring-primary/20 h-28 w-28 rounded-full object-cover ring-2"
								/>
							{:else}
								<div
									class="bg-surface-container-high ring-surface-container-high flex h-28 w-28 items-center justify-center rounded-full ring-2"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"
										><path
											fill="currentColor"
											d="M9.775 12q-.9 0-1.5-.675T7.8 9.75l.325-2.45q.2-1.425 1.3-2.363T12 4t2.575.938t1.3 2.362l.325 2.45q.125.9-.475 1.575t-1.5.675zM4 18v-.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2v.8q0 .825-.587 1.413T18 20H6q-.825 0-1.412-.587T4 18"
										/></svg
									>
								</div>
							{/if}
							<button
								type="button"
								onclick={() => fileInput.click()}
								disabled={pfpUploading}
								class="bg-surface text-primary ring-outline hover:bg-surface-container-high absolute -bottom-3 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-md ring-1 disabled:opacity-50"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
									><path
										fill="currentColor"
										d="M8 17h8v-.55q0-1.125-1.1-1.787T12 14t-2.9.663T8 16.45zm4-4q.825 0 1.413-.587T14 11t-.587-1.412T12 9t-1.412.588T10 11t.588 1.413T12 13m-8 8q-.825 0-1.412-.587T2 19V7q0-.825.588-1.412T4 5h3.15L9 3h6l1.85 2H20q.825 0 1.413.588T22 7v12q0 .825-.587 1.413T20 21zm0-2h16V7h-4.05l-1.825-2h-4.25L8.05 7H4zm8-6"
									/></svg
								>
								{#if pfpUploading}Uploading...{:else}Change photo{/if}
							</button>
						</div>

						<div class="flex flex-1 flex-col gap-4">
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div class="flex items-center gap-3">
									<h2 class="text-2xl font-bold">{$UserInfo?.username ?? 'Guest'}</h2>
									<span
										class={`rounded-full px-3 py-1 text-xs font-semibold ${$isLoggedIn ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}
									>
										{$isLoggedIn ? 'Signed in' : 'Not signed in'}
									</span>
								</div>
							</div>

							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div
									class="bg-surface-container-high flex h-full flex-col justify-center gap-2 rounded-xl p-4"
								>
									<p class="text-on-surface-variant text-xs font-semibold tracking-wide uppercase">
										Display name (optional)
									</p>
									<input
										type="text"
										bind:value={name}
										placeholder="Add a display name"
										class="bg-surface text-on-surface placeholder:text-on-surface-variant/70 ring-outline focus:ring-primary w-full rounded-lg px-3 py-2 ring-1 focus:ring-2 focus:outline-none"
									/>
								</div>
								<div
									class="bg-surface-container-high flex h-full flex-col justify-center gap-1 rounded-xl p-4"
								>
									<p class="text-on-surface-variant text-xs font-semibold tracking-wide uppercase">
										Username
									</p>
									<p class="text-on-surface text-lg font-semibold">
										{$UserInfo?.username ?? 'Not set'}
									</p>
								</div>
								<div
									class="bg-surface-container-high flex h-full flex-col justify-center gap-1 rounded-xl p-4 sm:col-span-2"
								>
									<p class="text-on-surface-variant text-xs font-semibold tracking-wide uppercase">
										Account ID
									</p>
									<p class="text-on-surface text-lg font-semibold">
										{$UserInfo?.id ?? 'Not available'}
									</p>
								</div>
							</div>
						</div>
					</div>
				</Card>
			</section>

			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-1">
						<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Preferences</p>
						<p class="text-on-surface-variant text-sm">Manage your account preferences.</p>
					</div>
				</div>

				<Card variant="outlined" class="flex flex-col gap-6 p-6">
					<div class="flex flex-col gap-5">
						<div
							class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
						>
							<div class="flex flex-col gap-1">
								<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">Theme</p>
							</div>
							<div class="flex flex-col gap-4">
								<div class="flex items-start justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">Use dark mode</p>
										<p class="text-on-surface-variant text-xs">Save your eyes.</p>
									</div>
									<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input type="checkbox" class="peer sr-only" bind:checked={themeDarkMode} />
										<div
											class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
										></div>
										<span
											class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
										></span>
									</label>
								</div>
								<div class="flex flex-col gap-3">
									<div class="flex items-start justify-between gap-4">
										<div class="flex flex-col gap-1">
											<p class="text-on-surface-variant text-sm font-semibold">Theme color</p>
											<p class="text-on-surface-variant text-xs">
												Select the color that drives the system theme.
											</p>
										</div>
										<div
											class="ring-outline/50 h-8 w-8 rounded-full ring-1"
											style={`background-color: ${themePreviewColor};`}
										></div>
									</div>
									<div class="bg-surface ring-outline/50 rounded-xl p-2 ring-1">
										<ColorPicker
											hex={themeSourceColor}
											onInput={(event) => {
												themeSourceColor = event.hex;
											}}
											isAlpha={false}
											isDialog={false}
										/>
									</div>
								</div>
							</div>
						</div>
						<div
							class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
						>
							<div class="flex flex-col gap-1">
								<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">
									Webhook Settings
								</p>
							</div>
							<div class="flex flex-col gap-4">
								<div class="flex items-start justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">Enable Webhooks</p>
										<p class="text-on-surface-variant text-xs">
											Send data to a chosen webhook service
										</p>
									</div>
									<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input type="checkbox" class="peer sr-only" bind:checked={webhookEnabled} />
										<div
											class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
										></div>
										<span
											class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
										></span>
									</label>
								</div>
								<div class="flex flex-col gap-2">
									<div class="flex flex-col gap-2">
										<div class="flex flex-col gap-1">
											<p class="text-on-surface-variant text-sm font-semibold">Webhook URL</p>
											<p class="text-on-surface-variant text-xs">
												Webhook URL to automatically send to. Currently supports Discord webhooks.
												If left blank, nothing will be sent.
											</p>
										</div>
										<input
											type="url"
											bind:value={webhookUrl}
											placeholder="https://discord.com/api/webhooks/..."
											class="bg-surface text-on-surface placeholder:text-on-surface-variant/70 ring-outline focus:ring-primary w-full rounded-lg px-3 py-2 ring-1 focus:ring-2 focus:outline-none"
										/>
									</div>
								</div>
							</div>
						</div>

						<div
							class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
						>
							<div class="flex flex-col gap-1">
								<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">
									Discord Settings
								</p>
							</div>
							<div class="flex items-start justify-between gap-4">
								<div class="flex flex-col gap-1">
									<p class="text-on-surface-variant text-sm font-semibold">Enable Discord RPC</p>
									<p class="text-on-surface-variant text-xs">
										Show what you're listening to in Discord
									</p>
								</div>
								<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
									<input type="checkbox" class="peer sr-only" bind:checked={discordRpcEnabled} />
									<div
										class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
									></div>
									<span
										class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
									></span>
								</label>
							</div>
						</div>
					</div>
				</Card>
			</section>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex flex-col gap-1">
				<h1 class="text-4xl font-black">App Settings</h1>
				<p class="text-on-surface-variant text-sm">
					Additional options that change the way the app works.
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6">
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-1">
						<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Preferences</p>
						<p class="text-on-surface-variant text-sm">Manage your app preferences.</p>
					</div>
				</div>

				<Card variant="outlined" class="flex flex-col gap-6 p-6">
					<div class="flex flex-col gap-5">
						<div
							class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
						>
							<div class="flex flex-col gap-1">
								<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">
									Network Settings
								</p>
							</div>
							<div class="flex flex-col gap-4">
								<div class="flex items-start justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">
											Enable P2P Transfers
										</p>
										<p class="text-on-surface-variant text-xs">
											Allow you to transfer your library to other devices via peer-to-peer
											connections.
										</p>
									</div>
									<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input
											type="checkbox"
											class="peer sr-only"
											bind:checked={p2pTransfersEnabled}
										/>
										<div
											class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
										></div>
										<span
											class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
										></span>
									</label>
								</div>
								<div class="flex items-start justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">
											Enable Socket.io Communication
										</p>
										<p class="text-on-surface-variant text-xs">
											Allow you to communicate with the server in real-time via socket.io.
										</p>
									</div>
									<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input
											type="checkbox"
											class="peer sr-only"
											bind:checked={socketCommunicationEnabled}
										/>
										<div
											class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
										></div>
										<span
											class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
										></span>
									</label>
								</div>
							</div>
						</div>

						<div
							class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
						>
							<div class="flex flex-col gap-1">
								<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">
									Library Settings
								</p>
							</div>
							<div class="flex items-start justify-between gap-4">
								<div class="flex flex-col gap-1">
									<p class="text-on-surface-variant text-sm font-semibold">
										Enable Jellyfin Support
									</p>
									<p class="text-on-surface-variant text-xs">
										Allows for importing libraries in the jellyfin format.
									</p>
								</div>
								<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
									<input type="checkbox" class="peer sr-only" bind:checked={jellyfinModeEnabled} />
									<div
										class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
									></div>
									<span
										class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
									></span>
								</label>
							</div>
							<div class="ring-outline/30 border-outline/30 mt-3 border-t pt-4">
								<input
									type="file"
									accept="audio/*"
									multiple
									class="hidden"
									bind:this={mobileFileInput}
									onchange={handleMobileFileSelect}
								/>
								<div class="flex items-center justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">
											Upload Music (Mobile)
										</p>
										<p class="text-on-surface-variant text-xs">
											Upload audio files directly to your library.
										</p>
										<p class="text-primary mt-1 text-sm font-semibold">
											{trackCount}
											{trackCount === 1 ? 'track' : 'tracks'} in library
										</p>
									</div>
									<button
										type="button"
										onclick={() => mobileFileInput.click()}
										disabled={mobileUploading}
										class="bg-primary text-on-primary hover:bg-primary/90 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-md transition disabled:opacity-50"
									>
										{#if mobileUploading}
											<svg
												class="h-4 w-4 animate-spin"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													class="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													stroke-width="4"
												></circle>
												<path
													class="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											Uploading...
										{:else}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="18"
												height="18"
												viewBox="0 0 24 24"
											>
												<path
													fill="currentColor"
													d="M11 16V7.85l-2.6 2.6L7 9l5-5l5 5l-1.4 1.45l-2.6-2.6V16zm-5 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"
												/>
											</svg>
											Upload
										{/if}
									</button>
								</div>
							</div>
						</div>
					</div>
				</Card>
			</section>

			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-1">
						<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Developer</p>
						<p class="text-on-surface-variant text-sm">Developer options for advanced users.</p>
					</div>
				</div>

				<Card variant="outlined" class="flex flex-col gap-6 p-6">
					<div class="flex flex-col gap-5">
						<div
							class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
						>
							<div class="flex flex-col gap-1">
								<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">
									Advanced Settings
								</p>
							</div>
							<div class="flex flex-col gap-4">
								<div class="flex items-start justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">Enable Logging</p>
										<p class="text-on-surface-variant text-xs">
											Save logs to a file for debugging purposes.
										</p>
									</div>
									<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input type="checkbox" class="peer sr-only" bind:checked={loggingEnabled} />
										<div
											class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
										></div>
										<span
											class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
										></span>
									</label>
								</div>
								<div class="flex items-start justify-between gap-4">
									<div class="flex flex-col gap-1">
										<p class="text-on-surface-variant text-sm font-semibold">
											Enable Developer Mode
										</p>
										<p class="text-on-surface-variant text-xs">
											Enable developer mode for advanced users.
										</p>
									</div>
									<label class="relative inline-flex h-6 w-11 cursor-pointer items-center">
										<input
											type="checkbox"
											class="peer sr-only"
											bind:checked={developerModeEnabled}
										/>
										<div
											class="bg-outline-variant peer-checked:bg-primary/90 h-6 w-11 rounded-full transition"
										></div>
										<span
											class="bg-surface absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition peer-checked:translate-x-5"
										></span>
									</label>
								</div>
							</div>
						</div>
					</div>
				</Card>
			</section>
		</div>
	</div>
</div>
