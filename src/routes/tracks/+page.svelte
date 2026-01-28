<script lang="ts">
	import type { Song } from '$lib/types';
	import Track from '$lib/components/Track.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { tracks } from '$lib/global.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { title } from '$lib/store';
	import { onMount } from 'svelte';

	let sortedTracks: Song[] = $state(tracks());

	function handleFiltersChange(payload: { sorted: Song[]; sortKey: string; descending: boolean }) {
		sortedTracks = payload.sorted;
	}

	onMount(async () => {
		title.set('Tracks');
	});
</script>

<Filters
	items={tracks()}
	sortOptions={[
		{ key: 'title', label: 'Title' },
		{ key: 'artist', label: 'Artist' },
		{ key: 'album', label: 'Album' },
		{ key: 'year', label: 'Year' },
		{ key: 'duration', label: 'Duration' }
	]}
	initialSortKey="title"
	idPrefix="tracks"
	onChange={handleFiltersChange}
/>

<div
	class="mr-8 ml-2 mb-10 md:mb-0 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 md:mx-16 md:grid-cols-3 md:gap-x-1 lg:grid-cols-4 lg:gap-x-1 xl:grid-cols-5 xl:gap-x-1"
>
	{#each sortedTracks as track (track.id)}
		<div class="will-change-transform" animate:flip={{ duration: 300, easing: cubicOut }}>
			<Track
				track={track as Song}
				queue={sortedTracks}
				queueSource={{ type: 'tracks', label: 'Tracks' }}
			/>
		</div>
	{/each}
</div>
