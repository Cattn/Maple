<script lang="ts">
	import GridView from '$lib/components/blocks/GridView.svelte';
	import ListTrack from '$lib/components/blocks/ListTrack.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { OPFS } from '$lib/opfs';
	import { context, title } from '$lib/store';
	import type { Playlist } from '$lib/types/playlist';
	import type { Song } from '$lib/types/song';
	import { ArrowDownZA, ArrowUpAZ, Grid, List, ListFilter, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let tracks: Song[] = [];
	let playlists: Playlist[] = [];
	let searchQuery = '';
	let filteredTracks: Song[] = [];

	onMount(async () => {
		tracks = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
		playlists = await OPFS.get().playlists();
		title.set('Tracks');
		filteredTracks = [...tracks];
	});

	let sort = 'title';
	let ascending = true;
	let listType = 'grid';

	function filterTracks() {
		if (!searchQuery.trim()) {
			filteredTracks = [...tracks];
		} else {
			const query = searchQuery.toLowerCase().trim();
			filteredTracks = tracks.filter(
				(track) =>
					track.title.toLowerCase().includes(query) ||
					track.artist.toLowerCase().includes(query) ||
					track.album.toLowerCase().includes(query)
			);
		}
		sortTracks(sort);
	}

	$: searchQuery, filterTracks();

	async function sortTracks(s: string) {
		sort = s;
		if (s === 'title') {
			filteredTracks = filteredTracks.sort((a, b) =>
				ascending ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
			);
		} else if (s === 'artist') {
			filteredTracks = filteredTracks.sort((a, b) =>
				ascending ? a.artist.localeCompare(b.artist) : b.artist.localeCompare(a.artist)
			);
		} else if (s === 'album') {
			filteredTracks = filteredTracks.sort((a, b) =>
				ascending ? a.album.localeCompare(b.album) : b.album.localeCompare(a.album)
			);
		} else if (s === 'year') {
			filteredTracks = filteredTracks.sort((a, b) =>
				ascending ? a.year - b.year : b.year - a.year
			);
		} else if (s === 'duration') {
			filteredTracks = filteredTracks.sort((a, b) =>
				ascending ? a.duration - b.duration : b.duration - a.duration
			);
		}
		if ($context.length === filteredTracks.length) {
			const contextIds = new Set($context.map((song) => song.id));
			const tracksIds = new Set(filteredTracks.map((song) => song.id));
			if (
				[...contextIds].every((id) => tracksIds.has(id)) &&
				[...tracksIds].every((id) => contextIds.has(id))
			) {
				context.set(filteredTracks);
			}
		}
	}

	function swapAscending() {
		ascending = !ascending;
		sortTracks(sort);
	}

	function swapListType(type: string) {
		listType = type;
	}

	let open = false;
	let selectedSong: Song | null = null;

	function openAlert(e: {
		id?: string;
		title?: string;
		artist?: string;
		album?: string;
		year?: number;
		genre?: string | undefined;
		fileName?: string;
		duration?: number;
		image?: any;
		trackNumber?: number;
		disk?: number;
		ext?: string;
		detail?: any;
	}) {
		open = true;
		selectedSong = e.detail;
	}

	async function deleteTrack() {
		if (selectedSong) {
			OPFS.track().delete(selectedSong);
			tracks = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
			filterTracks();
			toast.success(`Deleted ${selectedSong.title} from library`);
		} else {
			console.error('Album not found');
		}
	}

	function dokeep() {
		if (tracks.length > 100) {
			return false;
		} else {
			return true;
		}
	}
</script>

<div class="animate-fade-in px-4 py-4 md:px-6">
	<header class="animate-slide-up">
		<h1 class="mb-2 text-2xl font-semibold text-foreground md:text-3xl">Your Tracks</h1>

		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div class="relative w-full md:w-72">
				<div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
					<Search size={18} />
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search tracks..."
					class="h-10 w-full rounded-lg bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
				/>
			</div>

			<div class="flex items-center gap-2">
				<Tabs.Root value={listType} onValueChange={swapListType} class="mr-2">
					<Tabs.List class="grid grid-cols-2 bg-secondary/30">
						<Tabs.Trigger
							value="grid"
							class="flex h-9 items-center justify-center data-[state=active]:shadow-none"
						>
							<Grid size={18} />
						</Tabs.Trigger>
						<Tabs.Trigger
							value="list"
							class="flex h-9 items-center justify-center data-[state=active]:shadow-none"
						>
							<List size={18} />
						</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>

				<Button
					variant="outline"
					size="sm"
					class="glass-effect border-0"
					on:click={() => swapAscending()}
				>
					{#if ascending}
						<ArrowUpAZ size={18} />
					{:else}
						<ArrowDownZA size={18} />
					{/if}
				</Button>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger asChild let:builder>
						<Button variant="outline" size="sm" class="glass-effect border-0" builders={[builder]}>
							<ListFilter size={18} />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="glass-effect w-56">
						<DropdownMenu.Label>Sort By</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.RadioGroup bind:value={sort}>
							<DropdownMenu.RadioItem value="title" on:click={() => sortTracks('title')}
								>Title</DropdownMenu.RadioItem
							>
							<DropdownMenu.RadioItem value="artist" on:click={() => sortTracks('artist')}
								>Artist</DropdownMenu.RadioItem
							>
							<DropdownMenu.RadioItem value="album" on:click={() => sortTracks('album')}
								>Album</DropdownMenu.RadioItem
							>
							<DropdownMenu.RadioItem value="year" on:click={() => sortTracks('year')}
								>Year</DropdownMenu.RadioItem
							>
							<DropdownMenu.RadioItem value="duration" on:click={() => sortTracks('duration')}
								>Duration</DropdownMenu.RadioItem
							>
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</header>

	{#if filteredTracks.length === 0}
		<div class="animate-fade-in flex h-64 flex-col items-center justify-center text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/40">
				<Search size={24} class="text-muted-foreground" />
			</div>
			<h2 class="text-xl font-medium text-foreground">No tracks found</h2>
			<p class="mt-2 text-muted-foreground">Try adjusting your search or filters</p>
		</div>
	{:else if listType === 'grid'}
		<GridView
			keep={dokeep()}
			tracks={filteredTracks}
			songs={filteredTracks}
			on:delete={openAlert}
		/>
	{:else}
		<div class="my-4 flex flex-col space-y-1">
			{#each filteredTracks as track, i}
				<div class="animate-slide-up" style="animation-delay: {i * 30}ms">
					<ListTrack
						keep={dokeep()}
						{track}
						tracks={filteredTracks}
						{playlists}
						on:delete={() => openAlert(track)}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger></AlertDialog.Trigger>
	<AlertDialog.Content class="glass-effect border-0">
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this track?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete the track, and remove it from any
				playlists, albums or artist pages.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={() => deleteTrack()}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
