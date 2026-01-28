<script lang="ts">
	import { Card } from 'm3-svelte';
	import Track from '$lib/components/Track.svelte';
	import { onMount } from 'svelte';
	import { title, recentlyPlayed } from '$lib/store';
	import { createLibrary } from '$lib/library';

	let recent = $derived($recentlyPlayed.filter(Boolean));

	onMount(async () => {
		title.set('Home');
	});
</script>

<div class="mt-5 flex w-full justify-center">
	<div class="w-11/12 md:w-1/3">
		<Card variant="outlined">
			<div class="flex flex-col">
				<h1 class="text-center text-lg font-bold">Welcome to Maple!</h1>
				<p class="text-on-surface-variant text-center text-sm">
					Maple is a music library and organization tool. It allows you to upload your music library
					and watch it be organized into albums, artists, playlists, and more! Start by uploading
					your music library
					<a href="/" class="text-class text-primary" onclick={() => createLibrary()}>here!</a>
					(if you're on mobile you may need to upload from settings)
				</p>
			</div>
		</Card>
	</div>
</div>

<div class="mt-5 flex w-full flex-col">
	<h1 class="ml-4 text-2xl font-bold md:ml-10">Recently Played</h1>
	<div
		class="mr-8 ml-2 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3 md:mx-16 md:grid-cols-3 md:gap-x-1 lg:grid-cols-4 lg:gap-x-1 xl:grid-cols-5 xl:gap-x-1"
	>
		{#each recent as track}
			<Track {track} queue={recent} queueSource={{ type: 'recent', label: 'Recently Played' }} />
		{/each}
	</div>
</div>

<style>
	.text-class {
		text-decoration: underline !important;
	}
</style>
