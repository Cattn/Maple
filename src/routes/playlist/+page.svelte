<script lang="ts">
	import { page } from '$app/stores';
	import GridTrack from '$lib/components/blocks/GridTrack.svelte';
	import ListTrack from '$lib/components/blocks/ListTrack.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { OPFS } from '$lib/opfs';
	import { context, isSmallDevice, title } from '$lib/store';
	import type { Playlist } from '$lib/types/playlist';
	import type { Song } from '$lib/types/song';
	import {
		ArrowDownZA,
		ArrowUpAZ,
		Check,
		List,
		ListFilter,
		Pencil,
		Plus,
		Search,
		Trash
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	//@ts-ignore
	import Lazy from 'svelte-lazy';
	import { toast } from 'svelte-sonner';

	let playlistName: string;
	let playlist: Playlist | undefined;
	let tracks: Song[] = [];
	let playlists: Playlist[] = [];
	let songs: Song[] = [];
	let addedSongs: String[] = [];
	let listType = 'list';
	let editModeOn = false;
	let changedName = '';
	let changedDescription = '';
	let imageFile: Blob | null = null;
	let searchQuery = '';
	let filteredSongs: Song[] = [];
	$: params = new URLSearchParams($page.url.search);
	$: {
		refresh(params.get('playlist') ?? '');
	}
	onMount(async () => {
		songs = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
		filteredSongs = songs;
		let params = new URLSearchParams(document.location.search);
		playlistName = params.get('playlist') ?? '';
		playlist = await OPFS.get().playlist(playlistName);
		sortTracks();
		if (playlist && playlist.name) {
			title.set(playlist.name);
		} else {
			title.set('Unknown playlist');
		}

		changedName = playlist?.name?.toString() ?? '';
		changedDescription = playlist?.description?.toString() ?? '';
		playlists = await OPFS.get().playlists();
	});

	async function refresh(playlistName: string) {
		playlist = undefined;
		playlist = await OPFS.get().playlist(playlistName);
		sortTracks();
		if (playlist && playlist.name) {
			title.set(playlist.name);
		} else {
			title.set('Unknown playlist');
		}

		changedName = playlist?.name?.toString() ?? '';
	}

	async function sortTracks() {
		if (playlist && playlist.tracks) {
			const newTracks: Song[] = [];
			for (const track of playlist.tracks) {
				const trackData = await OPFS.get().track(track as string);
				if (trackData) {
					newTracks.push(trackData);
				}
			}
			tracks = newTracks; // trigger re-render
		}
	}

	async function getImageUrl(imagePath: string | Blob): Promise<string> {
		if (imagePath instanceof Blob) {
			return URL.createObjectURL(imagePath);
		}

		const response = await OPFS.get().image(imagePath);
		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer]);
		if (blob && blob.size === 0) {
			return '';
		}
		return URL.createObjectURL(blob);
	}

	let sort = 'title';
	let ascending = true;

	async function sortplaylists(s: string) {
		sort = s;
		if (s === 'title') {
			tracks = tracks.sort((a, b) =>
				ascending ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
			);
		}
		if ($context.length === tracks.length) {
			const contextIds = new Set($context.map((song) => song.id));
			const tracksIds = new Set(tracks.map((song) => song.id));
			if (
				[...contextIds].every((id) => tracksIds.has(id)) &&
				[...tracksIds].every((id) => contextIds.has(id))
			) {
				context.set(tracks);
			}
		}
	}

	function swapAscending() {
		ascending = !ascending;
		sortplaylists(sort);
	}

	function formatDuration(duration: number): string {
		const roundedDuration = Math.round(duration);
		const minutes = Math.floor(roundedDuration / 60);
		const seconds = roundedDuration % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function swapListType() {
		if (listType === 'list') {
			listType = 'grid';
		} else {
			listType = 'list';
		}
	}

	async function editMode() {
		editModeOn = !editModeOn;

		if (!editModeOn && playlist) {
			const doImage = imageFile !== null;
			const modifiedplaylist: Playlist = {
				id: playlist.id,
				name: changedName,
				description: changedDescription,
				image: doImage ? imageFile : playlist.image,
				tracks: playlist.tracks
			};

			await OPFS.playlist().edit(modifiedplaylist);
			await refresh(playlist.id);
			imageFile = null;
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
				if (playlist) {
					playlist = {
						...playlist,
						image: imageBlob
					};
				}
			};
		}
	}

	function deletePlaylist() {
		if (playlist) {
			OPFS.playlist().delete(playlist);
			toast.success(`Deleted ${playlist.name}`);
			goto('/playlists');
		} else {
			console.error('Playlist not found');
		}
	}

	async function deleteTrack() {
		if (selectedSong) {
			OPFS.track().delete(selectedSong);
			tracks = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
			sortTracks();
		} else {
			console.error('Track not found');
		}
	}

	let open = false;
	let selectedSong: Song | null = null;

	async function addTrackToPlaylist(track: Song, playlist: Playlist) {
		if (track && playlist) {
			OPFS.track().addToPlaylist(track, playlist);
			toast.success(`Added ${track.title} to ${playlist.name}`);
			refresh(playlistName);
		}
	}

	function openAlert(track: Song) {
		open = true;
		selectedSong = track;
	}

	async function editRemove(track: Song, i: number) {
		if (playlist) {
			const trackIndex = playlist?.tracks?.findIndex((t: String) => t === track.id);
			if (playlist && trackIndex !== undefined) {
				OPFS.playlist().remove(playlist, trackIndex);
				toast.success(`Removed ${track.title} from ${playlist.name}`);
				playlist?.tracks?.splice(i, 1);
				tracks = tracks.filter((t) => t.id !== track.id);
			}
		}
	}

	let openAdd = false;

	function toggleSongSelection(song: Song) {
		const index = addedSongs.findIndex((s) => s === song.id);
		if (index === -1) {
			addedSongs = [...addedSongs, song.id];
			tracks = [...tracks, song];
		} else {
			addedSongs = addedSongs.filter((s) => s !== song.id);
			tracks = tracks.filter((s) => s.id !== song.id);
		}
	}

	$: isToggled = (song: Song) => addedSongs.includes(song.id);

	function submitSongs() {
		if (playlist) {
			let allTracks = [...(playlist.tracks ?? []), ...addedSongs];
			playlist.tracks = allTracks;
			openAdd = false;
		}
	}

	async function editModeOff() {
		editModeOn = false;
		openAdd = false;
		//remove addedSongs from tracks
		tracks = tracks.filter((t) => !addedSongs.includes(t.id));
		//remove addedSongs from playlist
		if (playlist) {
			playlist.tracks = playlist.tracks?.filter((t) => !addedSongs.includes(t));
		}
		addedSongs = [];
		refresh(playlistName);
	}

	function filterSongs() {
		filteredSongs = songs.filter(
			(song) =>
				song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
				song.album.toLowerCase().includes(searchQuery.toLowerCase())
		);
	}
