<script lang="ts">
    import { OPFS } from '$lib/opfs';
    import type { Album, Artist, Song } from '$lib/types';
    import Track from '$lib/components/Track.svelte';
    import ListTrack from '$lib/components/ListTrack.svelte';
    import { ConnectedButtons, Button } from 'm3-svelte';
    import { flip } from 'svelte/animate';
    import { cubicOut } from 'svelte/easing';

    let { data }: { data: { artistId: string } } = $props();

    let artist: Artist | undefined = $state(undefined);
    let imageUrl: string | null = $state(null);
    let artistAlbums: Album[] = $state([]);
    let artistTracks: Song[] = $state([]);

    type AlbumSortKey = 'name' | 'year';
    let albumSortKey: AlbumSortKey = $state('name');
    let albumDescending = $state(false);

    type TrackSortKey = 'title' | 'album' | 'duration' | 'year';
    let trackSortKey: TrackSortKey = $state('title');
    let trackDescending = $state(false);

    let sortedAlbums: Album[] = $derived.by(() => {
        const list = [...artistAlbums];
        list.sort((a, b) => {
            const aVal = a[albumSortKey] as unknown as string | number | undefined;
            const bVal = b[albumSortKey] as unknown as string | number | undefined;
            let cmp = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                cmp = aVal.localeCompare(bVal);
            } else {
                cmp = (Number(aVal ?? 0)) - (Number(bVal ?? 0));
            }
            return albumDescending ? -cmp : cmp;
        });
        return list;
    });

    let sortedTracks: Song[] = $derived.by(() => {
        const list = [...artistTracks];
        list.sort((a, b) => {
            if (trackSortKey === 'title') {
                const cmp = a.title.localeCompare(b.title);
                return trackDescending ? -cmp : cmp;
            }
            if (trackSortKey === 'album') {
                const cmp = a.album.localeCompare(b.album);
                return trackDescending ? -cmp : cmp;
            }
            if (trackSortKey === 'duration') {
                const cmp = (a.duration ?? 0) - (b.duration ?? 0);
                return trackDescending ? -cmp : cmp;
            }
            const cmp = (a.year ?? 0) - (b.year ?? 0);
            return trackDescending ? -cmp : cmp;
        });
        return list;
    });

    $effect(() => {
        OPFS.get().artist(data.artistId).then(async (fetched) => {
            artist = fetched;
            if (artist?.image) {
                try {
                    imageUrl = await OPFS.getImageUrl(artist.image as string);
                } catch {
                    imageUrl = null;
                }
            }

            const allAlbums = await OPFS.get().albums();
            if (artist?.name) {
                artistAlbums = allAlbums.filter((a) => a.artist === artist!.name);
            } else {
                artistAlbums = [];
            }

            const allTracks = await OPFS.get().tracks();
            if (artist?.name) {
                artistTracks = allTracks.filter((t) => t.artist === artist!.name);
            } else {
                artistTracks = [];
            }
        });
    });
</script>

