<script lang="ts">
	import { OPFS } from '$lib/opfs';
	import type { Album, Song } from '$lib/types';
	import { Button } from 'm3-svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import ListTrack from '$lib/components/ListTrack.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';

	let { data }: { data: { albumId: string } } = $props();

	let album: Album | undefined = $state(undefined);
	let tracks: Song[] = $state([]);
	let imageUrl: string | null = $state(null);

	type SortKey = 'trackNumber' | 'title' | 'duration';
	let sortKey: SortKey = $state('trackNumber');
	let descending = $state(false);

	let sortedTracks: Song[] = $state([]);

	function handleFiltersChange(payload: { sorted: Song[]; sortKey: string; descending: boolean }) {
		sortedTracks = payload.sorted;
		sortKey = payload.sortKey as SortKey;
		descending = payload.descending;
	}

	let globalIndexById: Map<string, number> = $derived.by(() => {
		const map = new Map<string, number>();
		sortedTracks.forEach((t, i) => map.set(t.id, i + 1));
		return map;
	});

	let diskCount: number = $derived.by(() => {
		const s = new Set<number>();
		for (const t of tracks) {
			if (t.disk && t.disk > 0) s.add(t.disk);
		}
		return s.size;
	});

	let metaGroups: { key: string; disk: number; tracks: Song[] }[] = $derived.by(() => {
		if (!(diskCount > 1 && sortKey === 'trackNumber')) return [];
		const groups = new Map<number, Song[]>();
		for (const t of sortedTracks) {
			const disk = t.disk && t.disk > 0 ? t.disk : 1;
			const arr = groups.get(disk) ?? [];
			arr.push(t);
			groups.set(disk, arr);
		}
		return Array.from(groups.entries())
			.sort((a, b) => (descending ? b[0] - a[0] : a[0] - b[0]))
			.map(([disk, list]) => ({
				key: `meta-${disk}`,
				disk,
				tracks: list.slice().sort((a, b) => {
					const order = a.trackNumber - b.trackNumber || a.title.localeCompare(b.title);
					return descending ? -order : order;
				})
			}));
	});

	let fallbackGroups: { key: string; disk: number; tracks: Song[] }[] = $derived.by(() => {
		if (!(diskCount < 2 && sortKey === 'trackNumber')) return [];
		const byNo = new Map<number, Song[]>();
		const others: Song[] = [];
		for (const t of tracks) {
			const n = Number(t.trackNumber ?? 0);
			if (n > 0) {
				const arr = byNo.get(n) ?? [];
				arr.push(t);
				byNo.set(n, arr);
			} else {
				others.push(t);
			}
		}
		let maxDup = 0;
		for (const arr of byNo.values()) maxDup = Math.max(maxDup, arr.length);
		if (maxDup <= 1) return [];
		const buckets: Song[][] = Array.from({ length: maxDup }, () => []);
		const trackNos = Array.from(byNo.keys()).sort((a, b) => a - b);
		for (const no of trackNos) {
			const list = byNo.get(no) ?? [];
			list.sort((a, b) => a.title.localeCompare(b.title));
			for (let i = 0; i < list.length; i++) {
				const idx = i < buckets.length ? i : buckets.length - 1;
				buckets[idx].push(list[i]);
			}
		}
		if (others.length) buckets[0].push(...others);
		const groupsRaw = buckets.map((g, i) => ({
			key: `fb-${g[0]?.id ?? Math.random().toString(36).slice(2)}`,
			disk: i + 1,
			tracks: g.slice().sort((a, b) => {
				const order = a.trackNumber - b.trackNumber || a.title.localeCompare(b.title);
				return descending ? -order : order;
			})
		}));
		return descending ? groupsRaw.slice().reverse() : groupsRaw;
	});

	let groupByDisk: boolean = $derived.by(
		() => sortKey === 'trackNumber' && (diskCount > 1 || fallbackGroups.length > 1)
	);
	let groups: { key: string; disk?: number; tracks: Song[] }[] = $derived.by(() =>
		diskCount > 1 ? metaGroups : fallbackGroups
	);

	let perDiscIndexById: Map<string, number> = $derived.by(() => {
		const map = new Map<string, number>();
		if (!groupByDisk) return map;
		for (const g of groups) {
			g.tracks.forEach((t, j) => map.set(t.id, j + 1));
		}
		return map;
	});

	type RenderItem =
		| { kind: 'header'; key: string; disk: number; first: boolean }
		| { kind: 'track'; track: Song };
	let renderItems: RenderItem[] = $derived.by(() => {
		if (groupByDisk) {
			const items: RenderItem[] = [];
			groups.forEach((g, i) => {
				const label = g.disk != null ? g.disk : i + 1;
				items.push({ kind: 'header', key: g.key, disk: label, first: i === 0 });
				g.tracks.forEach((t) => items.push({ kind: 'track', track: t }));
			});
			return items;
		}
		return sortedTracks.map((t) => ({ kind: 'track', track: t }));
	});

	let playbackOrder: Song[] = $derived.by(() => {
		if (groupByDisk) {
			return renderItems
				.filter((r) => r.kind === 'track')
				.map((r) => (r as { kind: 'track'; track: Song }).track);
		}
		if (sortKey === 'trackNumber') {
			return tracks
				.slice()
				.sort(
					(a, b) =>
						a.disk - b.disk ||
						a.trackNumber - b.trackNumber ||
						a.title.localeCompare(b.title) ||
						a.id.localeCompare(b.id)
				);
		}
		return sortedTracks;
	});

	$effect(() => {
		OPFS.get()
			.album(data.albumId)
			.then(async (fetchedAlbum) => {
				album = fetchedAlbum;
				if (album?.image) {
					try {
						imageUrl = await OPFS.getImageUrl(album.image as string);
					} catch {
						imageUrl = null;
					}
				}

				if (album?.tracks && album.tracks.length) {
					const loaded: Song[] = [];
					for (const id of album.tracks as string[]) {
						const t = await OPFS.get().track(id as string);
						if (t) loaded.push(t);
					}
					loaded.sort(
						(a, b) =>
							a.disk - b.disk || a.trackNumber - b.trackNumber || a.title.localeCompare(b.title)
					);
					tracks = loaded;
				} else {
					tracks = [];
				}
			});
	});

	onMount(async () => {
		title.set(album?.name ?? 'Album');
	});
