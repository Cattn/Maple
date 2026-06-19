<script lang="ts">
	import { OPFS } from '$lib/opfs';
	import type { Album, Artist, Song } from '$lib/types';
	import Track from '$lib/components/Track.svelte';
	import ListTrack from '$lib/components/ListTrack.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';

	let { data }: { data: { artistId: string } } = $props();

	let artist: Artist | undefined = $state(undefined);
	let imageUrl: string | null = $state(null);
	let artistAlbums: Album[] = $state([]);
	let artistTracks: Song[] = $state([]);

	type AlbumSortKey = 'name' | 'year';
	let albumSortKey: AlbumSortKey = $state('name');
	let albumDescending = $state(false);

	type TrackSortKey = 'title' | 'album' | 'duration' | 'year';
	let trackSortKey: TrackSortKey = $state('title');
	let trackDescending = $state(false);

	let sortedAlbums: Album[] = $state([]);
	let sortedTracks: Song[] = $state([]);

	function handleAlbumFiltersChange(payload: {
		sorted: Album[];
		sortKey: string;
		descending: boolean;
	}) {
		sortedAlbums = payload.sorted;
		albumSortKey = payload.sortKey as AlbumSortKey;
		albumDescending = payload.descending;
	}

	function handleTrackFiltersChange(payload: {
		sorted: Song[];
		sortKey: string;
		descending: boolean;
	}) {
		sortedTracks = payload.sorted;
		trackSortKey = payload.sortKey as TrackSortKey;
		trackDescending = payload.descending;
	}

	$effect(() => {
		OPFS.get()
			.artist(data.artistId)
			.then(async (fetched) => {
				artist = fetched;
				if (artist?.image) {
					try {
						imageUrl = await OPFS.getImageUrl(artist.image as string);
					} catch {
						imageUrl = null;
					}
				}

				const allAlbums = await OPFS.get().albums();
				if (artist?.name) {
					artistAlbums = allAlbums.filter((a) => a.artist === artist!.name);
				} else {
					artistAlbums = [];
				}

				const allTracks = await OPFS.get().tracks();
				if (artist?.name) {
					artistTracks = allTracks.filter((t) => t.artist === artist!.name);
				} else {
					artistTracks = [];
				}
			});
	});

	onMount(async () => {
		title.set(artist?.name ?? 'Artist');
	});
</script>

<div class="mb-5 flex flex-col gap-8 px-4 pt-4 md:px-14 md:pt-14 lg:px-28">
	<div class="flex items-center gap-4">
		{#if imageUrl}
			<img src={imageUrl} alt={artist?.name} class="h-24 w-24 rounded-lg object-cover" />
		{/if}
		<div class="space-y-1">
			<h1 class="text-on-surface text-3xl font-bold">{artist?.name}</h1>
			<p class="text-on-surface-variant">
				{sortedAlbums.length} albums • {sortedTracks.length} tracks
			</p>
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<Filters
			items={artistAlbums}
			sortOptions={[
				{ key: 'name', label: 'Name' },
				{ key: 'year', label: 'Year' }
			]}
			initialSortKey="name"
			align="left"
			idPrefix="artist-albums"
			onChange={handleAlbumFiltersChange}
		/>
		<div
			class="grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 md:grid-cols-3 md:gap-x-1 lg:grid-cols-4 lg:gap-x-1 xl:grid-cols-5 xl:gap-x-1"
		>
			{#each sortedAlbums as album (album.id)}
				<div class="will-change-transform" animate:flip={{ duration: 300, easing: cubicOut }}>
					<Track {album} type="album" />
				</div>
			{/each}
		</div>
	</div>

	<div class="flex flex-col gap-4">
		<Filters
			items={artistTracks}
			sortOptions={[
				{ key: 'title', label: 'Title' },
				{ key: 'album', label: 'Album' },
				{ key: 'duration', label: 'Duration' },
				{ key: 'year', label: 'Year' }
			]}
			initialSortKey="title"
			align="left"
			idPrefix="artist-tracks"
			onChange={handleTrackFiltersChange}
		/>

		<div class="bg-surface-container rounded-xl">
			<ul class="divide-outline-variant divide-y">
				{#each sortedTracks as track, i (track.id)}
					<li animate:flip={{ duration: 300, easing: cubicOut }}>
						<ListTrack
							{track}
							index={i + 1}
							trackNo={track.trackNumber}
							playbackContext={sortedTracks}
							playbackSource={{
								type: 'artist',
								id: artist?.id,
								label: artist?.name ?? 'Artist'
							}}
						/>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
