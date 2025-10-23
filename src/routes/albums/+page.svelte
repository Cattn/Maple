<script lang="ts">
    import type { Album } from '$lib/types';
    import Track from '$lib/components/Track.svelte';
    import { albums } from '$lib/global.svelte';
    import { ConnectedButtons, Button } from 'm3-svelte';
    import { flip } from 'svelte/animate';
    import { cubicOut } from 'svelte/easing';

    type SortKey = 'name' | 'artist' | 'year';
    let sortKey: SortKey = $state('name');
    let descending = $state(false);

    let sortedAlbums: Album[] = $derived.by(() => {
        const list = [...albums()];
        list.sort((a, b) => {
            const aVal = a[sortKey] as unknown as string | number | undefined;
            const bVal = b[sortKey] as unknown as string | number | undefined;
            let cmp = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                cmp = aVal.localeCompare(bVal);
            } else {
                cmp = (Number(aVal ?? 0)) - (Number(bVal ?? 0));
            }
            return descending ? -cmp : cmp;
        });
        return list;
    });
</script>
 
<div class="flex flex-row w-full mt-5 justify-center">
    <div class="mr-2">
        <input class="hidden" id="flip-order" type="checkbox" bind:checked={descending} />
        <Button for="flip-order" square variant="filled" iconType="full">
            <svg class="transition-transform duration-300 ease-in-out" class:rotate-180={descending} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M9 13q-.425 0-.712-.288T8 12V5.825L6.125 7.7q-.275.275-.687.275T4.725 7.7q-.3-.3-.3-.712t.3-.713L8.3 2.7q.15-.15.325-.213T9 2.425t.375.062t.325.213l3.6 3.6q.3.3.287.7t-.312.7q-.3.275-.7.288t-.7-.288L10 5.825V12q0 .425-.288.713T9 13m6 8.575q-.2 0-.375-.062T14.3 21.3l-3.6-3.6q-.3-.3-.287-.7t.312-.7q.3-.275.7-.288t.7.288L14 18.175V12q0-.425.288-.712T15 11t.713.288T16 12v6.175l1.875-1.875q.275-.275.688-.275t.712.275q.3.3.3.713t-.3.712L15.7 21.3q-.15.15-.325.213t-.375.062"/></svg>
        </Button>
    </div>
    <ConnectedButtons>
        <input id="sort-name" type="radio" name="sortKey" value="name" bind:group={sortKey} />
        <Button for="sort-name" variant="tonal">
            <div class="flex flex-row">
                <p>Name</p>
            </div>
        </Button>
        <input id="sort-artist" type="radio" name="sortKey" value="artist" bind:group={sortKey} />
        <Button for="sort-artist" variant="tonal">
            <div class="flex flex-row">
                <p>Artist</p>
            </div>
        </Button>
        <input id="sort-year" type="radio" name="sortKey" value="year" bind:group={sortKey} />
        <Button for="sort-year" variant="tonal">
            <div class="flex flex-row">
                <p>Year</p>
            </div>
        </Button>
    </ConnectedButtons>
</div>

<div class="grid grid-cols-1 mx-24 gap-x-2 gap-y-2 sm:grid-cols-2 sm:gap-x-3 md:mx-16 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4 lg:gap-x-2 xl:grid-cols-5 xl:gap-x-2">
    {#each sortedAlbums as album (album.id)}
        <div class="will-change-transform" animate:flip={{ duration: 300, easing: cubicOut }}>
            <Track album={album} type="album" />
        </div>
    {/each}
</div>
