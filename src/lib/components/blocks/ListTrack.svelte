<script lang="ts">
	import { OPFS } from '$lib/opfs';
	import type { Song } from '$lib/types/song';
	import TrackWrapper from '../TrackWrapper.svelte';
	// @ts-ignore
	import Lazy from 'svelte-lazy';
	import { toast } from 'svelte-sonner';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { isSmallDevice } from '$lib/store';
	import Button from '../ui/button/button.svelte';
	import { EllipsisVertical, Heart, Play } from 'lucide-svelte';
	import { slide, fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	import type { Playlist } from '$lib/types/playlist';

	const dispatch = createEventDispatcher();

	async function getImageUrl(imagePath: string): Promise<string> {
		const response = await OPFS.get().image(imagePath);
		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer]);
		return URL.createObjectURL(blob);
	}

	async function addTrackToPlaylist(track: Song, playlist: Playlist) {
		if (track && playlist) {
			OPFS.track().addToPlaylist(track, playlist);
			toast.success(`Added ${track.title} to ${playlist.name}`);
		}
	}

	function openAlert(track: Song) {
		dispatch('delete', track);
	}

	export let track: Song;
	$: track = track;

	export let tracks: Song[] = [];
	$: tracks = tracks;

	export let playlists: Playlist[] = [];
	$: playlists = playlists;

	export let keep: boolean = true;
	$: keep = keep;

	function formatDuration(duration: number): string {
		const roundedDuration = Math.round(duration);
		const minutes = Math.floor(roundedDuration / 60);
		const seconds = roundedDuration % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	let isHovered = false;
</script>

{#if track}
	<div
		class="group relative mb-2 flex w-full items-center rounded-xl p-2 transition-all duration-200 hover:bg-secondary/30"
		on:mouseenter={() => (isHovered = true)}
		on:mouseleave={() => (isHovered = false)}
	>
		<TrackWrapper className="flex-grow" {track} {tracks}>
			<div class="flex w-full items-center gap-4">
				<div class="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg md:h-14 md:w-14">
					{#await getImageUrl(track.image) then image}
						<Lazy height={56} {keep}>
							<img
								class="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
								src={image}
								alt={track.title}
							/>
							<div
								class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
							>
								<div class="flex rounded-full bg-primary/90 p-2 text-white shadow-lg">
									<Play size={16} />
								</div>
							</div>
						</Lazy>
					{:catch error}
						<div class="h-full w-full animate-pulse rounded-lg bg-muted"></div>
					{/await}
				</div>
				<div class="flex min-w-0 flex-1 flex-col">
					<h1
						class="line-clamp-1 text-base font-medium text-foreground transition-colors duration-300 group-hover:text-primary"
					>
						{track.title}
					</h1>
					<div class="flex items-center">
						<h2 class="line-clamp-1 text-sm text-muted-foreground">
							{track.artist}
						</h2>
						{#if !$isSmallDevice}
							<span class="mx-2 text-xs text-muted-foreground/40">•</span>
							<h3 class="text-xs text-muted-foreground/60">
								{track.album}
							</h3>
						{/if}
					</div>
				</div>

				<div class="hidden items-center gap-3 md:flex">
					{#if isHovered}
						<button
							class="glass-effect flex h-8 w-8 items-center justify-center rounded-full opacity-80 transition-opacity duration-300 hover:opacity-100"
							transition:fade={{ duration: 200 }}
						>
							<Heart size={16} class="text-muted-foreground hover:text-primary" />
						</button>
					{/if}
					<div class="text-xs text-muted-foreground/70">
						{formatDuration(track.duration)}
					</div>
				</div>
			</div>
		</TrackWrapper>

		<div class="ml-2 flex items-center">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild let:builder>
					<Button
						class="h-8 w-8 bg-transparent p-0 opacity-60 transition-opacity duration-300 hover:bg-secondary/80 group-hover:opacity-100"
						builders={[builder]}
					>
						<EllipsisVertical size={16} class="text-muted-foreground" />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="glass-effect w-56">
					<DropdownMenu.Label>Options</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item on:click={() => openAlert(track)}>Delete</DropdownMenu.Item>
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger>
							<span>Add to Playlist</span>
						</DropdownMenu.SubTrigger>
						<DropdownMenu.SubContent side="left" class="glass-effect">
							{#if playlists.length > 0}
								{#each playlists as playlist}
									<DropdownMenu.Item on:click={() => addTrackToPlaylist(track, playlist)}>
										<span>{playlist.name}</span>
									</DropdownMenu.Item>
								{/each}
							{:else}
								<DropdownMenu.Item disabled>
									<span>No Playlists</span>
								</DropdownMenu.Item>
							{/if}
						</DropdownMenu.SubContent>
					</DropdownMenu.Sub>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
{/if}
