<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { OPFS } from '$lib/opfs';
	import { title } from '$lib/store';
	import type { Playlist } from '$lib/types/playlist';
	import type { Song } from '$lib/types/song';
	import { Check, Grid, List, ListFilter, Music, Pencil, Plus, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { v4 as uuidv4 } from 'uuid';
	// @ts-ignore
	import Lazy from 'svelte-lazy';
	import { toast } from 'svelte-sonner';

	let doCreate = false;
	let editModeOn = true;
	let changedName = '';
	let changedDescription = '';
	let imageFile: Blob | null = null;
	let playlists: Playlist[] = [];
	let searchQuery = '';
	let filteredPlaylists: Playlist[] = [];
	let listType = 'grid';
	let isLoading = true;
	let newPlaylist: Playlist = {
		id: uuidv4(),
		name: 'My Playlist',
		description: 'A playlist I just made!',
		image: '',
		tracks: []
	};
	let songs: Song[] = [];
	let addedSongs: String[] = [];
	let curSongs: Song[] = [];
	let searchSongsQuery = '';
	let filteredSongs: Song[] = [];

	$: params = new URLSearchParams($page.url.search);
	$: {
		doCreate = params.get('create') === 'true';
	}

	onMount(async () => {
		try {
			songs = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
			filteredSongs = songs;
			changedName = newPlaylist.name;
			changedDescription = newPlaylist.description;
			playlists = await OPFS.get().playlists();
			filteredPlaylists = [...playlists];
			title.set('Playlists');
		} catch (error) {
			console.error('Error loading playlists:', error);
			toast.error('Failed to load playlists');
		} finally {
			isLoading = false;
		}
	});

	async function refresh() {
		try {
			isLoading = true;
			playlists = [];
			let newPlaylists = await OPFS.get().playlists();
			songs = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
			changedName = newPlaylist.name;
			changedDescription = newPlaylist.description;
			playlists = newPlaylists;
			filteredPlaylists = [...playlists];
			filterPlaylists();
		} catch (error) {
			console.error('Error refreshing playlists:', error);
			toast.error('Failed to refresh playlists');
		} finally {
			isLoading = false;
		}
	}

	function filterPlaylists() {
		if (!searchQuery.trim()) {
			filteredPlaylists = [...playlists];
		} else {
			const query = searchQuery.toLowerCase().trim();
			filteredPlaylists = playlists.filter(
				(playlist) =>
					playlist.name.toLowerCase().includes(query) ||
					(playlist.description && playlist.description.toLowerCase().includes(query))
			);
		}
	}

	$: searchQuery, filterPlaylists();

	function swapListType(type: string) {
		listType = type;
	}

	async function getImageUrl(imagePath: string): Promise<string> {
		try {
			const response = await OPFS.get().image(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer]);
			const respons2e = await fetch(URL.createObjectURL(blob));
			if (respons2e.headers.get('Content-Length') === '0') {
				return '';
			}
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error('Error loading image:', error);
			return '';
		}
	}

	async function editMode() {
		editModeOn = !editModeOn;

		if (!editModeOn && newPlaylist) {
			const doImage = imageFile !== null;
			const modifiedplaylist: Playlist = {
				id: newPlaylist.id,
				name: changedName,
				description: newPlaylist.description,
				image: doImage ? imageFile : newPlaylist.image,
				tracks: newPlaylist.tracks
			};
			OPFS.addPlaylist(modifiedplaylist);
			let updatedPlaylist = await OPFS.get().playlist(modifiedplaylist.id.toString());
			if (updatedPlaylist) {
				newPlaylist = updatedPlaylist;
			}
			doCreate = false;
			goto('/playlists');
			refresh();
		}
	}

	function handlePhotoChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.readAsArrayBuffer(file);
			reader.onload = () => {
				const imageBlob = new Blob([reader.result as ArrayBuffer], { type: file.type });
				imageFile = imageBlob;
			};
		}
	}

	let open = false;

	function toggleSongSelection(song: Song) {
		const index = addedSongs.findIndex((s) => s === song.id);
		if (index === -1) {
			addedSongs = [...addedSongs, song.id];
			curSongs = [...curSongs, song];
		} else {
			addedSongs = addedSongs.filter((s) => s !== song.id);
			curSongs = curSongs.filter((s) => s.id !== song.id);
		}
	}

	$: isToggled = (song: Song) => addedSongs.includes(song.id);

	function submitSongs() {
		newPlaylist.tracks = addedSongs;
		open = false;
	}

	function formatDuration(duration: number): string {
		const roundedDuration = Math.round(duration);
		const minutes = Math.floor(roundedDuration / 60);
		const seconds = roundedDuration % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	let isOpenAlert = false;
	let selectedPlaylist: Playlist | null = null;

	function deletePlaylist() {
		if (selectedPlaylist) {
			OPFS.playlist().delete(selectedPlaylist);
			toast.success(`Playlist ${selectedPlaylist.name} deleted successfully!`);
			playlists = playlists.filter((p) => p.id !== selectedPlaylist?.id);
			filteredPlaylists = filteredPlaylists.filter((p) => p.id !== selectedPlaylist?.id);
			isOpenAlert = false;
		} else {
			console.error('Playlist not found');
		}
	}

	function openAlert(playlist: Playlist) {
		selectedPlaylist = playlist;
		isOpenAlert = true;
	}

	function filterSongs() {
		filteredSongs = songs.filter(
			(song) =>
				song.title.toLowerCase().includes(searchSongsQuery.toLowerCase()) ||
				song.artist.toLowerCase().includes(searchSongsQuery.toLowerCase()) ||
				song.album.toLowerCase().includes(searchSongsQuery.toLowerCase())
		);
	}

	$: searchSongsQuery, filterSongs();
</script>

{#if !doCreate}
	<div class="animate-fade-in px-4 py-4 md:px-6">
		<header class="animate-slide-up">
			<h1 class="mb-2 text-2xl font-semibold text-foreground md:text-3xl">Your Playlists</h1>

			<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
				<div class="relative w-full md:w-72">
					<div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
						<Search size={18} />
					</div>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search playlists..."
						class="h-10 w-full rounded-lg bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
					/>
				</div>

				<div class="flex items-center gap-2">
					<Tabs.Root value={listType} class="mr-2">
						<Tabs.List class="grid grid-cols-2 bg-secondary/30">
							<Tabs.Trigger
								value="grid"
								class="flex h-9 items-center justify-center data-[state=active]:shadow-none"
								on:click={() => swapListType('grid')}
							>
								<Grid size={18} />
							</Tabs.Trigger>
							<Tabs.Trigger
								value="list"
								class="flex h-9 items-center justify-center data-[state=active]:shadow-none"
								on:click={() => swapListType('list')}
							>
								<List size={18} />
							</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>
				</div>
			</div>
		</header>

		{#if isLoading}
			<div
				class="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:grid-cols-5"
			>
				{#each Array(10) as _, i}
					<div class="animate-pulse">
						<div class="aspect-square w-full rounded-xl bg-secondary/40"></div>
						<div class="mt-3 h-5 w-3/4 rounded bg-secondary/40"></div>
						<div class="mt-2 h-4 w-2/4 rounded bg-secondary/30"></div>
					</div>
				{/each}
			</div>
		{:else if filteredPlaylists.length === 0 && searchQuery !== ''}
			<div class="animate-fade-in flex h-64 flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/40">
					<Search size={24} class="text-muted-foreground" />
				</div>
				<h2 class="text-xl font-medium text-foreground">No playlists found</h2>
				<p class="mt-2 text-muted-foreground">Try adjusting your search</p>
			</div>
		{:else if listType === 'grid'}
			<div
				class="animate-fade-in my-6 grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:grid-cols-5"
			>
				<a
					href={`/playlists?create=true`}
					class="hover-scale animate-slide-up group relative flex flex-col items-start"
				>
					<div
						class="relative h-0 w-full overflow-hidden rounded-xl bg-secondary/30 pb-[100%] shadow-lg"
					>
						<div class="absolute inset-0 flex items-center justify-center">
							<div
								class="transform rounded-full bg-primary/70 p-4 transition-transform duration-300 group-hover:scale-110"
							>
								<Plus size={24} class="text-white" />
							</div>
						</div>
					</div>
					<div class="mt-3 flex w-full flex-col items-start space-y-1 px-1">
						<h2
							class="line-clamp-1 w-full text-base font-semibold leading-tight text-foreground transition-colors duration-300 group-hover:text-primary md:text-lg"
						>
							Create Playlist
						</h2>
					</div>
				</a>

				{#each filteredPlaylists as playlist, i}
					<div
						class="hover-scale animate-slide-up group relative flex flex-col items-start"
						style="animation-delay: {i * 40}ms"
					>
						<a
							class="perspective w-full"
							href={`/playlist?playlist=${playlist.id}`}
							on:contextmenu|preventDefault={() => openAlert(playlist)}
						>
							<div class="relative h-0 w-full overflow-hidden rounded-xl pb-[100%] shadow-lg">
								{#await getImageUrl(playlist.image) then image}
									<Lazy height={208} keep={true}>
										{#if image}
											<img
												class="absolute left-0 top-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
												src={image}
												alt={playlist.name}
											/>
										{:else}
											<div
												class="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"
											></div>
											<div class="absolute inset-0 flex items-center justify-center">
												<div class="text-4xl font-bold text-foreground/50">
													{playlist.name.charAt(0).toUpperCase()}
												</div>
											</div>
										{/if}
										<div
											class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
										></div>
									</Lazy>
								{:catch error}
									<div
										class="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-secondary/30"
									>
										<Music size={48} class="text-muted-foreground/50" />
									</div>
								{/await}
							</div>
						</a>

						<div class="mt-3 flex w-full flex-col items-start space-y-1 px-1">
							<div class="flex w-full items-center justify-between">
								<h2
									class="line-clamp-1 flex-1 text-base font-semibold leading-tight text-foreground transition-colors duration-300 group-hover:text-primary md:text-lg"
								>
									{playlist.name}
								</h2>

								<DropdownMenu.Root>
									<DropdownMenu.Trigger asChild let:builder>
										<Button
											variant="ghost"
											size="icon"
											class="h-7 w-7 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
											builders={[builder]}
										>
											<ListFilter size={14} class="text-muted-foreground" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" class="glass-effect">
										<DropdownMenu.Item on:click={() => openAlert(playlist)}>
											Delete Playlist
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</div>

							{#if playlist.description}
								<p
									class="line-clamp-1 w-full text-sm font-normal leading-tight text-muted-foreground md:text-base"
								>
									{playlist.description}
								</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="glass-effect my-4 flex flex-col space-y-1 rounded-lg p-2">
				<div class="animate-slide-up">
					<a href={`/playlists?create=true`} class="block">
						<div
							class="group relative mb-2 flex w-full items-center rounded-xl p-3 transition-all duration-200 hover:bg-secondary/30"
						>
							<div class="flex w-full items-center gap-4">
								<div
									class="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/30 md:h-16 md:w-16"
								>
									<Plus size={24} class="text-primary" />
								</div>
								<div class="flex min-w-0 flex-1 flex-col">
									<h1
										class="line-clamp-1 text-base font-medium text-foreground transition-colors duration-300 group-hover:text-primary"
									>
										Create New Playlist
									</h1>
								</div>
							</div>
						</div>
					</a>
				</div>

				{#each filteredPlaylists as playlist, i}
					<div class="animate-slide-up" style="animation-delay: {i * 30}ms">
						<div
							class="group relative mb-2 flex w-full items-center rounded-xl p-3 transition-all duration-200 hover:bg-secondary/30"
						>
							<a class="flex-grow" href={`/playlist?playlist=${playlist.id}`}>
								<div class="flex w-full items-center gap-4">
									<div
										class="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg md:h-16 md:w-16"
									>
										{#await getImageUrl(playlist.image) then image}
											<Lazy height={64} keep={true}>
												{#if image}
													<img
														class="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
														src={image}
														alt={playlist.name}
													/>
												{:else}
													<div
														class="flex h-full w-full items-center justify-center bg-secondary/30 text-xl font-bold text-foreground/50"
													>
														{playlist.name.charAt(0).toUpperCase()}
													</div>
												{/if}
											</Lazy>
										{:catch error}
											<div class="flex h-full w-full items-center justify-center bg-secondary/30">
												<Music size={24} class="text-muted-foreground/50" />
											</div>
										{/await}
									</div>
									<div class="flex min-w-0 flex-1 flex-col">
										<h1
											class="line-clamp-1 text-base font-medium text-foreground transition-colors duration-300 group-hover:text-primary"
										>
											{playlist.name}
										</h1>
										{#if playlist.description}
											<p class="line-clamp-1 text-sm text-muted-foreground">
												{playlist.description}
											</p>
										{/if}
									</div>
								</div>
							</a>

							<div class="ml-2 flex items-center">
								<DropdownMenu.Root>
									<DropdownMenu.Trigger asChild let:builder>
										<Button
											class="h-8 w-8 bg-transparent p-0 opacity-0 transition-opacity duration-300 hover:bg-secondary/80 group-hover:opacity-100"
											builders={[builder]}
										>
											<ListFilter size={16} class="text-muted-foreground" />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content class="glass-effect" align="end">
										<DropdownMenu.Item on:click={() => openAlert(playlist)}>
											Delete Playlist
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="animate-fade-in px-4 py-4 md:px-6">
		<div class="glass-effect mb-8 rounded-lg p-4 shadow-sm md:p-6">
			<div class="flex flex-col items-center gap-6 md:flex-row md:items-start">
				<div class="relative">
					{#if editModeOn}
						<div class="group relative">
							<div class="h-44 w-44 rounded-lg bg-secondary/30 md:h-64 md:w-64">
								{#if imageFile}
									<img
										class="h-full w-full rounded-lg object-cover"
										src={URL.createObjectURL(imageFile)}
										alt="Playlist cover"
									/>
								{:else}
									<div class="flex h-full items-center justify-center">
										<Plus size={40} class="text-foreground/50" />
									</div>
								{/if}
							</div>
							<div
								class="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<label
									for="playlist-image"
									class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
								>
									Add Image
								</label>
								<input
									id="playlist-image"
									type="file"
									class="hidden"
									accept="image/*"
									on:change={(e) => handlePhotoChange(e)}
								/>
							</div>
						</div>
					{/if}
				</div>

				<div class="flex flex-1 flex-col space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex-1">
							{#if editModeOn}
								<div class="space-y-2">
									<label for="playlist-name" class="text-sm font-medium">Playlist Name</label>
									<input
										id="playlist-name"
										bind:value={changedName}
										class="w-full rounded-md border bg-background px-3 py-2 text-xl font-bold shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:text-2xl"
										placeholder="Playlist name"
									/>
								</div>
							{:else}
								<h1 class="text-2xl font-bold text-foreground md:text-3xl">{newPlaylist?.name}</h1>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<Button variant="outline" class="glass-effect border-0" on:click={() => editMode()}>
								{#if editModeOn}
									<Check size={18} />
								{:else}
									<Pencil size={18} />
								{/if}
							</Button>
						</div>
					</div>

					<div class="space-y-4">
						{#if editModeOn}
							<div class="space-y-2">
								<label for="playlist-description" class="text-sm font-medium">Description</label>
								<input
									id="playlist-description"
									bind:value={changedDescription}
									class="w-full rounded-md border bg-background px-3 py-2 text-base shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
									placeholder="Playlist description"
								/>
							</div>
						{:else}
							<div class="mt-2 space-y-1">
								<p class="text-base font-medium text-muted-foreground/80">
									{newPlaylist?.description}
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-medium text-foreground">Tracks</h2>
			<Button variant="outline" class="glass-effect border-0" on:click={() => (open = true)}>
				<Plus size={16} class="mr-2" />
				Add Tracks
			</Button>
		</div>

		{#if curSongs.length === 0}
			<div class="animate-fade-in flex h-64 flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/40">
					<Plus size={24} class="text-muted-foreground" />
				</div>
				<h2 class="text-xl font-medium text-foreground">No tracks added yet</h2>
				<p class="mt-2 text-muted-foreground">Click "Add Tracks" to start building your playlist</p>
			</div>
		{:else}
			<div class="glass-effect my-4 flex flex-col space-y-1 rounded-lg p-2">
				{#each curSongs as track, i}
					<div class="animate-slide-up" style="animation-delay: {i * 30}ms">
						<div
							class="group relative mb-2 flex w-full items-center rounded-xl p-3 transition-all duration-200 hover:bg-secondary/30"
						>
							<div class="flex w-full items-center gap-4">
								<div
									class="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg md:h-16 md:w-16"
								>
									{#await getImageUrl(track.image) then image}
										<Lazy height={64} keep={true}>
											{#if image}
												<img
													class="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
													src={image}
													alt={track.title}
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center bg-secondary/30">
													<Music size={24} class="text-muted-foreground/50" />
												</div>
											{/if}
										</Lazy>
									{:catch error}
										<div class="flex h-full w-full items-center justify-center bg-secondary/30">
											<Music size={24} class="text-muted-foreground/50" />
										</div>
									{/await}
								</div>
								<div class="flex min-w-0 flex-1 flex-col">
									<h1
										class="line-clamp-1 text-base font-medium text-foreground transition-colors duration-300 group-hover:text-primary"
									>
										{track.title}
									</h1>
									<div class="flex items-center">
										<h2 class="line-clamp-1 text-sm text-muted-foreground">
											{track.artist}
										</h2>
										<span class="mx-2 text-xs text-muted-foreground/40">•</span>
										<h3 class="text-xs text-muted-foreground/60">
											{formatDuration(track.duration)}
										</h3>
									</div>
								</div>
							</div>

							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
								on:click={() => {
									addedSongs = addedSongs.filter((s) => s !== track.id);
									curSongs = curSongs.filter((s) => s.id !== track.id);
								}}
							>
								<ListFilter size={16} class="text-muted-foreground" />
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<Drawer.Root bind:open>
	<Drawer.Content class="glass-effect">
		<div class="mx-auto w-full max-w-4xl">
			<Drawer.Header>
				<Drawer.Title>Add Tracks to Playlist</Drawer.Title>
				<Drawer.Description>Search and select tracks to add to your playlist</Drawer.Description>
			</Drawer.Header>
			<section data-vaul-no-drag>
				<div class="mb-4 px-4">
					<div class="relative">
						<Search
							class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							type="text"
							placeholder="Search tracks..."
							class="w-full rounded-md border bg-background px-9 py-2 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							bind:value={searchSongsQuery}
						/>
					</div>
				</div>
				<ScrollArea class="h-[60vh] w-full rounded-md border">
					{#each filteredSongs as song}
						<button
							on:click={() => toggleSongSelection(song)}
							class="flex w-full flex-row items-center rounded-sm px-4 py-3 text-left hover:bg-secondary"
						>
							<div class="flex flex-row items-center">
								<div class="mr-4 h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
									{#await getImageUrl(song.image) then image}
										<Lazy height={64} keep={true}>
											{#if image}
												<img
													class="h-16 w-16 object-cover {isToggled(song)
														? 'border-2 border-primary'
														: ''}"
													src={image}
													alt={song.title}
												/>
											{:else}
												<div
													class="flex h-16 w-16 items-center justify-center bg-secondary/30 {isToggled(
														song
													)
														? 'border-2 border-primary'
														: ''}"
												>
													<Music size={24} class="text-muted-foreground/50" />
												</div>
											{/if}
										</Lazy>
									{:catch error}
										<div class="flex h-16 w-16 items-center justify-center bg-secondary/30">
											<Music size={24} class="text-muted-foreground/50" />
										</div>
									{/await}
								</div>
								<div class="flex flex-grow flex-col items-start">
									<h1 class="text-lg font-bold leading-none text-foreground">
										{song.title}
									</h1>
									<h1 class="text-md mt-1 font-light leading-none text-muted-foreground">
										{song.artist}
									</h1>
									<h1 class="text-sm font-light leading-none text-muted-foreground">
										{song.album}
									</h1>
								</div>
								<div class="ml-4 flex items-center">
									{#if isToggled(song)}
										<Check class="h-5 w-5 text-primary" />
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</ScrollArea>
			</section>
			<Drawer.Footer>
				<div class="flex w-full items-center justify-between">
					<span class="text-sm text-muted-foreground">
						{addedSongs.length} track{addedSongs.length === 1 ? '' : 's'} selected
					</span>
					<div class="flex gap-2">
						<Drawer.Close asChild let:builder>
							<Button builders={[builder]} variant="outline">Cancel</Button>
						</Drawer.Close>
						<Button variant="default" on:click={() => submitSongs()}>Add Tracks</Button>
					</div>
				</div>
			</Drawer.Footer>
		</div>
	</Drawer.Content>
</Drawer.Root>

<AlertDialog.Root bind:open={isOpenAlert}>
	<AlertDialog.Content class="glass-effect border-0">
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this playlist?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will delete the playlist, but it will NOT remove the
				tracks it contains.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={() => deletePlaylist()}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
