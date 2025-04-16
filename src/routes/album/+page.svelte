<script lang="ts">
	import { page } from '$app/stores';
	import GridTrack from '$lib/components/blocks/GridTrack.svelte';
	import ListTrack from '$lib/components/blocks/ListTrack.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { OPFS } from '$lib/opfs';
	import { context, title } from '$lib/store';
	import type { Album } from '$lib/types/album';
	import type { Song } from '$lib/types/song';
	import { ArrowDownZA, ArrowUpAZ, Check, List, ListFilter, Pencil, Trash } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import type { Playlist } from '$lib/types/playlist';

	let albumName: string;
	let album: Album | undefined;
	let tracks: Song[] = [];
	let playlists: Playlist[] = [];
	let disks: number = 0;
	let alldisks: Song[][] = [];
	let listType = 'grid';
	let editModeOn = false;
	let changedName = '';
	let changedArtist = '';
	let changedYear = '';
	let imageFile: Blob | null = null;
	$: params = new URLSearchParams($page.url.search);
	$: {
		refresh(params.get('album') ?? '');
	}
	onMount(async () => {
		let params = new URLSearchParams(document.location.search);
		albumName = params.get('album') ?? '';
		album = await OPFS.get().album(albumName);
		await sortTracks();
		// sort disks
		const diskMap: { [disk: number]: Song[] } = {};
		for (const track of tracks) {
			const disk = track.disk ?? 1;
			if (!diskMap[disk]) {
				diskMap[disk] = [];
			}
			diskMap[disk].push(track);
		}
		alldisks = Object.values(diskMap).map((diskTracks) =>
			diskTracks.sort((a, b) => a.trackNumber - b.trackNumber)
		);

		disks = alldisks.length;
		tracks = alldisks.flat();

		title.set(album?.name ?? 'Unknown Album');

		changedName = album?.name?.toString() ?? '';
		changedArtist = album?.artist?.toString() ?? '';
		changedYear = album?.year?.toString() ?? '';
		playlists = await OPFS.get().playlists();
	});

	async function refresh(albumName: string) {
		album = await OPFS.get().album(albumName);
		await sortTracks();
		// sort disks
		const diskMap: { [disk: number]: Song[] } = {};
		for (const track of tracks) {
			const disk = track.disk ?? 1;
			if (!diskMap[disk]) {
				diskMap[disk] = [];
			}
			diskMap[disk].push(track);
		}
		alldisks = Object.values(diskMap).map((diskTracks) =>
			diskTracks.sort((a, b) => a.trackNumber - b.trackNumber)
		);

		disks = alldisks.length;
		tracks = alldisks.flat();

		title.set(album?.name ?? 'Unknown Album');

		changedName = album?.name?.toString() ?? '';
		changedArtist = album?.artist?.toString() ?? '';
		changedYear = album?.year?.toString() ?? '';
	}

	async function sortTracks() {
		if (album && album.tracks) {
			const newTracks: Song[] = [];
			for (const track of album.tracks) {
				const trackData = await OPFS.get().track(track as string);
				if (trackData) {
					newTracks.push(trackData);
				}
			}
			newTracks.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
			tracks = newTracks; // trigger re-render
		}
	}

	async function getImageUrl(imagePath: string): Promise<string> {
		const response = await OPFS.get().image(imagePath);
		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer]);
		return URL.createObjectURL(blob);
	}

	let sort = 'track';
	let ascending = true;

	async function orderTracks(s: string) {
		sort = s;
		if (s === 'title') {
			tracks = tracks.sort((a, b) =>
				ascending ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
			);
		} else if (s === 'duration') {
			tracks = tracks.sort((a, b) =>
				ascending ? a.duration - b.duration : b.duration - a.duration
			);
		} else if (s === 'track') {
			if (alldisks.length > 1) {
				alldisks = alldisks.reverse().map((diskTracks) => diskTracks.slice().reverse());
				tracks = alldisks.flat();
			} else {
				tracks = tracks.sort((a, b) =>
					ascending
						? (a.trackNumber ?? 0) - (b.trackNumber ?? 0)
						: (b.trackNumber ?? 0) - (a.trackNumber ?? 0)
				);
			}
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
		orderTracks(sort);
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

		if (!editModeOn && album) {
			const doImage = imageFile !== null;
			const modifiedAlbum: Album = {
				id: album.id,
				name: changedName.replace(/[&<>"']/g, (match) => `&#${match.charCodeAt(0)};`),
				artist: changedArtist.replace(/[&<>"']/g, (match) => `&#${match.charCodeAt(0)};`),
				year: parseInt(changedYear.replace(/[^\d]/g, ''), 10),
				image: doImage ? imageFile : album.image,
				genre: album.genre,
				tracks: album.tracks
			};
			OPFS.album().edit(modifiedAlbum);
			let newAlbum = await OPFS.get().album(modifiedAlbum.id.toString());
			album = newAlbum;
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

	function deleteAlbum() {
		if (album) {
			OPFS.album().delete(album);
			goto('/albums');
		} else {
			console.error('Album not found');
		}
	}

	let open = false;
	let selectedSong: Song | null = null;

	function openAlert(track: Song) {
		open = true;
		selectedSong = track;
	}

	async function deleteTrack() {
		if (selectedSong) {
			OPFS.track().delete(selectedSong);
			tracks = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
			sortTracks();
		} else {
			console.error('Album not found');
		}
	}
</script>

<div class="px-12 py-8">
	<div class="mb-8 rounded-lg border bg-card p-6 shadow-sm">
		<div class="flex flex-col items-center gap-6 md:flex-row md:items-start">
			<div class="relative">
				{#await getImageUrl(album?.image) then image}
					{#if editModeOn}
						<div class="group relative">
							<img
								class="h-44 w-44 rounded-lg object-cover shadow-lg transition-all duration-300 group-hover:opacity-75 md:h-64 md:w-64"
								src={image}
								alt={album?.name?.toString() ?? ''}
							/>
							<div
								class="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<label
									for="album-image"
									class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
								>
									Change Image
								</label>
								<input
									id="album-image"
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
							alt={album?.name?.toString() ?? ''}
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
								<label for="album-name" class="text-sm font-medium">Album Name</label>
								<input
									id="album-name"
									bind:value={changedName}
									class="w-full rounded-md border bg-background px-3 py-2 text-2xl font-bold shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
									placeholder="Album name"
								/>
							</div>
						{:else}
							<h1 class="text-3xl font-bold text-foreground">{album?.name}</h1>
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
									<AlertDialog.Title>Delete Album</AlertDialog.Title>
									<AlertDialog.Description>
										This action cannot be undone. This will NOT delete the tracks within the album,
										only the album itself.
									</AlertDialog.Description>
								</AlertDialog.Header>
								<AlertDialog.Footer>
									<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
									<AlertDialog.Action on:click={() => deleteAlbum()}>Delete</AlertDialog.Action>
								</AlertDialog.Footer>
							</AlertDialog.Content>
						</AlertDialog.Root>
					</div>
				</div>

				<div class="space-y-4">
					{#if editModeOn}
						<div class="space-y-2">
							<label for="album-artist" class="text-sm font-medium">Artist</label>
							<input
								id="album-artist"
								bind:value={changedArtist}
								class="w-full rounded-md border bg-background px-3 py-2 text-base shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								placeholder="Artist name"
							/>
						</div>
						<div class="space-y-2">
							<label for="album-year" class="text-sm font-medium">Year</label>
							<input
								id="album-year"
								bind:value={changedYear}
								class="w-full rounded-md border bg-background px-3 py-2 text-base shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								placeholder="Release year"
								type="number"
							/>
						</div>
					{:else}
						<div class="mt-2 space-y-1">
							<p class="text-base font-medium text-muted-foreground/80">{album?.artist}</p>
							<p class="text-sm text-muted-foreground/70">{album?.year}</p>
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
						<DropdownMenu.RadioItem value="track" on:click={() => orderTracks('track')}>
							Track #
						</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="title" on:click={() => orderTracks('title')}>
							Title
						</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="duration" on:click={() => orderTracks('duration')}>
							Duration
						</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<Button class="h-9 w-9 p-0" variant="ghost" on:click={() => swapListType()}>
				<List class="h-5 w-5" />
			</Button>
		</div>
	</div>

	{#if listType !== 'grid'}
		<div class="space-y-8">
			{#if alldisks.length > 1 && sort === 'track'}
				{#each alldisks as disk, diskIndex}
					{#if diskIndex > 0}
						<Separator class="my-4" />
					{/if}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each disk as track}
							<GridTrack {track} {tracks} on:delete={(e) => openAlert(track)} />
						{/each}
					</div>
				{/each}
			{:else}
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each tracks as track}
						<GridTrack {track} {tracks} on:delete={(e) => openAlert(track)} />
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="space-y-2">
			{#if alldisks.length > 1 && sort === 'track'}
				{#each alldisks as disk, diskIndex}
					{#if diskIndex > 0}
						<Separator class="my-4" />
					{/if}
					<div class="space-y-2">
						{#each disk as track}
							<ListTrack {track} {tracks} {playlists} on:delete={(e) => openAlert(track)} />
						{/each}
					</div>
				{/each}
			{:else}
				<div class="space-y-2">
					{#each tracks as track}
						<ListTrack {track} {tracks} {playlists} on:delete={(e) => openAlert(track)} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger></AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Track</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will COMPLETELY delete the track, and remove it from any
				playlists, albums or artist pages.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={() => deleteTrack()}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
