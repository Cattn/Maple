<script lang="ts">
	import type { Album } from '$lib/types';
	import Track from '$lib/components/Track.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { albums } from '$lib/global.svelte';
	import { visibleFlip } from '$lib/animate';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';

	let sortedAlbums: Album[] = $state([]);

	function handleFiltersChange(payload: { sorted: Album[]; sortKey: string; descending: boolean }) {
		sortedAlbums = payload.sorted;
	}

	onMount(async () => {
		title.set('Albums');
	});
</script>

<Filters
	items={albums()}
	sortOptions={[
		{ key: 'name', label: 'Name' },
		{ key: 'artist', label: 'Artist' },
		{ key: 'year', label: 'Year' }
	]}
	initialSortKey="name"
	onChange={handleFiltersChange}
/>

<div
	class="mr-8 ml-2 mb-10 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 md:mx-8 md:mb-0 md:grid-cols-3 md:gap-x-4 lg:mx-16 lg:grid-cols-4 lg:gap-x-6 xl:grid-cols-5"
>
	{#each sortedAlbums as album (album.id)}
		<div class="min-w-0" animate:visibleFlip={{ duration: 300, easing: cubicOut }}>
			<Track album={album as Album} type="album" />
		</div>
	{/each}
</div>
