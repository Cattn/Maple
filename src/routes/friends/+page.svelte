<script lang="ts">
	import { Button, Dialog } from 'm3-svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick, untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { UserManager } from '$lib/api/UserManager';
	import { SERVER } from '$lib/api/server';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
	import { friends, isLoggedIn, pendingRequests, SavedUser, socket, title } from '$lib/store';
	import type { Friend, Profile } from '$lib/types';

	const REQUESTS_HIDDEN_KEY = 'friends.requestsHidden';

	function readRequestsExpanded() {
		if (!browser) return true;
		try {
			return localStorage.getItem(REQUESTS_HIDDEN_KEY) !== 'true';
		} catch {
			return true;
		}
	}

	let searchQuery = $state('');
	let requestsExpanded = $state(readRequestsExpanded());

	function toggleRequestsExpanded() {
		requestsExpanded = !requestsExpanded;
		if (!browser) return;
		try {
			if (requestsExpanded) localStorage.removeItem(REQUESTS_HIDDEN_KEY);
			else localStorage.setItem(REQUESTS_HIDDEN_KEY, 'true');
		} catch {}
	}

	let addDialogOpen = $state(false);
	let addInputEl: HTMLInputElement | undefined = $state();
	let selectedFriend = $state('');
	let addingFriend = $state(false);
	let addFeedback = $state<{ tone: 'error' | 'success'; message: string } | null>(null);

	let refreshing = $state(false);
	let hasLoadedOnce = $state(false);
	let copiedUsername = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let nowMs = $state(Date.now());

	const pfpErrors = new SvelteSet<string>();
	const artErrors = new SvelteSet<string>();
	const busyUsers = new SvelteSet<string>();

	const AVATAR_TONES = [
		'bg-primary-container text-on-primary-container',
		'bg-secondary-container text-on-secondary-container',
		'bg-tertiary-container text-on-tertiary-container'
	] as const;

	function avatarTone(id: string) {
		let hash = 0;
		for (let i = 0; i < id.length; i++) {
			hash = (hash * 31 + id.charCodeAt(i)) | 0;
		}
		return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
	}

	function displayName(profile: Pick<Profile, 'name' | 'username'>) {
		return profile.name?.trim() || profile.username;
	}

	function initialsFor(profile: Pick<Profile, 'name' | 'username'>) {
		const label = displayName(profile).trim();
		return label ? label[0].toUpperCase() : '?';
	}

	function pfpUrl(id: string) {
		return `${SERVER}/public/get/pfp/${encodeURIComponent(id)}`;
	}

	function artworkUrl(friend: Friend) {
		const id = friend.listening?.current
			? friend.listening.current.artwork
			: friend.listening?.lastPlayed?.artwork;
		return id
			? `${SERVER}/public/get/albumArt/${encodeURIComponent(friend.id)}/${encodeURIComponent(id)}`
			: undefined;
	}

	function formatShortTime(iso: string | null | undefined, now: number): string | null {
		if (!iso) return null;
		const parsed = Date.parse(iso);
		if (!Number.isFinite(parsed)) return null;
		const diffSeconds = Math.max(0, Math.floor((now - parsed) / 1000));
		if (diffSeconds < 60) return 'now';
		const minutes = Math.floor(diffSeconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return new Date(parsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function compareByName(a: Profile, b: Profile) {
		return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
	}

	let incomingRequests = $derived($pendingRequests.incoming);
	let outgoingRequests = $derived($pendingRequests.outgoing);
	let incomingCount = $derived(incomingRequests.length);
	let totalRequestCount = $derived(incomingRequests.length + outgoingRequests.length);

	let activeListenerCount = $derived(
		$friends.filter((friend) => Boolean(friend.listening?.current)).length
	);

	let normalizedQuery = $derived(searchQuery.trim().toLowerCase());

	let filteredFriends = $derived.by(() => {
		if (!normalizedQuery) return $friends;
		const queryNoAt = normalizedQuery.replace(/^@+/, '');
		return $friends.filter((friend) => {
			const nameMatch = friend.name?.toLowerCase().includes(normalizedQuery);
			const userMatch = friend.username.toLowerCase().includes(queryNoAt);
			const current = friend.listening?.current;
			const last = friend.listening?.lastPlayed;
			const trackMatch =
				current?.title.toLowerCase().includes(normalizedQuery) ||
				current?.artist.toLowerCase().includes(normalizedQuery) ||
				current?.album.toLowerCase().includes(normalizedQuery) ||
				last?.title.toLowerCase().includes(normalizedQuery) ||
				last?.artist.toLowerCase().includes(normalizedQuery);
			return Boolean(nameMatch || userMatch || trackMatch);
		});
	});

	let filteredListening = $derived(
		filteredFriends
			.filter((friend) => Boolean(friend.listening?.current))
			.sort((a, b) => {
				const playingDiff =
					Number(Boolean(b.listening?.current?.playing)) -
					Number(Boolean(a.listening?.current?.playing));
				return playingDiff !== 0 ? playingDiff : compareByName(a, b);
			})
	);

	let filteredOther = $derived(
		filteredFriends.filter((friend) => !friend.listening?.current).sort(compareByName)
	);

	// Add-friend smart pre-checks (case-insensitive to match server COLLATE NOCASE)
	let cleanedAddUsername = $derived(selectedFriend.trim().replace(/^@+/, ''));
	let cleanedAddLower = $derived(cleanedAddUsername.toLowerCase());

	let isSelfUsername = $derived(
		Boolean(cleanedAddLower && $SavedUser?.username?.toLowerCase() === cleanedAddLower)
	);
	let matchingFriend = $derived(
		cleanedAddLower
			? $friends.find((friend) => friend.username.toLowerCase() === cleanedAddLower)
			: undefined
	);
	let matchingOutgoing = $derived(
		cleanedAddLower
			? outgoingRequests.find((user) => user.username.toLowerCase() === cleanedAddLower)
			: undefined
	);
	let matchingIncoming = $derived(
		cleanedAddLower
			? incomingRequests.find((user) => user.username.toLowerCase() === cleanedAddLower)
			: undefined
	);

	let canSubmitAdd = $derived(
		Boolean(
			cleanedAddUsername &&
			!addingFriend &&
			!isSelfUsername &&
			!matchingFriend &&
			!matchingOutgoing &&
			!matchingIncoming
		)
	);

	async function openAddDialog() {
		addFeedback = null;
		addDialogOpen = true;
		await tick();
		addInputEl?.focus();
	}

	function closeAddDialog() {
		addDialogOpen = false;
		addFeedback = null;
	}

	async function refreshAll(manual = false) {
		if (refreshing || !$SavedUser?.id) return;
		refreshing = true;
		if (manual) {
			pfpErrors.clear();
			artErrors.clear();
		}
		try {
			await Promise.all([refreshRequests(), refreshFriends()]);
			hasLoadedOnce = true;
		} finally {
			refreshing = false;
		}
	}

	// Fetch friends & requests whenever the signed-in account becomes available
	let lastLoadedAccountId = '';
	$effect(() => {
		const accountId = $isLoggedIn ? ($SavedUser?.id ?? '') : '';
		if (!accountId) {
			lastLoadedAccountId = '';
			hasLoadedOnce = false;
			searchQuery = '';
			selectedFriend = '';
			addFeedback = null;
			addDialogOpen = false;
			return;
		}
		if (accountId !== lastLoadedAccountId) {
			lastLoadedAccountId = accountId;
			untrack(() => {
				void refreshAll();
			});
		}
	});

	async function handleAddFriend(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmitAdd) return;

		addingFriend = true;
		addFeedback = null;
		const usernameQuery = cleanedAddUsername;
		try {
			const user = await UserManager.getUserName(usernameQuery);
			if (!user) {
				addFeedback = {
					tone: 'error',
					message: `No account found for @${usernameQuery}.`
				};
				return;
			}
			const result = await UserManager.addFriend(user.id);
			if ('error' in result) {
				addFeedback = { tone: 'error', message: result.error };
				toast.error(result.error);
			} else {
				selectedFriend = '';
				addDialogOpen = false;
				toast.success(`Friend request sent to @${user.username}.`);
				await refreshRequests();
			}
		} finally {
			addingFriend = false;
		}
	}

	async function runUserAction(
		userId: string,
		action: () => Promise<{ success: true } | { error: string }>,
		onSuccess?: () => void
	) {
		if (busyUsers.has(userId)) return;
		busyUsers.add(userId);
		try {
			const result = await action();
			if ('error' in result) {
				toast.error(result.error);
			} else {
				onSuccess?.();
			}
			await Promise.all([refreshRequests(), refreshFriends()]);
		} finally {
			busyUsers.delete(userId);
		}
	}

	function acceptRequest(user: Profile) {
		const socketConnected = Boolean($socket?.connected);
		return runUserAction(
			user.id,
			() => UserManager.acceptRequest(user.id),
			() => {
				if (cleanedAddLower === user.username.toLowerCase()) {
					selectedFriend = '';
					addDialogOpen = false;
				}
				if (!socketConnected) {
					toast.success(`You are now friends with ${displayName(user)}.`);
				}
			}
		);
	}

	function rejectRequest(user: Profile, incoming: boolean) {
		return runUserAction(
			user.id,
			() => UserManager.rejectRequest(user.id),
			() => {
				toast.success(
					incoming
						? `Declined request from @${user.username}.`
						: `Cancelled request to @${user.username}.`
				);
			}
		);
	}

	async function removeFriend(friend: Friend) {
		const label = displayName(friend);
		const confirmed = await confirmDialog({
			headline: `Remove ${label}?`,
			message: `You’ll stop seeing each other’s listening activity. You can add @${friend.username} again anytime.`,
			confirmLabel: 'Remove'
		});
		if (!confirmed) return;

		await runUserAction(
			friend.id,
			() => UserManager.removeFriend(friend.id),
			() => {
				toast.success(`Removed ${label}.`);
			}
		);
	}

	async function copyOwnUsername() {
		const username = $SavedUser?.username;
		if (!username) return;
		try {
			await navigator.clipboard.writeText(username);
			copiedUsername = true;
			toast.success(`Copied @${username}.`);
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copiedUsername = false;
			}, 2000);
		} catch {
			toast.error('Could not copy username.');
		}
	}

	onMount(() => {
		title.set('Friends');
		const timer = setInterval(() => {
			nowMs = Date.now();
		}, 60_000);
		return () => {
			clearInterval(timer);
			clearTimeout(copyTimer);
		};
	});
