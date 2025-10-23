import { browser } from '$app/environment';
//import { Peer } from 'peerjs';
import { Socket } from 'socket.io-client';
import { derived, writable } from 'svelte/store';
import type { AddedFriend, PendingRequest, Song, User } from '$lib/types';

export const pendingRequests = writable([] as PendingRequest[]);
export const friends = writable([] as AddedFriend[]);
export const isLoggedIn = writable(false);
export const friendNowPlaying = writable({} as any);
export const socket = writable(null as Socket | null);
//export const UserPeer = writable(null as Peer | null);
export const searchType = writable('tracks');
export const UserInfo = writable(null as User | null);
export const SavedUser = writable({} as User);
export const activeSong = writable({} as Song);
export const context = writable([] as Song[]);
let recentlyPlayed: [Song?, Song?, Song?, Song?, Song?, Song?, Song?, Song?, Song?, Song?] = [];
export const collapsed = writable(false);
// let currentTime = $derived($audioPlayer.audio?.currentTime ?? 0);
export const curTime = writable([0] as number[]);
export const setCurTime = writable([0] as number[]);
export const hideTips = writable(false);
hideTips.subscribe((value) => {
	if (value) {
		if (browser) {
			localStorage.setItem('hideTips', 'true');
		}
	}
});
export const isSmallDevice = writable(false);
export const audioPlayer = writable({
	audio: browser ? new Audio() : null,
	onEnded: () => {},
	playing: false,
	volume: 100,
	currentTime: 0,
	changeVolume: false
});
export const recentlyPlayedManager = writable({
	add: (value: Song) => {
		if (!recentlyPlayed.some((song) => song?.id === value.id)) {
			recentlyPlayed = [value, ...recentlyPlayed].slice(0, 10) as [
				Song?,
				Song?,
				Song?,
				Song?,
				Song?, 
				Song?,
				Song?,
				Song?,
				Song?,
				Song?
			];
			localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed));
		}
	},
	get: () => {
		if (!browser) return [];
		recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
		return recentlyPlayed;
	}
});

let endedHandler: ((this: HTMLAudioElement, ev: Event) => any) | null = null;
let durationChangeHandler: ((this: HTMLAudioElement, ev: Event) => any) | null = null;

export const currentDuration = derived(audioPlayer, ($audioPlayer) => {
	return $audioPlayer.audio?.duration ?? 0;
});

let currentTime = 0;

audioPlayer.subscribe((value) => {
	if (browser) {
		if (value.audio instanceof HTMLAudioElement) {
			if (!value.changeVolume) {
				if (endedHandler) {
					value.audio.removeEventListener('ended', endedHandler);
					endedHandler = null;
				}

				if (value.onEnded) {
					endedHandler = () => {
						value.onEnded();
					};
					value.audio.addEventListener('ended', endedHandler);
				}

				value.audio.ontimeupdate = () => {
					currentTime = value.audio?.currentTime ?? 0;
					if (value.playing) {
						curTime.set([value.audio?.currentTime ?? currentTime]);
						setCurTime.set([value.audio?.currentTime ?? currentTime]);
					}
				};

				if (durationChangeHandler) {
					value.audio.removeEventListener('durationchange', durationChangeHandler);
					durationChangeHandler = null;
				}

				durationChangeHandler = () => {
					audioPlayer.update((state) => ({ ...state }));
				};
				value.audio.addEventListener('durationchange', durationChangeHandler);

				if (value.audio instanceof HTMLAudioElement && value.currentTime !== undefined) {
					value.audio.currentTime = value.currentTime;
				}
			} else {
				if (value.audio instanceof HTMLAudioElement && value.volume !== undefined) {
					value.audio.volume = value.volume / 100;
					localStorage.setItem('volume', value.volume.toString());
					value.changeVolume = false;
					return;
				} else {
					value.changeVolume = false;
					return;
				}
			}
		}
	}
});
function createTitle() {
	const { subscribe, set } = writable('');

	return {
		subscribe,
		set: (value: any) => {
			set(`${value} • Maple`);
		},
		clear: () => {
			set('Maple');
		}
	};
}

function loadPreferences() {
	return {
		load: () => {
			if (browser) {
				const storedVolume = localStorage.getItem('volume');
				const volume = parseInt(storedVolume ?? '100');
				if (storedVolume) {
					audioPlayer.update((state) => ({ ...state, volume: volume, changeVolume: true }));
				}
			}
		}
	};
}

export const loadPreferencesStore = loadPreferences();

export const title = createTitle();

if (browser) {
	const storedhideTips = localStorage.getItem('hideTips');
	if (storedhideTips && storedhideTips === 'true') {
		hideTips.set(true);
	} else {
		hideTips.set(false);
	}
}