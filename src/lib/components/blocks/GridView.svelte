<script lang="ts">
	import ContextMenu from '$lib/components/ui/context-menu/context-menu.svelte';
	import TrackWrapper from '$lib/components/TrackWrapper.svelte';
	import { OPFS } from '$lib/opfs';
	import type { Song } from '$lib/types/song';
	import type { Album } from '$lib/types/album';
	import type { Playlist } from '$lib/types/playlist';
	import type { Artist } from '$lib/types/artist';
	import { toast } from 'svelte-sonner';
	// @ts-ignore
	import Lazy from 'svelte-lazy';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	async function getImageUrl(imagePath: string): Promise<string> {
		try {
			const response = await OPFS.get().image(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer]);
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error('Error loading image:', error);
			return '';
		}
	}

	export let songs: Song[] = [];
	export let albums: Album[] = [];
	export let artists: Artist[] = [];
	export let playlists: Playlist[] = [];
	export let tracks: Song[] = [];
	export let keep: boolean = true;
	$: keep = keep;

	// Determine which array to use
	$: items = songs.length > 0 ? songs : 
              albums.length > 0 ? albums : 
              artists.length > 0 ? artists : 
              playlists;

	// Check item type to determine context menu type
	function getItemType(item: Song | Album | Artist | Playlist): string {
		if ('title' in item) return 'track';
		if ('name' in item && 'artist' in item) return 'album';
		if ('name' in item && !('artist' in item) && !('description' in item)) return 'artist';
		return 'playlist';
	}

	// Get item title or name
	function getItemName(item: Song | Album | Artist | Playlist): string {
		if ('title' in item) return item.title;
		if ('name' in item) return item.name;
		return 'Unknown';
	}

	// Get item artist if available
	function getItemArtist(item: Song | Album | Artist | Playlist): string {
		if ('artist' in item) return item.artist;
		return '';
	}

	async function addTrackToPlaylist(track: Song, playlist: Playlist) {
		if (track && playlist) {
			OPFS.track().addToPlaylist(track, playlist);
			toast.success(`Added ${track.title} to ${playlist.name}`);
		}
	}

	function openAlert(item: Song | Album | Artist | Playlist) {
		dispatch('delete', item);
	}
</script>

<div
	class="animate-fade-in my-6 grid grid-cols-2 gap-6 px-4 sm:grid-cols-2 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:grid-cols-5"
>
	{#each items as item, i (item.id)}
		<div
			class="hover-scale group relative flex flex-col items-start"
			style="animation-delay: {i * 60}ms"
		>
			{#await getImageUrl(item.image) then image}
				<ContextMenu
					type={getItemType(item)}
					on:delete={() => openAlert(item)}
					on:addTrackToPlaylist={(e) => {
						if ('title' in item) {
							addTrackToPlaylist(item, e.detail.playlist);
						}
					}}
				>
					{#if getItemType(item) === 'track'}
						<TrackWrapper className="w-full" track={item} {tracks}>
							<Lazy height={208} {keep}>
								<div class="track-backdrop h-0 w-full overflow-hidden rounded-xl pb-[100%] shadow-lg">
									{#if image}
										<img
											class="absolute left-0 top-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
											src={image}
											alt={getItemName(item)}
										/>
									{:else}
										<div class="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-secondary">
											<span class="text-3xl font-bold text-primary/50">{getItemName(item).charAt(0).toUpperCase()}</span>
										</div>
									{/if}
									<div
										class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
									></div>
								</div>
							</Lazy>
						</TrackWrapper>
					{:else}
						<a class="w-full" href={getItemType(item) === 'album' ? `/album?album=${item.id}` : 
											 getItemType(item) === 'artist' ? `/artist?artist=${item.id}` : 
											 getItemType(item) === 'playlist' ? `/playlist?playlist=${item.id}` : '#'}>
							<Lazy height={208} {keep}>
								<div class="track-backdrop h-0 w-full overflow-hidden rounded-xl pb-[100%] shadow-lg">
									{#if image}
										<img
											class="absolute left-0 top-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
											src={image}
											alt={getItemName(item)}
										/>
									{:else}
										<div class="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-secondary">
											<span class="text-3xl font-bold text-primary/50">{getItemName(item).charAt(0).toUpperCase()}</span>
										</div>
									{/if}
									<div
										class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
									></div>
								</div>
							</Lazy>
						</a>
					{/if}
				</ContextMenu>
				<div class="mt-3 flex w-full flex-col items-start space-y-1 px-1">
					<h1
						class="line-clamp-1 w-full text-base font-semibold leading-tight text-foreground transition-colors duration-300 group-hover:text-primary md:text-lg"
					>
						{getItemName(item)}
					</h1>
					{#if getItemArtist(item)}
						<h1
							class="line-clamp-1 w-full text-sm font-normal leading-tight text-muted-foreground md:text-base"
						>
							{getItemArtist(item)}
						</h1>
					{/if}
				</div>
			{:catch error}
				<div class="aspect-square w-full animate-pulse rounded-xl bg-muted"></div>
			{/await}
		</div>
	{/each}
</div>
