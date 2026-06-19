<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Playlist, Song } from '$lib/types';
	import { OPFS } from '$lib/opfs';
	import { refreshLibrary, tracks } from '$lib/global.svelte';
	import { title, shuffleEnabled } from '$lib/store';
	import { startPlayback } from '$lib/player';
	import { Button } from 'm3-svelte';
	import ListTrack from '$lib/components/ListTrack.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';

	let { data }: { data: { playlistId: string } } = $props();

	let playlist = $state<Playlist | null>(null);
	let editModeOn = $state(false);
	let changedName = $state('');
	let changedDescription = $state('');
	let imageFile = $state<Blob | null>(null);

	let allTracks = $state<Song[]>([]);
	let searchQuery = $state('');
	let filteredTracks = $state<Song[]>([]);
	let selectedToAdd = $state<string[]>([]);
	let dragIndex = $state<number | null>(null);
	let canDrag = $state(true);
	let dropIndex = $state<number | null>(null);
	let openMenuFor = $state<string | null>(null);
	let sortKey = $state('playlistIndex');
	let descending = $state(false);
	let sortedPlaylistTracks = $state<(Song & { playlistIndex: number })[]>([]);

	async function loadPlaylist() {
		playlist = (await OPFS.get().playlist(data.playlistId)) ?? null;
		if (playlist) {
			if (!playlist.tracks) playlist.tracks = [];
			changedName = playlist.name;
			changedDescription = playlist.description;
			title.set(playlist.name);
		}
	}

	function handlePhotoChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			imageFile = file;
		}
	}

	function filterTracks() {
		const q = searchQuery.trim().toLowerCase();
		const existing = new Set((playlist?.tracks ?? []) as string[]);
		const base = allTracks.filter((t) => !existing.has(t.id));
		if (!q) {
			filteredTracks = base;
			return;
		}
		filteredTracks = base.filter(
			(song) =>
				song.title.toLowerCase().includes(q) ||
				song.artist.toLowerCase().includes(q) ||
				song.album.toLowerCase().includes(q)
		);
	}

	function toggleAdd(song: Song) {
		if (selectedToAdd.includes(song.id)) {
			selectedToAdd = selectedToAdd.filter((id) => id !== song.id);
			return;
		}
		selectedToAdd = [...selectedToAdd, song.id];
	}

	function isAddSelected(song: Song) {
		return selectedToAdd.includes(song.id);
	}

	function resolvePlaylistTracks(): Song[] {
		const ids = (playlist?.tracks ?? []) as string[];
		const trackById = new Map(tracks().map((t) => [t.id, t]));
		return ids.map((id) => trackById.get(id)).filter(Boolean) as Song[];
	}

	let playlistTracksWithIndex = $derived.by(() => {
		const ids = (playlist?.tracks ?? []) as string[];
		const trackById = new Map(tracks().map((t) => [t.id, t]));
		return ids
			.map((id, idx) => {
				const track = trackById.get(id);
				return track ? { ...track, playlistIndex: idx + 1 } : null;
			})
			.filter(Boolean) as (Song & { playlistIndex: number })[];
	});

	let displayedTracks = $derived.by(() =>
		sortedPlaylistTracks.length ? sortedPlaylistTracks : playlistTracksWithIndex
	);
	let canReorder = $derived.by(() => canDrag && sortKey === 'playlistIndex' && !descending);

	function handleFiltersChange(payload: {
		sorted: (Song & { playlistIndex: number })[];
		sortKey: string;
		descending: boolean;
	}) {
		sortedPlaylistTracks = payload.sorted;
		sortKey = payload.sortKey;
		descending = payload.descending;
	}

	async function moveTrack(fromIndex: number, toIndex: number) {
		if (!playlist) return;
		if (fromIndex === toIndex) return;
		const next = [...(playlist.tracks ?? [])];
		if (!next[fromIndex]) return;
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		const updated: Playlist = { ...playlist, tracks: next };
		await OPFS.playlist().edit(updated);
		await refreshLibrary();
		await loadPlaylist();
	}

	async function saveDetails() {
		if (!playlist) return;
		const updated: Playlist = {
			...playlist,
			name: changedName.trim() || playlist.name,
			description: changedDescription.trim(),
			image: imageFile ?? playlist.image,
			tracks: playlist.tracks ?? []
		};
		await OPFS.playlist().edit(updated);
		await refreshLibrary();
		await loadPlaylist();
		editModeOn = false;
		imageFile = null;
		filterTracks();
	}

	async function deletePlaylist() {
		if (!playlist) return;
		await OPFS.playlist().delete(playlist);
		await refreshLibrary();
		goto('/playlists');
	}

	async function addSelectedTracks() {
		if (!playlist) return;
		const next = Array.from(new Set([...(playlist.tracks ?? []), ...selectedToAdd]));
		const updated: Playlist = { ...playlist, tracks: next };
		await OPFS.playlist().edit(updated);
		await refreshLibrary();
		selectedToAdd = [];
		await loadPlaylist();
		filterTracks();
	}

	async function removeTrackAt(index: number) {
		if (!playlist) return;
		await OPFS.playlist().remove(playlist, index);
		await refreshLibrary();
		await loadPlaylist();
		filterTracks();
	}

	function playPlaylist() {
		const resolved = resolvePlaylistTracks();
		if (!resolved.length) return;
		startPlayback(resolved, resolved[0], {
			type: 'playlist',
			id: playlist?.id,
			label: playlist?.name
		});
	}

	function shufflePlaylist() {
		const resolved = resolvePlaylistTracks();
		if (!resolved.length) return;
		shuffleEnabled.set(true);
		const randomIndex = Math.floor(Math.random() * resolved.length);
		startPlayback(resolved, resolved[randomIndex], {
			type: 'playlist',
			id: playlist?.id,
			label: playlist?.name
		});
	}

	onMount(async () => {
		await refreshLibrary();
		allTracks = [...tracks()].sort((a, b) => a.title.localeCompare(b.title));
		await loadPlaylist();
		filterTracks();
		if (typeof window !== 'undefined') {
			canDrag = !window.matchMedia('(pointer: coarse)').matches;
		}
	});