<div class="flex flex-col gap-8 pt-10 md:pt-14 px-6 md:px-14 lg:px-28 mb-5">
    <div class="flex items-center gap-4">
        {#if imageUrl}
            <img src={imageUrl} alt={artist?.name} class="w-24 h-24 rounded-lg object-cover" />
        {/if}
        <div class="space-y-1">
            <h1 class="text-3xl font-bold text-on-surface">{artist?.name}</h1>
            <p class="text-on-surface-variant">{sortedAlbums.length} albums • {sortedTracks.length} tracks</p>
        </div>
    </div>

    <div class="flex flex-col gap-4">
        <div class="flex flex-row w-full justify-start items-center gap-3">
            <div>
                <input class="hidden" id="flip-albums-order" type="checkbox" bind:checked={albumDescending} />
                <Button for="flip-albums-order" square variant="filled" iconType="full">
                    <svg class="transition-transform duration-300 ease-in-out" class:rotate-180={albumDescending} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9 13q-.425 0-.712-.288T8 12V5.825L6.125 7.7q-.275.275-.687.275T4.725 7.7q-.3-.3-.3-.712t.3-.713L8.3 2.7q.15-.15.325-.213T9 2.425t.375.062t.325.213l3.6 3.6q.3.3.287.7t-.312.7q-.3.275-.7.288t-.7-.288L10 5.825V12q0 .425-.288.713T9 13m6 8.575q-.2 0-.375-.062T14.3 21.3l-3.6-3.6q-.3-.3-.287-.7t.312-.7q.3-.275.7-.288t.7.288L14 18.175V12q0-.425.288-.712T15 11t.713.288T16 12v6.175l1.875-1.875q.275-.275.688-.275t.712.275q.3.3.3.713t-.3.712L15.7 21.3q-.15.15-.325.213t-.375.062"/></svg>
                </Button>
            </div>
            <ConnectedButtons>
                <input id="sort-album-name" type="radio" name="albumSortKey" value="name" bind:group={albumSortKey} />
                <Button for="sort-album-name" variant="tonal"><div class="flex flex-row"><p>Name</p></div></Button>
                <input id="sort-album-year" type="radio" name="albumSortKey" value="year" bind:group={albumSortKey} />
                <Button for="sort-album-year" variant="tonal"><div class="flex flex-row"><p>Year</p></div></Button>
            </ConnectedButtons>
        </div>
        <div class="grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-2 sm:gap-x-3 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4 lg:gap-x-2 xl:grid-cols-5 xl:gap-x-2">
            {#each sortedAlbums as album (album.id)}
                <div class="will-change-transform" animate:flip={{ duration: 300, easing: cubicOut }}>
                    <Track album={album} type="album" />
                </div>
            {/each}
        </div>
    </div>

    <div class="flex flex-col gap-4">
        <div class="flex flex-row w-full justify-start items-center gap-3">
            <div>
                <input class="hidden" id="flip-tracks-order" type="checkbox" bind:checked={trackDescending} />
                <Button for="flip-tracks-order" square variant="filled" iconType="full">
                    <svg class="transition-transform duration-300 ease-in-out" class:rotate-180={trackDescending} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9 13q-.425 0-.712-.288T8 12V5.825L6.125 7.7q-.275.275-.687.275T4.725 7.7q-.3-.3-.3-.712t.3-.713L8.3 2.7q.15-.15.325-.213T9 2.425t.375.062t.325.213l3.6 3.6q.3.3.287.7t-.312.7q-.3.275-.7.288t-.7-.288L10 5.825V12q0 .425-.288.713T9 13m6 8.575q-.2 0-.375-.062T14.3 21.3l-3.6-3.6q-.3-.3-.287-.7t.312-.7q.3-.275.7-.288t.7.288L14 18.175V12q0-.425.288-.712T15 11t.713.288T16 12v6.175l1.875-1.875q.275-.275.688-.275t.712.275q.3.3.3.713t-.3.712L15.7 21.3q-.15.15-.325.213t-.375.062"/></svg>
                </Button>
            </div>
            <ConnectedButtons>
                <input id="sort-track-title" type="radio" name="trackSortKey" value="title" bind:group={trackSortKey} />
                <Button for="sort-track-title" variant="tonal"><div class="flex flex-row"><p>Title</p></div></Button>
                <input id="sort-track-album" type="radio" name="trackSortKey" value="album" bind:group={trackSortKey} />
                <Button for="sort-track-album" variant="tonal"><div class="flex flex-row"><p>Album</p></div></Button>
                <input id="sort-track-duration" type="radio" name="trackSortKey" value="duration" bind:group={trackSortKey} />
                <Button for="sort-track-duration" variant="tonal"><div class="flex flex-row"><p>Duration</p></div></Button>
                <input id="sort-track-year" type="radio" name="trackSortKey" value="year" bind:group={trackSortKey} />
                <Button for="sort-track-year" variant="tonal"><div class="flex flex-row"><p>Year</p></div></Button>
            </ConnectedButtons>
        </div>

        <div class="rounded-xl bg-surface-container">
            <ul class="divide-y divide-outline-variant">
                {#each sortedTracks as track, i (track.id)}
                    <li animate:flip={{ duration: 300, easing: cubicOut }}>
                        <ListTrack track={track} index={i + 1} trackNo={track.trackNumber} />
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>