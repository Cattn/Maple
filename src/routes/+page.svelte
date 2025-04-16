<script lang="ts">
	import TrackWrapper from '$lib/components/TrackWrapper.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Command from '$lib/components/ui/command';
	import ContextMenu from '$lib/components/ui/context-menu/context-menu.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { OPFS } from '$lib/opfs';
	import { hideTips, isSmallDevice, title, recentlyPlayedManager } from '$lib/store';
	import type { Playlist } from '$lib/types/playlist';
	import type { Song } from '$lib/types/song';
	import {
		ArrowDownZA,
		ArrowUpAZ,
		CircleAlert,
		CircleCheck,
		Info,
		List,
		ListFilter,
		X,
		Music,
		Home as HomeIcon,
		Plus,
		Clock,
		Star
	} from 'lucide-svelte';
	// @ts-ignore
	import Lazy from 'svelte-lazy';
	import { toast } from 'svelte-sonner';
	import { onMount, tick } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	$: recentlyPlayedSongs = $recentlyPlayedManager.get();

	let tracks: Song[] = [];
	let playlists: Playlist[] = [];
	let onboard = true;
	let isLoading = true;
	let showWelcome = true;

	onMount(async () => {
		isLoading = true;
		try {
			tracks = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
			playlists = await OPFS.get().playlists();
			onboard = await OPFS.ifExists('tracks');
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			isLoading = false;
		}
		title.set('Home');
		
		// Auto-hide welcome message after 8 seconds
		setTimeout(() => {
			showWelcome = false;
		}, 8000);
	});

	let ascending = true;

	function swapAscending() {
		ascending = !ascending;
	}

	async function getImageUrl(imagePath: string): Promise<string> {
		try {
			const response = await OPFS.get().image(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer]);
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error('Error loading image:', error);
			return '';
		}
	}

	async function addTrackToPlaylist(track: Song, playlist: Playlist) {
		if (track && playlist) {
			OPFS.track().addToPlaylist(track, playlist);
			toast.success(`Added ${track.title} to ${playlist.name}`);
		}
	}

	let openContextMenu = false;
	let open = false;
	let selectedSong: Song | null = null;

	function openAlert(track: Song) {
		open = true;
		selectedSong = track;
	}

	function hideTipsPanel() {
		hideTips.set(true);
	}
</script>