</script>

<div class="flex flex-col gap-8 pt-4 pr-3 pl-3 md:flex-row md:pt-14 md:pr-20 md:pl-14 lg:pl-28">
	<div class="w-full md:w-1/2 lg:w-2/5">
		{#if playlist?.image}
			{#await OPFS.getImageUrl(playlist.image as string) then imageUrl}
				<div class="aspect-square max-w-sm w-full">
					<img
						src={imageUrl}
						alt={playlist?.name}
						class="w-full h-full rounded-lg object-cover shadow-md"
					/>
				</div>
			{:catch}
				<div class="bg-surface-container aspect-square max-w-sm w-full rounded-lg"></div>
			{/await}
		{:else}
			<div class="bg-surface-container aspect-square max-w-sm w-full rounded-lg"></div>
		{/if}
		{#if editModeOn}
			<div class="mt-4 space-y-2">
				<label class="text-on-surface text-sm font-medium" for="playlist-photo">Change image</label>
				<input id="playlist-photo" type="file" accept="image/*" onchange={handlePhotoChange} />
			</div>
		{/if}

		<div class="mt-4 space-y-1">
			{#if editModeOn}
				<input
					class="border-outline bg-surface text-on-surface w-full rounded-lg border px-3 py-2 text-xl font-bold"
					bind:value={changedName}
				/>
			{:else}
				<h1 class="text-on-surface text-2xl font-bold">{playlist?.name}</h1>
			{/if}
			{#if editModeOn}
				<input
					class="border-outline bg-surface text-on-surface w-full rounded-lg border px-3 py-2"
					bind:value={changedDescription}
				/>
			{:else}
				<p class="text-on-surface-variant">{playlist?.description}</p>
			{/if}
			<p class="text-on-surface-variant">{resolvePlaylistTracks().length} tracks</p>
		</div>

		<div class="mt-4 flex gap-1">
			{#if editModeOn}
				<Button square variant="filled" onclick={saveDetails}>Save</Button>
			{:else}
				<Button variant="filled" square onclick={() => (editModeOn = true)}>Edit</Button>
			{/if}
			<Button square variant="tonal" onclick={playPlaylist}>Play</Button>
			<Button square variant="tonal" onclick={shufflePlaylist}>Shuffle</Button>
		</div>
	</div>

	<div class="space-y-6 md:flex-1">
		<div class="flex flex-col gap-6">
			<div class="space-y-3">
				<h2 class="text-on-surface text-lg font-semibold">Tracks</h2>
				<Filters
					items={playlistTracksWithIndex}
					sortOptions={[
						{ key: 'playlistIndex', label: 'Track #' },
						{ key: 'title', label: 'Title' },
						{ key: 'artist', label: 'Artist' },
						{ key: 'album', label: 'Album' },
						{ key: 'year', label: 'Year' },
						{ key: 'duration', label: 'Duration' }
					]}
					initialSortKey="playlistIndex"
					align="left"
					idPrefix="playlist-tracks"
					onChange={handleFiltersChange}
				/>
				<div class="bg-surface-container rounded-xl">
					<ul class="divide-outline-variant divide-y">
						{#each displayedTracks as t (t.id)}
							<li animate:flip={{ duration: 300, easing: cubicOut }}>
								<ListTrack
									track={t}
									index={t.playlistIndex}
									trackNo={t.trackNumber}
									showThumbnail={true}
									showDropIndicator={dropIndex === t.playlistIndex}
									onRemove={() => removeTrackAt(t.playlistIndex - 1)}
									draggable={canReorder}
									playbackContext={displayedTracks}
									playbackSource={{
										type: 'playlist',
										id: playlist?.id,
										label: playlist?.name ?? 'Playlist'
									}}
									onDragStart={(e) => {
										if (!canReorder) return;
										dragIndex = t.playlistIndex - 1;
										dropIndex = t.playlistIndex;
										e.dataTransfer?.setData('text/plain', String(t.playlistIndex - 1));
										e.dataTransfer?.setDragImage(e.currentTarget as Element, 16, 16);
									}}
									onDragOver={(e) => {
										if (!canReorder) return;
										e.preventDefault();
										e.dataTransfer && (e.dataTransfer.dropEffect = 'move');
										dropIndex = t.playlistIndex;
									}}
									onDrop={async (e) => {
										if (!canReorder) return;
										e.preventDefault();
										const fromIndex = dragIndex ?? Number(e.dataTransfer?.getData('text/plain'));
										const targetIndex = t.playlistIndex - 1;
										dragIndex = null;
										dropIndex = null;
										if (Number.isFinite(fromIndex)) {
											const adjustedTarget =
												fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
											await moveTrack(fromIndex, Math.max(0, adjustedTarget));
										}
									}}
									onDragEnd={() => {
										dragIndex = null;
										dropIndex = null;
									}}
								/>
							</li>
						{/each}
					</ul>
				</div>
			</div>

			<div class="space-y-3">
				<h2 class="text-on-surface text-lg font-semibold">Add tracks</h2>
				<input
					class="border-outline bg-surface text-on-surface w-full rounded-lg border px-3 py-2"
					bind:value={searchQuery}
					oninput={filterTracks}
					placeholder="Search"
				/>
				<div class="text-on-surface-variant flex items-center justify-between text-sm">
					<span>{selectedToAdd.length} selected</span>
					<button
						class="bg-primary text-on-primary rounded-lg px-4 py-2"
						onclick={addSelectedTracks}
					>
						Add Selected
					</button>
				</div>
				<div class="bg-surface-container rounded-xl">
					<ul class="divide-outline-variant max-h-[60vh] divide-y overflow-auto pr-1">
						{#each filteredTracks as song (song.id)}
							<li>
								<button
									class="hover:bg-surface-container-high/50 w-full px-4 py-3 text-left"
									onclick={() => toggleAdd(song)}
								>
									<div class="flex items-center justify-between gap-4">
										<div class="flex min-w-0 items-center gap-3">
											{#if song.image}
												{#await OPFS.getImageUrl(song.image as string) then imageUrl}
													<img
														src={imageUrl}
														alt="{song.title} - {song.artist}"
														class="h-12 w-12 rounded-md object-cover"
													/>
												{:catch}
													<div class="bg-surface-container-high h-12 w-12 rounded-md"></div>
												{/await}
											{:else}
												<div class="bg-surface-container-high h-12 w-12 rounded-md"></div>
											{/if}
											<div class="min-w-0">
												<div class="text-on-surface truncate font-semibold">{song.title}</div>
												<div class="text-on-surface-variant truncate text-sm">
													{song.artist} • {song.album}
												</div>
											</div>
										</div>
										<div class="flex items-center gap-3">
											<span
												class="border-outline-variant bg-surface-container-high text-on-surface-variant inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium"
											>
												{song.trackNumber}
											</span>
											{#if isAddSelected(song)}
												<div class="text-primary text-sm font-medium">Selected</div>
											{/if}
										</div>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
