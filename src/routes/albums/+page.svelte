<script lang="ts">
	import type { Album } from '$lib/types';
	import Track from '$lib/components/Track.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { albums } from '$lib/global.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';

	let sortedAlbums: Album[] = $state(albums());

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
	class="mr-8 ml-2 mb-10 md:mb-0 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 md:mx-16 md:grid-cols-3 md:gap-x-1 lg:grid-cols-4 lg:gap-x-1 xl:grid-cols-5 xl:gap-x-1"
>
	{#each sortedAlbums as album (album.id)}
		<div class="will-change-transform" animate:flip={{ duration: 300, easing: cubicOut }}>
			<Track album={album as Album} type="album" />
		</div>
	{/each}
</div>