</script>

<div class=" mx-auto px-4 py-8">
	<div class="mb-8 rounded-lg border bg-card p-6 shadow-sm">
		<div class="flex flex-col items-center gap-6 md:flex-row md:items-start">
			<div class="relative">
				{#await getImageUrl(playlist?.image) then image}
					{#if editModeOn}
						<div class="group relative">
							<img
								class="h-44 w-44 rounded-lg object-cover shadow-lg transition-all duration-300 group-hover:opacity-75 md:h-64 md:w-64"
								src={image}
								alt={playlist?.name?.toString() ?? ''}
							/>
							<div
								class="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<label
									for="playlist-image"
									class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
								>
									Change Image
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
					{:else}
						<img
							class="h-44 w-44 rounded-lg object-cover shadow-lg md:h-64 md:w-64"
							src={image}
							alt={playlist?.name?.toString() ?? ''}
						/>
					{/if}
				{:catch error}
					<div class="h-44 w-44 animate-pulse rounded-lg bg-muted md:h-64 md:w-64"></div>
				{/await}
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
									class="w-full rounded-md border bg-background px-3 py-2 text-2xl font-bold shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
									placeholder="Playlist name"
								/>
							</div>
						{:else}
							<h1 class="text-3xl font-bold text-foreground">{playlist?.name}</h1>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<Button class="h-9 w-9 p-0" variant="ghost" on:click={() => editMode()}>
							{#if editModeOn}
								<Check class="h-5 w-5" />
							{:else}
								<Pencil class="h-5 w-5" />
							{/if}
						</Button>
						<AlertDialog.Root>
							<AlertDialog.Trigger asChild>
								<Button class="h-9 w-9 p-0" variant="ghost">
									<Trash class="h-5 w-5 text-destructive" />
								</Button>
							</AlertDialog.Trigger>
							<AlertDialog.Content>
								<AlertDialog.Header>
									<AlertDialog.Title>Delete Playlist</AlertDialog.Title>
									<AlertDialog.Description>
										This action cannot be undone. This will NOT delete the tracks within the
										playlist, only the playlist itself.
									</AlertDialog.Description>
								</AlertDialog.Header>
								<AlertDialog.Footer>
									<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
									<AlertDialog.Action on:click={() => deletePlaylist()}>Delete</AlertDialog.Action>
								</AlertDialog.Footer>
							</AlertDialog.Content>
						</AlertDialog.Root>
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
							<p class="text-base font-medium text-muted-foreground/80">{playlist?.description}</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Button class="h-9 w-9 p-0" variant="ghost" on:click={() => swapAscending()}>
				{#if ascending}
					<ArrowUpAZ class="h-5 w-5" />
				{:else}
					<ArrowDownZA class="h-5 w-5" />
				{/if}
			</Button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild let:builder>
					<Button class="h-9 w-9 p-0" variant="ghost" builders={[builder]}>
						<ListFilter class="h-5 w-5" />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="w-56">
					<DropdownMenu.Label>Sort By</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.RadioGroup bind:value={sort}>
						<DropdownMenu.RadioItem value="title" on:click={() => sortplaylists('title')}>
							Title
						</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<Button class="h-9 w-9 p-0" variant="ghost" on:click={() => swapListType()}>
				<List class="h-5 w-5" />
			</Button>
		</div>
	</div>

	{#if !editModeOn}
		{#if listType !== 'list'}
			<div
				class="my-5 ml-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-2 sm:gap-x-6 md:ml-6 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4 lg:gap-x-10 xl:grid-cols-5 xl:gap-x-12"
			>
				{#each tracks as track}
					<GridTrack {track} {tracks} on:delete={(e) => openAlert(track)} />
				{/each}
			</div>
		{:else}
			<div class="mx-4 mb-5 mt-2 flex flex-col">
				{#each tracks as track}
					<ListTrack {track} {tracks} {playlists} on:delete={(e) => openAlert(track)} />
				{/each}
			</div>
		{/if}
	{:else}
		<div class="mx-4 mb-5 mt-2 flex flex-col">
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<!-- svelte-ignore a11y-missing-attribute -->
			<a
				on:click={() => (openAdd = true)}
				class="flex flex-row items-center rounded-sm px-2 py-2 hover:bg-secondary"
			>
				<div class="flex flex-row items-center rounded-sm py-2 hover:bg-secondary md:px-2">
					<div class="mr-4 flex h-12 w-12 items-center justify-center bg-gray-500 md:h-24 md:w-24">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-white md:h-12 md:w-12"
						>
							<Plus size={20} color="black" />
						</div>
					</div>
					<div class="flex flex-grow flex-col items-start">
						<h1 class="mb-1 text-lg font-bold leading-none text-foreground">Add Track</h1>
					</div>
				</div>
			</a>
			{#each tracks as track, i}
				<div class="flex w-full flex-row items-center rounded-sm px-2 py-2">
					<div class="h-12 w-12 flex-shrink-0 md:h-24 md:w-24">
						{#await getImageUrl(track.image) then image}
							<Lazy height={208} keep={true}>
								<img class="rounded-md" src={image} alt={track.title} />
							</Lazy>
						{:catch error}
							<div class="mr-4 h-24 w-24 bg-gray-500"></div>
						{/await}
					</div>
					<div class="ml-4 flex flex-col">
						<h1 class="text-lg font-bold leading-none text-foreground">{track.title}</h1>
						<h1 class="text-base font-light leading-none text-slate-400">{track.artist}</h1>
					</div>
					<div class="ml-4 flex flex-grow flex-row items-center justify-end text-right">
						{#if !$isSmallDevice}
							<div class="flex flex-col">
								<h1 class="text-base font-light leading-none text-slate-400">
									{formatDuration(track.duration)}
								</h1>
								<h1 class="text-base font-light leading-none text-slate-400">{track.album}</h1>
								<h1 class="text-base font-light leading-none text-slate-400">{track.year}</h1>
							</div>
						{/if}
						<div class="ml-2 flex items-center">
							<Button
								class="my-1 ml-3 h-10 w-10 px-1"
								variant="destructive"
								on:click={() => editRemove(track, i)}
							>
								<Trash size={20} color="white" />
							</Button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<Drawer.Root bind:open={openAdd}>
	<Drawer.Content>
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
							bind:value={searchQuery}
							on:input={() => filterSongs()}
						/>
					</div>
				</div>
				<ScrollArea class="h-[60vh] w-full rounded-md border">
					{#each filteredSongs as song}
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<!-- svelte-ignore a11y-missing-attribute -->
						<a
							on:click={() => toggleSongSelection(song)}
							class="flex flex-row items-center rounded-sm px-4 py-3 hover:bg-secondary"
						>
							<div class="flex flex-row items-center">
								<div class="mr-4 flex h-16 w-16 items-center justify-center bg-gray-500">
									{#await getImageUrl(song.image) then image}
										{#if isToggled(song)}
											<Lazy height={208} keep={true}>
												<img
													class="h-16 w-16 border-2 border-green-400 object-cover"
													src={image}
													alt={song.title}
												/>
											</Lazy>
										{:else}
											<Lazy height={208} keep={true}>
												<img class="h-16 w-16 object-cover" src={image} alt={song.title} />
											</Lazy>
										{/if}
									{:catch error}
										<div class="h-16 w-16 bg-gray-500"></div>
									{/await}
								</div>
								<div class="flex flex-grow flex-col items-start">
									<h1 class="text-lg font-bold leading-none text-foreground">
										{song.title}
									</h1>
									<h1 class="text-md mt-1 font-light leading-none text-slate-400">
										{song.artist}
									</h1>
									<h1 class="text-sm font-light leading-none text-slate-400">
										{song.album}
									</h1>
								</div>
								<div class="ml-4 flex items-center">
									{#if isToggled(song)}
										<Check class="h-5 w-5 text-green-500" />
									{/if}
								</div>
							</div>
						</a>
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
						<Button on:click={() => submitSongs()}>Add Tracks</Button>
					</div>
				</div>
			</Drawer.Footer>
		</div>
	</Drawer.Content>
</Drawer.Root>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger></AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will COMPLETELY delete the track, and remove it from any
				playlists, albums or artist pages.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={() => deleteTrack()}>Continue</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