</script>

{#snippet avatar(
	profile: Pick<Profile, 'id' | 'name' | 'username'>,
	sizeClass = 'h-10 w-10',
	textClass = 'text-sm'
)}
	{#if !pfpErrors.has(profile.id)}
		<img
			src={pfpUrl(profile.id)}
			alt={displayName(profile)}
			class={[sizeClass, 'shrink-0 rounded-full object-cover']}
			onerror={() => pfpErrors.add(profile.id)}
		/>
	{:else}
		<div
			class={[
				sizeClass,
				textClass,
				avatarTone(profile.id),
				'flex shrink-0 items-center justify-center rounded-full font-bold select-none'
			]}
			aria-hidden="true"
		>
			{initialsFor(profile)}
		</div>
	{/if}
{/snippet}

{#if !$isLoggedIn}
	<!-- Minimal, music-native signed-out screen -->
	<div class="flex min-h-[calc(100vh-14rem)] w-full items-center justify-center px-6 py-12">
		<div class="flex max-w-sm flex-col items-center text-center">
			<!-- Overlapping Material You listener cluster -->
			<div class="mb-7 flex items-center justify-center" aria-hidden="true">
				<div
					class="bg-secondary-container text-on-secondary-container ring-background -mr-3.5 flex h-14 w-14 -rotate-6 items-center justify-center rounded-full ring-4"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
						/>
					</svg>
				</div>

				<div
					class="bg-primary-container text-on-primary-container ring-background z-10 flex h-18 w-18 items-center justify-center rounded-full shadow-sm ring-4"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 3a9 9 0 0 0-9 9v7q0 .825.588 1.413T5 21h4v-8H5v-1q0-2.925 2.038-4.962T12 5t4.963 2.038T19 12v1h-4v8h4q.825 0 1.413-.587T21 19v-7a9 9 0 0 0-9-9"
						/>
					</svg>
				</div>

				<div
					class="bg-tertiary-container text-on-tertiary-container ring-background -ml-3.5 flex h-14 w-14 rotate-6 items-center justify-center rounded-full ring-4"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
						/>
					</svg>
				</div>
			</div>

			<h1 class="text-on-surface text-2xl font-bold tracking-tight sm:text-3xl">
				See what friends are playing
			</h1>
			<p class="text-on-surface-variant mt-2.5 text-sm leading-relaxed">
				Sign in to add friends by username and share what you’re listening to.
			</p>

			<div class="mt-7 flex flex-wrap items-center justify-center gap-3">
				<Button variant="filled" onclick={() => goto(resolve('/login'))}>Sign in</Button>
				<Button variant="tonal" onclick={() => goto(resolve('/register'))}>Create account</Button>
			</div>
		</div>
	</div>
{:else}
	<div class="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-12 lg:px-8">
		<!-- Clean Header -->
		<header class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-baseline gap-3">
				<h1 class="text-on-surface text-3xl font-black tracking-tight sm:text-4xl">Friends</h1>
				{#if activeListenerCount > 0}
					<span
						class="text-on-surface-variant inline-flex items-center gap-1.5 text-xs font-medium"
					>
						<span class="bg-primary h-1.5 w-1.5 rounded-full"></span>
						{activeListenerCount} listening
					</span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if $friends.length > 0}
					<div
						class="bg-surface-container focus-within:bg-surface-container-high flex min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 transition-colors sm:w-52 sm:flex-initial sm:focus-within:w-64"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							class="text-on-surface-variant shrink-0"
							aria-hidden="true"
						>
							<path
								fill="currentColor"
								d="m19.6 21l-6.3-6.3q-.75.6-1.725.95T9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l6.3 6.3zM9.5 14q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14"
							/>
						</svg>
						<input
							type="search"
							bind:value={searchQuery}
							placeholder="Search..."
							aria-label="Search friends or tracks"
							class="text-on-surface placeholder:text-on-surface-variant/65 w-full border-none bg-transparent py-2 text-sm outline-none"
						/>
						{#if searchQuery}
							<button
								type="button"
								onclick={() => (searchQuery = '')}
								aria-label="Clear search"
								class="text-on-surface-variant hover:text-on-surface flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
									<path
										fill="currentColor"
										d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
									/>
								</svg>
							</button>
						{/if}
					</div>
				{/if}

				<button
					type="button"
					onclick={() => refreshAll(true)}
					disabled={refreshing}
					aria-label="Refresh friends"
					title="Refresh"
					class="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors disabled:opacity-50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						class={refreshing ? 'animate-spin' : ''}
					>
						<path
							fill="currentColor"
							d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20"
						/>
					</svg>
				</button>

				<div class="shrink-0">
					<Button variant="filled" onclick={openAddDialog}>Add friend</Button>
				</div>
			</div>
		</header>

		<div class="flex flex-col gap-9">
			<!-- Compact Requests Strip (only when requests exist) -->
			{#if totalRequestCount > 0}
				<section aria-label="Friend requests" class="flex flex-col gap-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<h2 class="text-on-surface-variant text-sm font-semibold">Requests</h2>
							<span
								class={[
									'rounded-full px-2 py-0.5 text-[11px] leading-none font-bold',
									incomingCount > 0
										? 'bg-primary text-on-primary'
										: 'bg-surface-container-high text-on-surface-variant'
								]}
							>
								{totalRequestCount}
							</span>
						</div>

						<button
							type="button"
							onclick={toggleRequestsExpanded}
							class="text-on-surface-variant hover:text-on-surface cursor-pointer border-none bg-transparent text-xs font-medium transition-colors"
						>
							{requestsExpanded ? 'Hide' : 'Show'}
						</button>
					</div>

					{#if requestsExpanded}
						<div
							transition:slide={{ duration: 180 }}
							class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
						>
							{#each incomingRequests as user (user.id)}
								{@const isBusy = busyUsers.has(user.id)}
								{@const label = displayName(user)}
								<div
									class="bg-secondary-container/45 flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5"
								>
									<div class="flex min-w-0 items-center gap-2.5">
										{@render avatar(user, 'h-9 w-9', 'text-xs')}
										<div class="min-w-0">
											<p class="text-on-surface truncate text-sm font-semibold" title={label}>
												{label}
											</p>
											<p class="text-on-surface-variant truncate text-xs">@{user.username}</p>
										</div>
									</div>

									<div class="flex shrink-0 items-center gap-1">
										<button
											type="button"
											onclick={() => acceptRequest(user)}
											disabled={isBusy}
											class="bg-primary text-on-primary hover:bg-primary/90 h-8 cursor-pointer rounded-full border-none px-3 text-xs font-semibold transition-colors disabled:opacity-50"
										>
											Accept
										</button>
										<button
											type="button"
											onclick={() => rejectRequest(user, true)}
											disabled={isBusy}
											aria-label={`Decline ${label}`}
											title="Decline"
											class="text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors disabled:opacity-50"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
											>
												<path
													fill="currentColor"
													d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/each}

							{#each outgoingRequests as user (user.id)}
								{@const isBusy = busyUsers.has(user.id)}
								{@const label = displayName(user)}
								<div
									class="bg-surface-container-low flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5"
								>
									<div class="flex min-w-0 items-center gap-2.5">
										{@render avatar(user, 'h-9 w-9', 'text-xs')}
										<div class="min-w-0">
											<p class="text-on-surface truncate text-sm font-semibold" title={label}>
												{label}
											</p>
											<p class="text-on-surface-variant truncate text-xs">
												@{user.username} · Sent
											</p>
										</div>
									</div>

									<button
										type="button"
										onclick={() => rejectRequest(user, false)}
										disabled={isBusy}
										aria-label={`Cancel request to ${label}`}
										title="Cancel request"
										class="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors disabled:opacity-50"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
											/>
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			<!-- Main Friends Content -->
			{#if refreshing && !hasLoadedOnce && $friends.length === 0}
				<div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading">
					{#each [0, 1, 2] as item (item)}
						<div class="bg-surface-container flex animate-pulse flex-col gap-4 rounded-3xl p-4">
							<div class="flex items-center gap-2.5">
								<div class="bg-surface-container-highest h-8 w-8 rounded-full"></div>
								<div class="bg-surface-container-highest h-3.5 w-24 rounded-full"></div>
							</div>
							<div class="flex items-center gap-3.5">
								<div class="bg-surface-container-highest h-16 w-16 rounded-2xl"></div>
								<div class="flex flex-1 flex-col gap-2">
									<div class="bg-surface-container-highest h-4 w-32 rounded-full"></div>
									<div class="bg-surface-container-highest h-3 w-20 rounded-full"></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if $friends.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div
						class="bg-surface-container text-on-surface-variant mb-4 flex h-14 w-14 items-center justify-center rounded-full"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M12 3a9 9 0 0 0-9 9v7q0 .825.588 1.413T5 21h4v-8H5v-1q0-2.925 2.038-4.962T12 5t4.963 2.038T19 12v1h-4v8h4q.825 0 1.413-.587T21 19v-7a9 9 0 0 0-9-9"
							/>
						</svg>
					</div>
					<p class="text-on-surface text-lg font-bold">No friends yet</p>
					<p class="text-on-surface-variant mt-1 max-w-xs text-sm">
						Add someone by username to see what they’re playing.
					</p>
					<div class="mt-5">
						<Button variant="filled" onclick={openAddDialog}>Add friend</Button>
					</div>
				</div>
			{:else if filteredFriends.length === 0}
				<div class="flex flex-col items-center justify-center gap-3 py-14 text-center">
					<p class="text-on-surface-variant text-sm">
						No friends matching “{searchQuery.trim()}”.
					</p>
					<Button variant="text" onclick={() => (searchQuery = '')}>Clear search</Button>
				</div>
			{:else}
				<!-- Listening Now Showcase Cards -->
				{#if filteredListening.length > 0}
					<section aria-label="Listening now" class="flex flex-col gap-3.5">
						<div class="flex items-center gap-2">
							<span class="bg-primary h-2 w-2 rounded-full"></span>
							<h2 class="text-on-surface-variant text-sm font-semibold">Listening now</h2>
						</div>

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each filteredListening as friend (friend.id)}
								{@const current = friend.listening!.current!}
								{@const art = artworkUrl(friend)}
								{@const label = displayName(friend)}
								{@const isBusy = busyUsers.has(friend.id)}

								<article
									class="group bg-surface-container hover:bg-surface-container-high relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] p-4 transition-colors"
								>
									{#if art && !artErrors.has(art)}
										<img
											src={art}
											alt=""
											aria-hidden="true"
											class="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full object-cover opacity-20 blur-2xl dark:opacity-25"
										/>
									{/if}

									<!-- Friend header -->
									<div class="relative flex items-center justify-between gap-2">
										<div class="flex min-w-0 items-center gap-2.5">
											{@render avatar(friend, 'h-8 w-8', 'text-xs')}
											<span
												class="text-on-surface truncate text-sm font-semibold"
												title={`${label} (@${friend.username})`}
											>
												{label}
											</span>
										</div>

										<div class="flex shrink-0 items-center gap-1.5">
											{#if current.playing}
												<span class="eq-bars" aria-label="Playing" title="Playing">
													<span></span>
													<span></span>
													<span></span>
												</span>
											{:else}
												<span class="text-on-surface-variant/80 text-[11px] font-medium">
													Paused
												</span>
											{/if}

											<button
												type="button"
												onclick={() => removeFriend(friend)}
												disabled={isBusy}
												aria-label={`Remove ${label}`}
												title={`Remove ${label}`}
												class="text-on-surface-variant hover:bg-error-container/60 hover:text-error flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-transparent opacity-70 transition-all focus-visible:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
												>
													<path
														fill="currentColor"
														d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
													/>
												</svg>
											</button>
										</div>
									</div>

									<!-- Track focus -->
									<div class="relative flex items-center gap-3.5">
										{#if art && !artErrors.has(art)}
											<img
												src={art}
												alt={`${current.title} album art`}
												class="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm"
												onerror={() => artErrors.add(art)}
											/>
										{:else}
											<div
												class="bg-primary-container/75 text-on-primary-container flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
												aria-hidden="true"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="26"
													height="26"
													viewBox="0 0 24 24"
												>
													<path
														fill="currentColor"
														d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
													/>
												</svg>
											</div>
										{/if}

										<div class="min-w-0 flex-1">
											<p
												class="text-on-surface truncate text-base leading-snug font-bold"
												title={current.title}
											>
												{current.title}
											</p>
											<p
												class="text-on-surface-variant mt-0.5 truncate text-sm"
												title={current.artist || 'Unknown Artist'}
											>
												{current.artist || 'Unknown Artist'}
											</p>
											{#if current.album}
												<p
													class="text-on-surface-variant/70 mt-0.5 truncate text-xs"
													title={current.album}
												>
													{current.album}
												</p>
											{/if}
										</div>
									</div>
								</article>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Calm 2-Column Friends Grid -->
				{#if filteredOther.length > 0}
					<section aria-label="Friends list" class="flex flex-col gap-3.5">
						{#if filteredListening.length > 0}
							<h2 class="text-on-surface-variant text-sm font-semibold">Everyone else</h2>
						{/if}

						<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
							{#each filteredOther as friend (friend.id)}
								{@const last = friend.listening?.lastPlayed ?? null}
								{@const art = artworkUrl(friend)}
								{@const label = displayName(friend)}
								{@const isBusy = busyUsers.has(friend.id)}
								{@const shortTime = formatShortTime(last?.playedAt, nowMs)}
								{@const hasSeparateName = Boolean(
									friend.name?.trim() &&
									friend.name.trim().toLowerCase() !== friend.username.toLowerCase()
								)}

								<div
									class="group bg-surface-container-low hover:bg-surface-container flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors"
								>
									{@render avatar(friend, 'h-11 w-11', 'text-sm')}

									<div class="min-w-0 flex-1">
										<div class="flex items-baseline gap-1.5">
											<p class="text-on-surface truncate text-sm font-semibold" title={label}>
												{hasSeparateName ? label : `@${friend.username}`}
											</p>
											{#if hasSeparateName}
												<span class="text-on-surface-variant/70 truncate text-xs">
													@{friend.username}
												</span>
											{/if}
										</div>

										{#if last}
											{@const trackSummary = `${last.title} · ${last.artist || 'Unknown Artist'}`}
											<div class="mt-1 flex min-w-0 items-center gap-1.5">
												{#if art && !artErrors.has(art)}
													<img
														src={art}
														alt="Album art"
														class="h-4 w-4 shrink-0 rounded object-cover"
														onerror={() => artErrors.add(art)}
													/>
												{:else}
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="13"
														height="13"
														viewBox="0 0 24 24"
														class="text-on-surface-variant/70 shrink-0"
														aria-hidden="true"
													>
														<path
															fill="currentColor"
															d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
														/>
													</svg>
												{/if}
												<p
													class="text-on-surface-variant min-w-0 truncate text-xs"
													title={`${trackSummary}${shortTime ? ` · ${shortTime}` : ''}`}
												>
													{trackSummary}
												</p>
												{#if shortTime}
													<span class="text-on-surface-variant/65 shrink-0 text-[11px]">
														· {shortTime}
													</span>
												{/if}
											</div>
										{/if}
									</div>

									<button
										type="button"
										onclick={() => removeFriend(friend)}
										disabled={isBusy}
										aria-label={`Remove ${label}`}
										title={`Remove ${label}`}
										class="text-on-surface-variant hover:bg-error-container/60 hover:text-error flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent opacity-65 transition-all focus-visible:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="18"
											height="18"
											viewBox="0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
											/>
										</svg>
									</button>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Add Friend Dialog -->
	<Dialog
		bind:open={addDialogOpen}
		headline="Add friend"
		onEsc={closeAddDialog}
		onClick={closeAddDialog}
		style="width: min(25rem, calc(100vw - 2rem));"
	>
		<form id="add-friend-form" onsubmit={handleAddFriend} class="flex flex-col gap-3">
			<div
				class="bg-surface ring-outline-variant focus-within:ring-primary flex items-center gap-1.5 rounded-xl px-3.5 ring-1 transition focus-within:ring-2"
			>
				<span class="text-on-surface-variant text-sm font-semibold select-none">@</span>
				<input
					bind:this={addInputEl}
					type="text"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					bind:value={selectedFriend}
					oninput={() => (addFeedback = null)}
					placeholder="username"
					aria-label="Friend's username"
					class="text-on-surface placeholder:text-on-surface-variant/60 w-full border-none bg-transparent py-2.5 text-sm outline-none"
				/>
			</div>

			{#if isSelfUsername}
				<p class="text-on-surface-variant text-xs">That’s your own username.</p>
			{:else if matchingFriend}
				<p class="text-on-surface-variant text-xs">
					Already friends with @{matchingFriend.username}.
				</p>
			{:else if matchingOutgoing}
				<p class="text-on-surface-variant text-xs">
					Request already sent to @{matchingOutgoing.username}.
				</p>
			{:else if matchingIncoming}
				<div
					class="bg-surface-container flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
				>
					<div class="min-w-0">
						<p class="text-on-surface truncate text-xs font-semibold">
							{displayName(matchingIncoming)} already sent you a request
						</p>
					</div>
					<Button
						variant="filled"
						type="button"
						onclick={() => acceptRequest(matchingIncoming)}
						disabled={busyUsers.has(matchingIncoming.id)}
					>
						Accept
					</Button>
				</div>
			{:else if addFeedback}
				<p
					role={addFeedback.tone === 'error' ? 'alert' : 'status'}
					class={[
						'text-xs font-medium',
						addFeedback.tone === 'error' ? 'text-error' : 'text-primary'
					]}
				>
					{addFeedback.message}
				</p>
			{/if}

			{#if $SavedUser?.username}
				<div
					class="border-outline-variant/40 mt-1 flex items-center justify-between gap-2 border-t pt-3 text-xs"
				>
					<span class="text-on-surface-variant truncate">
						Your username: <span class="text-on-surface font-semibold">@{$SavedUser.username}</span>
					</span>
					<button
						type="button"
						onclick={copyOwnUsername}
						class="text-primary hover:bg-primary/10 shrink-0 cursor-pointer rounded-full border-none bg-transparent px-2.5 py-1 text-xs font-semibold transition-colors"
					>
						{copiedUsername ? 'Copied' : 'Copy'}
					</button>
				</div>
			{/if}
		</form>

		{#snippet buttons()}
			<Button variant="text" onclick={closeAddDialog}>Cancel</Button>
			<Button variant="filled" type="submit" form="add-friend-form" disabled={!canSubmitAdd}>
				{addingFriend ? 'Sending...' : 'Send request'}
			</Button>
		{/snippet}
	</Dialog>
{/if}

<style>
	.eq-bars {
		display: inline-flex;
		align-items: flex-end;
		gap: 2px;
		height: 12px;
	}

	.eq-bars span {
		width: 2.5px;
		border-radius: 999px;
		background: rgb(var(--m3-scheme-primary));
		animation: eq-bounce 1s ease-in-out infinite;
	}

	.eq-bars span:nth-child(1) {
		height: 55%;
		animation-delay: 0s;
	}

	.eq-bars span:nth-child(2) {
		height: 100%;
		animation-delay: 0.2s;
	}

	.eq-bars span:nth-child(3) {
		height: 70%;
		animation-delay: 0.4s;
	}

	@keyframes eq-bounce {
		0%,
		100% {
			transform: scaleY(0.45);
			transform-origin: bottom;
		}
		50% {
			transform: scaleY(1);
			transform-origin: bottom;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.eq-bars span {
			animation: none;
		}
	}
</style>
