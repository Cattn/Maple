<script lang="ts">
	import GridTrack from '$lib/components/blocks/GridTrack.svelte';
	import ListTrack from '$lib/components/blocks/ListTrack.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { OPFS } from '$lib/opfs';
	import { context, title } from '$lib/store';
	import type { Artist } from '$lib/types/artist';
	import type { Song } from '$lib/types/song';
	import { ArrowDownZA, ArrowUpAZ, Check, List, ListFilter, Pencil, Trash } from 'lucide-svelte';
	import { onMount } from 'svelte';
	//@ts-ignore
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import type { Playlist } from '$lib/types/playlist';
	import { toast } from 'svelte-sonner';

	let artistName: string;
	let artist: Artist | undefined;
	let tracks: Song[] = [];
	let playlists: Playlist[] = [];
	let listType = 'list';
	let editModeOn = false;
	let changedName = '';
	let imageFile: Blob | null = null;
	$: params = new URLSearchParams($page.url.search);
	$: {
		refresh(params.get('artist') ?? '');
	}
	onMount(async () => {
		let params = new URLSearchParams(document.location.search);
		artistName = params.get('artist') ?? '';
		artist = await OPFS.get().artist(artistName);
		playlists = await OPFS.get().playlists();
		sortTracks();
		if (artist && artist.name) {
			title.set(artist.name);
		} else {
			title.set('Unknown Artist');
		}

		changedName = artist?.name?.toString() ?? '';
	});

	async function refresh(artistName: string) {
		artist = await OPFS.get().artist(artistName);
		sortTracks();
		if (artist && artist.name) {
			title.set(artist.name);
		} else {
			title.set('Unknown Artist');
		}

		changedName = artist?.name?.toString() ?? '';
	}

	async function sortTracks() {
		if (artist && artist.tracks) {
			const newTracks: Song[] = [];
			for (const track of artist.tracks) {
				const trackData = await OPFS.get().track(track as string);
				if (trackData) {
					newTracks.push(trackData);
				}
			}
			tracks = newTracks; // trigger re-render
		}
	}

	async function getImageUrl(imagePath: string): Promise<string> {
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

	async function sortArtists(s: string) {
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
		sortArtists(sort);
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

		if (!editModeOn && artist) {
			const doImage = imageFile !== null;
			const modifiedartist: Artist = {
				id: artist.id,
				name: changedName,
				image: doImage ? imageFile : artist.image,
				tracks: artist.tracks,
				albums: artist.albums
			};
			OPFS.artist().edit(modifiedartist);
			let newartist = await OPFS.get().artist(modifiedartist.id.toString());
			artist = newartist;
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

	function deleteArtist() {
		if (artist) {
			OPFS.artist().delete(artist);
			toast.success(`Deleted ${artist.name} from library`);
			goto('/artists');
		} else {
			console.error('Artist not found');
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
				{#await getImageUrl(artist?.image) then image}
					{#if editModeOn}
						<div class="group relative">
							<img
								class="h-44 w-44 rounded-[50%] object-cover shadow-lg transition-all duration-300 group-hover:opacity-75 md:h-64 md:w-64"
								src={image}
								alt={artist?.name?.toString() ?? ''}
							/>
							<div
								class="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<label
									for="artist-image"
									class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
								>
									Change Image
								</label>
								<input
									id="artist-image"
									type="file"
									class="hidden"
									accept="image/*"
									on:change={(e) => handlePhotoChange(e)}
								/>
							</div>
						</div>
					{:else if image !== ''}
						<img
							class="h-44 w-44 rounded-[50%] object-cover shadow-lg md:h-64 md:w-64"
							src={image}
							alt={artist?.name?.toString() ?? ''}
						/>
					{:else}
						<div class="h-44 w-44 animate-pulse rounded-[50%] bg-muted md:h-64 md:w-64"></div>
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
								<label for="artist-name" class="text-sm font-medium">Artist Name</label>
								<input
									id="artist-name"
									bind:value={changedName}
									class="w-full rounded-md border bg-background px-3 py-2 text-2xl font-bold shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
									placeholder="Artist name"
								/>
							</div>
						{:else}
							<h1 class="text-3xl font-bold text-foreground">{artist?.name}</h1>
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
									<AlertDialog.Title>Delete Artist</AlertDialog.Title>
									<AlertDialog.Description>
										This action cannot be undone. This will NOT delete the artist's tracks, only the
										artist page itself.
									</AlertDialog.Description>
								</AlertDialog.Header>
								<AlertDialog.Footer>
									<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
									<AlertDialog.Action on:click={() => deleteArtist()}>Delete</AlertDialog.Action>
								</AlertDialog.Footer>
							</AlertDialog.Content>
						</AlertDialog.Root>
					</div>
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
						<DropdownMenu.RadioItem value="title" on:click={() => sortArtists('name')}>
							Name
						</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<Button class="h-9 w-9 p-0" variant="ghost" on:click={() => swapListType()}>
				<List class="h-5 w-5" />
			</Button>
		</div>
	</div>

	{#if listType !== 'list'}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each tracks as track}
				<GridTrack {track} {tracks} on:delete={(e) => openAlert(track)} />
			{/each}
		</div>
	{:else}
		<div class="space-y-2">
			{#each tracks as track}
				<ListTrack {track} {tracks} {playlists} on:delete={(e) => openAlert(track)} />
			{/each}
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