</script>

<div class="flex flex-col gap-8 pt-4 pr-3 pl-3 md:flex-row md:pt-14 md:pr-20 md:pl-14 lg:pl-28 mb-5 md:mb-0">
	<div class="w-full md:w-1/2 lg:w-2/5">
		{#if imageUrl}
			<img
				src={imageUrl}
				alt={album?.name}
				class="mx-auto aspect-square w-full max-w-sm rounded-lg object-cover shadow-md md:mx-0"
			/>
		{:else}
			<div
				class="bg-surface-container mx-auto aspect-square w-full max-w-sm rounded-lg md:mx-0"
			></div>
		{/if}

		<div class="mt-4 space-y-1 text-center md:text-left">
			<h1 class="text-on-surface text-2xl font-bold">{album?.name}</h1>
			<p class="text-on-surface-variant">{album?.artist}</p>
			<p class="text-on-surface-variant">{album?.year}</p>
		</div>

		<div class="mt-4 flex justify-center gap-3 md:justify-start">
			<Button variant="filled">Play</Button>
			<Button variant="tonal">Shuffle</Button>
		</div>
	</div>

	<div class="md:flex-1">
		<Filters
			items={tracks}
			sortOptions={[
				{ key: 'trackNumber', label: 'Track #' },
				{ key: 'title', label: 'Title' },
				{ key: 'duration', label: 'Duration' }
			]}
			initialSortKey="trackNumber"
			align="left"
			idPrefix="album-tracks"
			onChange={handleFiltersChange}
		/>
		<div class="bg-surface-container mt-2 rounded-xl">
			<ul class="divide-outline-variant divide-y">
				{#each renderItems as item, k (item.kind === 'track' ? item.track.id : `disc-${item.key}`)}
					<li animate:flip={{ duration: 300, easing: cubicOut }}>
						{#if item.kind === 'header'}
							{#if !item.first}
								<hr class="border-outline-variant" />
							{/if}
							<div class="text-on-surface-variant px-4 py-2 text-sm select-none">
								Disc {item.disk}
							</div>
						{:else}
							<ListTrack
								track={item.track}
								index={groupByDisk
									? (perDiscIndexById.get(item.track.id) ?? 0)
									: (globalIndexById.get(item.track.id) ?? 0)}
								trackNo={item.track.trackNumber}
								playbackContext={playbackOrder}
								playbackSource={{
									type: 'album',
									id: album?.id,
									label: album?.name ?? 'Album'
								}}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
