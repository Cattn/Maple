<script lang="ts">
	import type { Playlist } from '$lib/types';
	import Track from '$lib/components/Track.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { playlists } from '$lib/global.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { refreshLibrary } from '$lib/global.svelte';
	import { title } from '$lib/store';

	let sortedPlaylists: Playlist[] = $state(playlists());

	function handleFiltersChange(payload: {
		sorted: Playlist[];
		sortKey: string;
		descending: boolean;
	}) {
		sortedPlaylists = payload.sorted;
	}

	function createPlaylist() {
		goto('/playlists/create');
	}

	onMount(async () => {
		title.set('Playlists');
		await refreshLibrary();
	});
</script>

<Filters
	items={playlists()}
	sortOptions={[
		{ key: 'createdAt', label: 'Created' },
		{ key: 'modifiedAt', label: 'Modified' },
		{ key: 'name', label: 'Name' }
	]}
	initialSortKey="modifiedAt"
	initialDescending={true}
	onChange={handleFiltersChange}
/>

<div
	class="mr-5 mb-10 ml-2 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 md:mx-16 md:grid-cols-3 md:gap-x-1 lg:grid-cols-4 lg:gap-x-1 xl:grid-cols-5 xl:gap-x-1"
>
	<div class="mt-4 ml-4 flex w-full flex-col md:mt-5 md:ml-10">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			onclick={createPlaylist}
			class="bg-primary-container text-primary flash-slow flex h-44 w-44 cursor-pointer items-center justify-center rounded-lg transition-all duration-300 ease-in-out select-none hover:scale-102 hover:shadow-lg active:scale-98 md:h-60 md:w-60 lg:h-64 lg:w-64"
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-16 w-16">
				<path
					fill="currentColor"
					d="M12 21q-.425 0-.712-.288T11 20v-7H4q-.425 0-.712-.288T3 12t.288-.712T4 11h7V4q0-.425.288-.712T12 3t.713.288T13 4v7h7q.425 0 .713.288T21 12t-.288.713T20 13h-7v7q0 .425-.288.713T12 21"
				/>
			</svg>
		</div>
		<div class="flex flex-col">
			<p class="song-titles mt-2">Create Playlist</p>
		</div>
	</div>
	{#each sortedPlaylists as playlist (playlist.id)}
		<div class="will-change-transform" animate:flip={{ duration: 300, easing: cubicOut }}>
			<Track {playlist} type="playlist" />
		</div>
	{/each}
</div>

<style>
	.flash-slow {
		animation: flash 2.5s ease-in-out infinite;
	}

	@keyframes flash {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	.song-titles {
		color: var(--color-secondary);
		font-size: 20px;
		font-family: 'Roboto Flex', sans-serif;
		font-weight: 800;
		font-style: normal;
		line-height: 20px;
		font-variation-settings:
			'slnt' 0,
			'wdth' 120,
			'GRAD' 77,
			'XOPQ' 96,
			'XTRA' 468,
			'YOPQ' 75,
			'YTAS' 750,
			'YTDE' -203,
			'YTFI' 728,
			'YTLC' 514,
			'YTUC' 712;
	}
</style>
