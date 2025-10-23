import { OPFS } from "./opfs";
import type { Song, Playlist, Artist, Album } from "./types";
import { browser } from "$app/environment";


let tracksState: Song[] = $state([]);
let playlistsState: Playlist[] = $state([]);
let artistsState: Artist[] = $state([]);
let albumsState: Album[] = $state([]);

async function initialize() {
    try {
        tracksState = await OPFS.get().tracks();
        playlistsState = await OPFS.get().playlists();
        artistsState = await OPFS.get().artists();
        albumsState = await OPFS.get().albums();
    } catch (error) {
        console.error('Failed to initialize tracks and playlists:', error);
    }
}

export async function refreshLibrary() {
    try {
        tracksState = await OPFS.get().tracks();
        playlistsState = await OPFS.get().playlists();
        artistsState = await OPFS.get().artists();
        albumsState = await OPFS.get().albums();
    } catch (error) {
        console.error('Failed to refresh library:', error);
    }
}

if (browser) {
    initialize().catch(error => {
        console.error('Initialization failed:', error);
    });
}

export const tracks = () => tracksState;
export const playlists = () => playlistsState;
export const artists = () => artistsState;
export const albums = () => albumsState;