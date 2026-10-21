import { OPFS } from './opfs';
import type { Song, Playlist, Artist, Album } from './types';
import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import { recentlyPlayedManager } from './store';

let tracksState: Song[] = $state([]);
let playlistsState: Playlist[] = $state([]);
let artistsState: Artist[] = $state([]);
let albumsState: Album[] = $state([]);

async function initialize() {
	await OPFS.requestPersistentStorage();

	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			tracksState = await OPFS.get().tracks();
			playlistsState = await OPFS.get().playlists();
			artistsState = await OPFS.get().artists();
			albumsState = await OPFS.get().albums();

			const expected = OPFS.expectedLibrarySize();
			if (tracksState.length > 0) {
				OPFS.rememberLibrarySize(tracksState.length);
				return;
			}
			if (expected > 0 && attempt < 2) {
				console.warn(`OPFS: library empty on attempt ${attempt + 1}, retrying`);
				await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
				continue;
			}
			if (expected > 0 && tracksState.length === 0) {
				console.error(`OPFS: expected ${expected} tracks but library is empty`);
				toast.error(
					`Library data is missing (${expected} tracks). The browser may have cleared storage — please re-upload.`
				);
			}
			recentlyPlayedManager.clear();
			return;
		} catch (error) {
			console.error('Failed to initialize tracks and playlists:', error);
			if (attempt === 2) return;
			await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
		}
	}
}

export async function refreshLibrary() {
	try {
		tracksState = await OPFS.get().tracks();
		playlistsState = await OPFS.get().playlists();
		artistsState = await OPFS.get().artists();
		albumsState = await OPFS.get().albums();
		if (tracksState.length > 0) {
			OPFS.rememberLibrarySize(tracksState.length);
		} else {
			recentlyPlayedManager.clear();
		}
	} catch (error) {
		console.error('Failed to refresh library:', error);
	}
}

async function checkLibraryStorage() {
	if (document.visibilityState !== 'visible') return;
	try {
		recentlyPlayedManager.load();
		if (await OPFS.libraryExists()) return;
		tracksState = [];
		playlistsState = [];
		artistsState = [];
		albumsState = [];
		recentlyPlayedManager.clear();
		OPFS.rememberLibrarySize(0);
	} catch (error) {
		console.error('Failed to check library storage:', error);
	}
}

if (browser) {
	initialize()
		.then(checkLibraryStorage)
		.catch((error) => {
			console.error('Initialization failed:', error);
		});
	window.addEventListener('storage', checkLibraryStorage);
	window.addEventListener('focus', checkLibraryStorage);
	document.addEventListener('visibilitychange', checkLibraryStorage);
	window.setInterval(checkLibraryStorage, 5000);
}

export const tracks = () => tracksState;
export const playlists = () => playlistsState;
export const artists = () => artistsState;
export const albums = () => albumsState;
