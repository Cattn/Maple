<script lang="ts">
    import { OPFS } from '$lib/opfs';
    import type { Album, Song } from '$lib/types';
    import { Button, ConnectedButtons } from 'm3-svelte';
    import { flip } from 'svelte/animate';
    import { cubicOut } from 'svelte/easing';
    import ListTrack from '$lib/components/ListTrack.svelte';

    let { data }: { data: { albumId: string } } = $props();

    let album: Album | undefined = $state(undefined);
    let tracks: Song[] = $state([]);
    let imageUrl: string | null = $state(null);

    type SortKey = 'trackNumber' | 'title' | 'duration';
    let sortKey: SortKey = $state('trackNumber');
    let descending = $state(false);

    let sortedTracks: Song[] = $derived.by(() => {
        const items = [...tracks];
        const disk = (t: Song) => (t.disk && t.disk > 0) ? t.disk : 1;

        items.sort((a, b) => {
            if (sortKey === 'trackNumber') {
                const diskOrder = disk(a) - disk(b);
                const trackOrder = a.trackNumber - b.trackNumber;
                const order = diskOrder || trackOrder;
                return descending ? -order : order;
            }

            if (sortKey === 'title') {
                const order = a.title.localeCompare(b.title);
                return descending ? -order : order;
            }

            const order = (a.duration ?? 0) - (b.duration ?? 0);
            return descending ? -order : order;
        });

        return items;
    });

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
            const disk = (t.disk && t.disk > 0) ? t.disk : 1;
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
                    const order = (a.trackNumber - b.trackNumber) || a.title.localeCompare(b.title);
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
                const order = (a.trackNumber - b.trackNumber) || a.title.localeCompare(b.title);
                return descending ? -order : order;
            })
        }));
        return descending ? groupsRaw.slice().reverse() : groupsRaw;
    });

    let groupByDisk: boolean = $derived.by(() => sortKey === 'trackNumber' && ((diskCount > 1) || (fallbackGroups.length > 1)));
    let groups: { key: string; disk?: number; tracks: Song[] }[] = $derived.by(() => (diskCount > 1 ? metaGroups : fallbackGroups));

    let perDiscIndexById: Map<string, number> = $derived.by(() => {
        const map = new Map<string, number>();
        if (!groupByDisk) return map;
        for (const g of groups) {
            g.tracks.forEach((t, j) => map.set(t.id, j + 1));
        }
        return map;
    });

    type RenderItem = { kind: 'header'; key: string; disk: number; first: boolean } | { kind: 'track'; track: Song };
    let renderItems: RenderItem[] = $derived.by(() => {
        if (groupByDisk) {
            const items: RenderItem[] = [];
            groups.forEach((g, i) => {
                const label = (g.disk != null) ? g.disk : (i + 1);
                items.push({ kind: 'header', key: g.key, disk: label, first: i === 0 });
                g.tracks.forEach((t) => items.push({ kind: 'track', track: t }));
            });
            return items;
        }
        return sortedTracks.map((t) => ({ kind: 'track', track: t }));
    });

    $effect(() => {
        OPFS.get().album(data.albumId).then(async (fetchedAlbum) => {
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
                loaded.sort((a, b) => (a.disk - b.disk) || (a.trackNumber - b.trackNumber) || a.title.localeCompare(b.title));
                tracks = loaded;
            } else {
                tracks = [];
            }
        });
    });
</script>

<div class="flex flex-col md:flex-row gap-8 pt-10 md:pt-14 pl-6 md:pl-14 lg:pl-28 pr-5 md:pr-20">
    <div class="md:w-1/2 lg:w-2/5">
        {#if imageUrl}
            <img src={imageUrl} alt={album?.name} class="w-full max-w-sm rounded-lg shadow-md object-cover aspect-square" />
        {:else}
            <div class="w-full max-w-sm rounded-lg bg-surface-container aspect-square"></div>
        {/if}

        <div class="mt-4 space-y-1">
            <h1 class="text-2xl font-bold text-on-surface">{album?.name}</h1>
            <p class="text-on-surface-variant">{album?.artist}</p>
            <p class="text-on-surface-variant">{album?.year}</p>
        </div>

        <div class="mt-4 flex gap-3">
            <Button variant="filled">Play</Button>
            <Button variant="tonal">Shuffle</Button>
        </div>
    </div>

    <div class="md:flex-1">
        <div class="flex flex-row w-full mb-3 justify-start">
            <div class="mr-2">
                <input class="hidden" id="flip-order" type="checkbox" bind:checked={descending} />
                <Button for="flip-order" square variant="filled" iconType="full">
                    <svg class="transition-transform duration-300 ease-in-out" class:rotate-180={descending} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9 13q-.425 0-.712-.288T8 12V5.825L6.125 7.7q-.275.275-.687.275T4.725 7.7q-.3-.3-.3-.712t.3-.713L8.3 2.7q.15-.15.325-.213T9 2.425t.375.062t.325.213l3.6 3.6q.3.3.287.7t-.312.7q-.3.275-.7.288t-.7-.288L10 5.825V12q0 .425-.288.713T9 13m6 8.575q-.2 0-.375-.062T14.3 21.3l-3.6-3.6q-.3-.3-.287-.7t.312-.7q.3-.275.7-.288t.7.288L14 18.175V12q0-.425.288-.712T15 11t.713.288T16 12v6.175l1.875-1.875q.275-.275.688-.275t.712.275q.3.3.3.713t-.3.712L15.7 21.3q-.15.15-.325.213t-.375.062"/></svg>
                </Button>
            </div>
            <ConnectedButtons>
                <input id="sort-track" type="radio" name="sortKey" value="trackNumber" bind:group={sortKey} />
                <Button for="sort-track" variant="tonal">
                    <div class="flex flex-row"><p>Track #</p></div>
                </Button>

                <input id="sort-title" type="radio" name="sortKey" value="title" bind:group={sortKey} />
                <Button for="sort-title" variant="tonal">
                    <div class="flex flex-row"><p>Title</p></div>
                </Button>

                <input id="sort-duration" type="radio" name="sortKey" value="duration" bind:group={sortKey} />
                <Button for="sort-duration" variant="tonal">
                    <div class="flex flex-row"><p>Duration</p></div>
                </Button>
            </ConnectedButtons>
        </div>
        <div class="rounded-xl bg-surface-container">
            <ul class="divide-y divide-outline-variant">
                {#each renderItems as item, k (item.kind === 'track' ? item.track.id : `disc-${item.key}`)}
                    <li animate:flip={{ duration: 300, easing: cubicOut }}>
                        {#if item.kind === 'header'}
                            {#if !item.first}
                                <hr class="border-outline-variant">
                            {/if}
                            <div class="px-4 py-2 text-on-surface-variant text-sm select-none">Disc {item.disk}</div>
                        {:else}
                            <ListTrack
                                track={item.track}
                                index={(groupByDisk ? (perDiscIndexById.get(item.track.id) ?? 0) : (globalIndexById.get(item.track.id) ?? 0))}
                                trackNo={item.track.trackNumber}
                            />
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>
  