<div class="container mx-auto max-w-7xl px-4 py-6">
	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div class="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
		</div>
	{:else}
		<!-- Welcome alert section -->
		{#if showWelcome}
			<div in:fade={{ duration: 300 }} out:fade={{ duration: 300 }} class="mb-6">
				{#if !onboard}
					<Alert.Root class="relative overflow-hidden rounded-xl border-0 bg-gradient-to-r from-primary/20 to-secondary/20 p-6 shadow-md">
						<div class="flex items-start gap-4">
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
								<Info size={20} />
							</div>
							<div class="flex-1">
								<Alert.Title class="mb-2 text-xl font-semibold text-foreground">Welcome to Maple</Alert.Title>
								<Alert.Description class="text-base text-muted-foreground">
									This app allows you to upload your music library, and explore and organize your music.
									<br/>Start by adding music in <Button variant="link" href="/settings" class="h-auto p-0">Settings</Button>.
								</Alert.Description>
							</div>
							<Button variant="ghost" size="sm" class="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground" on:click={() => showWelcome = false}>
								<X size={18} />
							</Button>
						</div>
					</Alert.Root>
				{:else}
					<Alert.Root class="relative overflow-hidden rounded-xl border-0 bg-gradient-to-r from-green-500/20 to-green-700/20 p-6 shadow-md">
						<div class="flex items-start gap-4">
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-500">
								<CircleCheck size={20} />
							</div>
							<div class="flex-1">
								<Alert.Title class="mb-2 text-xl font-semibold text-foreground">Your music library is ready</Alert.Title>
								<Alert.Description class="text-base text-muted-foreground">
									You're all set! Enjoy your music collection or browse 
									<Button variant="link" href="/tracks" class="h-auto p-0">all tracks</Button>.
								</Alert.Description>
							</div>
							<Button variant="ghost" size="sm" class="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground" on:click={() => showWelcome = false}>
								<X size={18} />
							</Button>
						</div>
					</Alert.Root>
				{/if}
			</div>
		{/if}

		<!-- Quick Access Section -->
		<div class="mb-8">
			<h2 class="mb-4 text-2xl font-bold text-foreground">Quick Access</h2>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<a href="/tracks" class="group rounded-xl bg-secondary/40 p-4 transition-all hover:bg-secondary/60">
					<div class="flex flex-col items-center justify-center space-y-3 text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary transition-all group-hover:bg-primary/30">
							<Music size={24} />
						</div>
						<h3 class="text-sm font-medium text-foreground sm:text-base">Tracks</h3>
					</div>
				</a>
				
				<a href="/albums" class="group rounded-xl bg-secondary/40 p-4 transition-all hover:bg-secondary/60">
					<div class="flex flex-col items-center justify-center space-y-3 text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary transition-all group-hover:bg-primary/30">
							<ListFilter size={24} />
						</div>
						<h3 class="text-sm font-medium text-foreground sm:text-base">Albums</h3>
					</div>
				</a>
				
				<a href="/artists" class="group rounded-xl bg-secondary/40 p-4 transition-all hover:bg-secondary/60">
					<div class="flex flex-col items-center justify-center space-y-3 text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary transition-all group-hover:bg-primary/30">
							<Star size={24} />
						</div>
						<h3 class="text-sm font-medium text-foreground sm:text-base">Artists</h3>
					</div>
				</a>
				
				<a href="/playlists" class="group rounded-xl bg-secondary/40 p-4 transition-all hover:bg-secondary/60">
					<div class="flex flex-col items-center justify-center space-y-3 text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary transition-all group-hover:bg-primary/30">
							<List size={24} />
						</div>
						<h3 class="text-sm font-medium text-foreground sm:text-base">Playlists</h3>
					</div>
				</a>
			</div>
		</div>

		<!-- Recently Played Section -->
		{#if recentlyPlayedSongs.length > 0}
			<div class="mb-8">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-foreground">Recently Played</h2>
					<Button variant="ghost" size="sm" class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
						<Clock size={16} />
						<span>View All</span>
					</Button>
				</div>
				
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{#each recentlyPlayedSongs.slice(0, 6) as track}
						{#if track}
							<div class="group flex flex-col rounded-xl bg-secondary/20 p-3 transition-all duration-200 hover:bg-secondary/40">
								{#await getImageUrl(track.image) then image}
									<ContextMenu
										type={'track'}
										on:delete={() => openAlert(track)}
										on:addTrackToPlaylist={(e) => addTrackToPlaylist(track, e.detail.playlist)}
									>
										<TrackWrapper className="w-full" {track} {tracks}>
											<Lazy height={180} keep={true}>
												<div class="relative mb-3 aspect-square w-full overflow-hidden rounded-lg">
													{#if image}
														<img 
															class="h-full w-full object-cover transition-all duration-300 group-hover:scale-105" 
															src={image} 
															alt={track.title} 
														/>
													{:else}
														<div class="flex h-full w-full items-center justify-center bg-primary/20">
															<Music size={30} class="text-primary/60" />
														</div>
													{/if}
													<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
														<div class="rounded-full bg-primary p-3 text-primary-foreground">
															<Music size={16} />
														</div>
													</div>
												</div>
											</Lazy>
										</TrackWrapper>
									</ContextMenu>
									<div class="flex flex-col">
										<h3 class="line-clamp-1 text-sm font-medium text-foreground">{track.title}</h3>
										<p class="line-clamp-1 text-xs text-muted-foreground">{track.artist}</p>
									</div>
								{:catch error}
									<div class="aspect-square animate-pulse rounded-lg bg-secondary"></div>
								{/await}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Tips Section -->
		{#if $hideTips == false}
			<div class="mb-8 overflow-hidden rounded-xl border bg-card shadow-md" transition:slide={{ duration: 300 }}>
				<div class="flex items-center justify-between border-b p-4">
					<h2 class="text-lg font-semibold text-foreground">Quick Tips</h2>
					<Button 
						variant="ghost" 
						size="icon" 
						class="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
						on:click={hideTipsPanel}
					>
						<X size={16} />
					</Button>
				</div>
				
				<div class="grid gap-1 p-4 sm:grid-cols-2 lg:grid-cols-3">
					<div class="rounded-lg p-4 hover:bg-secondary/20">
						<h3 class="mb-2 font-medium text-foreground">Search & Filter</h3>
						<p class="mb-3 text-sm text-muted-foreground">Use the search box at the top of each page to quickly find your content, or use filters to sort by various attributes.</p>
						<div class="flex items-center gap-2">
							<Button variant="secondary" size="sm" class="h-8">
								<Search size={14} class="mr-1" /> Search
							</Button>
							<Button variant="outline" size="sm" class="h-8">
								<ListFilter size={14} class="mr-1" /> Filter
							</Button>
						</div>
					</div>
					
					<div class="rounded-lg p-4 hover:bg-secondary/20">
						<h3 class="mb-2 font-medium text-foreground">Quick Access</h3>
						<p class="mb-3 text-sm text-muted-foreground">Press <kbd class="rounded bg-secondary/50 px-1.5 py-0.5 text-xs font-medium text-foreground">Ctrl+K</kbd> or click the search button in the top bar to quickly navigate between pages.</p>
						<Button variant="secondary" size="sm" class="h-8" on:click={() => open = true}>
							<Command.CommandIcon size={14} class="mr-1" /> Command Menu
						</Button>
					</div>
					
					{#if !$isSmallDevice}
						<div class="rounded-lg p-4 hover:bg-secondary/20">
							<h3 class="mb-2 font-medium text-foreground">Context Menus</h3>
							<p class="mb-3 text-sm text-muted-foreground">Right-click on any song, album, or playlist to access quick actions like adding to a playlist or deleting.</p>
							<div class="ml-1 flex h-8 items-center text-sm">
								<span class="text-muted-foreground">Try right clicking on content</span>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<Command.Dialog class="bg-background/90 backdrop-blur-sm" bind:open>
	<Command.Input placeholder="Search for tracks, albums, artists, or navigate to a page..." />
	<Command.List>
		<Command.Empty>No results found.</Command.Empty>
		<Command.Group heading="Navigation">
			<a href="/">
				<Command.Item>
					<HomeIcon class="mr-2 h-4 w-4" />
					<span>Home</span>
				</Command.Item>
			</a>
			<a href="/tracks">
				<Command.Item>
					<Music class="mr-2 h-4 w-4" />
					<span>Tracks</span>
				</Command.Item>
			</a>
			<a href="/albums">
				<Command.Item>
					<ListFilter class="mr-2 h-4 w-4" />
					<span>Albums</span>
				</Command.Item>
			</a>
			<a href="/artists">
				<Command.Item>
					<Star class="mr-2 h-4 w-4" />
					<span>Artists</span>
				</Command.Item>
			</a>
			<a href="/playlists">
				<Command.Item>
					<List class="mr-2 h-4 w-4" />
					<span>Playlists</span>
				</Command.Item>
			</a>
		</Command.Group>
		
		{#if tracks.length > 0}
			<Command.Separator />
			<Command.Group heading="Recent Tracks">
				{#each tracks.slice(0, 5) as track}
					<TrackWrapper className="" {track} {tracks}>
						<Command.Item>
							<Music class="mr-2 h-4 w-4" />
							<span>{track.title.replace(/["\[\]]/g, '')}</span>
						</Command.Item>
					</TrackWrapper>
				{/each}
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>
