<script lang="ts">
    import { Button, Card } from 'm3-svelte';
    import Track from '$lib/components/Track.svelte';
    import { tracks } from '$lib/global.svelte';
    import type { Song } from '$lib/types';

    let sortedTracks: Song[] = $derived.by(() => [...tracks()].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 5));
</script>

<div class="flex w-full mt-5 justify-center">
    <div class="w-1/3">
        <Card variant="outlined">
            <div class="flex flex-col">
                <h1 class="text-lg font-bold text-center">Welcome to Maple!</h1>
                <p class="text-sm text-on-surface-variant text-center">
                    Maple is a music library and organization tool. It allows you to upload your music library and watch it be organized into albums, artists, playlists, and more! Start by uploading your music library 
                    <a href="/upload" class="text-class text-primary">here!</a>
                </p> 
            </div>
        </Card>
    </div>
</div>

<div class="flex flex-col w-full mt-5">
    <h1 class="text-2xl font-bold ml-10">Recently Played</h1>
    <div class="grid grid-cols-1 mx-24 gap-x-2 gap-y-2 sm:grid-cols-2 sm:gap-x-3 md:mx-16 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4 lg:gap-x-2 xl:grid-cols-5 xl:gap-x-2">
        {#each sortedTracks as track}
            <Track track={track} />
        {/each}
    </div>
</div>

<div class="flex flex-col w-full mt-10 ml-10">
    <h1 class="text-2xl font-bold">Friend Activity</h1>
    <div class="flex flex-row w-full mt-5">
       
    </div>
</div>


<style>
    .text-class {
        text-decoration: underline !important;
    }
</style>