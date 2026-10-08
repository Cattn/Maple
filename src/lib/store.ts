import { browser } from '$app/environment';
//import { Peer } from 'peerjs';
import { Socket } from 'socket.io-client';
import { derived, get, writable } from 'svelte/store';
import type { AddedFriend, PendingRequest, Song, User } from '$lib/types';
import { normalizeStats, stats, statsManager } from './stats';
export { stats, statsManager };
import { OPFS } from '$lib/opfs';

export type QueueSource = 'none' | 'album' | 'playlist' | 'artist' | 'tracks' | 'recent' | 'custom';

export const pendingRequests = writable([] as PendingRequest[]);
export const friends = writable([] as AddedFriend[]);
export const isLoggedIn = writable(false);
export type AppInstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
export const appInstallPrompt = writable<AppInstallPromptEvent | null>(null);
export const appInstalled = writable(false);
export const appUpdateReady = writable<ServiceWorkerRegistration | null>(null);
if (browser) {
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		appInstallPrompt.set(event as AppInstallPromptEvent);
	});
	window.addEventListener('appinstalled', () => {
		appInstallPrompt.set(null);
		appInstalled.set(true);
	});
}
export const friendNowPlaying = writable({} as Record<string, unknown>);
export const socket = writable(null as Socket | null);
//export const UserPeer = writable(null as Peer | null);
export const searchType = writable('tracks');
export const UserInfo = writable(null as User | null);
UserInfo.subscribe((value) => {
	if (browser) {
		if (!value) return;
		if (value === undefined) return;
		localStorage.setItem('UserInfo', JSON.stringify(value));
	}
});
export const SavedUser = writable({} as User);
export const activeSong = writable({} as Song);
export const context = writable([] as Song[]);
export type QueueSnapshot = {
	items: Song[];
	currentIndex: number;
	source: { type: QueueSource; id?: string; label?: string };
};
export const queueState = writable<QueueSnapshot>({
	items: [],
	currentIndex: -1,
	source: { type: 'none' }
});
export const loopEnabled = writable(true);
export const shuffleEnabled = writable(false);
export const originalQueue = writable<Song[]>([]);
export const recentlyPlayed = writable<Song[]>([]);
export const collapsed = writable(false);
// let currentTime = $derived($audioPlayer.audio?.currentTime ?? 0);
export const curTime = writable(0);
export const setCurTime = writable(0);
export const hideTips = writable(false);
hideTips.subscribe((value) => {
	if (value) {
		if (browser) {
			localStorage.setItem('hideTips', 'true');
		}
	}
});
export const isSmallDevice = writable(false);
function storedVolume() {
	if (!browser) return 100;
	const parsed = parseInt(localStorage.getItem('volume') ?? '100', 10);
	return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100;
}
const initialVolume = storedVolume();
const initialAudio = browser ? new Audio() : null;
if (initialAudio) {
	initialAudio.volume = initialVolume / 100;
}
export const audioPlayer = writable({
	audio: initialAudio,
	onEnded: () => {},
	playing: false,
	volume: initialVolume,
	currentTime: 0,
	changeVolume: false
});
export const recentlyPlayedManager = {
	add: (value: Song) => {
		recentlyPlayed.update((current) => {
			if (current.some((song) => song?.id === value.id)) {
				return current;
			}
			const updated = [value, ...current].slice(0, 10);
			if (browser) {
				localStorage.setItem('recentlyPlayed', JSON.stringify(updated));
			}
			return updated;
		});
	},
	load: () => {
		if (!browser) return;
		const stored = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
		recentlyPlayed.set(stored);
	},
	get: () => {
		if (!browser) return [];
		return get(recentlyPlayed);
	}
};

let endedHandler: ((this: HTMLAudioElement, ev: Event) => void) | null = null;
let durationChangeHandler: ((this: HTMLAudioElement, ev: Event) => void) | null = null;
let listenersBoundTo: HTMLAudioElement | null = null;

export function syncAudioState(audio: HTMLAudioElement) {
	if (get(audioPlayer).audio !== audio) return;
	const playing = !audio.paused && !audio.ended && !audio.error;
	audioPlayer.update((state) => ({ ...state, playing, currentTime: audio.currentTime }));
	curTime.set(audio.currentTime);
	setCurTime.set(audio.currentTime);
	if ('mediaSession' in navigator) {
		navigator.mediaSession.playbackState = audio.src ? (playing ? 'playing' : 'paused') : 'none';
	}
}

const playbackEvents = ['play', 'pause', 'ended', 'error'];
const playbackStateHandler = () => {
	if (listenersBoundTo) syncAudioState(listenersBoundTo);
};

export const currentDuration = derived(audioPlayer, ($audioPlayer) => {
	return $audioPlayer.audio?.duration ?? 0;
});

let currentTime = 0;
let lastListenTime = 0;
let lastListenSongId = '';

function bindAudioListeners(audio: HTMLAudioElement) {
	if (listenersBoundTo === audio) return;

	if (listenersBoundTo) {
		for (const event of playbackEvents) {
			listenersBoundTo.removeEventListener(event, playbackStateHandler);
		}
		if (endedHandler) {
			listenersBoundTo.removeEventListener('ended', endedHandler);
			endedHandler = null;
		}
		listenersBoundTo.ontimeupdate = null;
		if (durationChangeHandler) {
			listenersBoundTo.removeEventListener('durationchange', durationChangeHandler);
			durationChangeHandler = null;
		}
	}

	listenersBoundTo = audio;
	for (const event of playbackEvents) {
		audio.addEventListener(event, playbackStateHandler);
	}

	endedHandler = () => {
		get(audioPlayer).onEnded();
	};
	audio.addEventListener('ended', endedHandler);

	audio.ontimeupdate = () => {
		const player = get(audioPlayer);
		currentTime = player.audio?.currentTime ?? 0;
		if (player.playing) {
			curTime.set(player.audio?.currentTime ?? currentTime);
			setCurTime.set(player.audio?.currentTime ?? currentTime);
		}
		const song = get(activeSong);
		const state = get(queueState);
		if (player.playing && song?.id) {
			if (song.id !== lastListenSongId) {
				lastListenSongId = song.id;
				lastListenTime = player.audio?.currentTime ?? 0;
			} else {
				const nextTime = player.audio?.currentTime ?? 0;
				const delta = nextTime - lastListenTime;
				lastListenTime = nextTime;
				if (delta > 0 && delta <= 2.5) {
					statsManager.recordListeningSeconds(song, state.source, delta);
				}
			}
		}
	};

	durationChangeHandler = () => {
		audioPlayer.update((state) => ({ ...state }));
	};
	audio.addEventListener('durationchange', durationChangeHandler);
}

audioPlayer.subscribe((value) => {
	if (!browser || !(value.audio instanceof HTMLAudioElement)) return;

	if (value.changeVolume) {
		if (value.volume !== undefined) {
			value.audio.volume = value.volume / 100;
			localStorage.setItem('volume', value.volume.toString());
		}
		value.changeVolume = false;
		return;
	}

	bindAudioListeners(value.audio);
});

if (browser) {
	document.addEventListener('visibilitychange', () => {
		const audio = get(audioPlayer).audio;
		if (document.visibilityState === 'visible' && audio) syncAudioState(audio);
	});
}
function createTitle() {
	const { subscribe, set } = writable('');

	return {
		subscribe,
		set: (value: string) => {
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

	const storedUserInfo = localStorage.getItem('UserInfo');
	if (storedUserInfo) {
		UserInfo.set(JSON.parse(storedUserInfo));
	}

	recentlyPlayedManager.load();
}

let statsReady = false;
const loadStats = async () => {
	if (!browser) return;
	const stored = await OPFS.getStats();
	if (stored) {
		stats.set(normalizeStats(stored));
	}
	statsReady = true;
};
loadStats();

stats.subscribe((value) => {
	if (browser && statsReady) {
		OPFS.saveStats(value);
	}
});

friends.subscribe((value) => {
	statsManager.setFriendsCount(value.length);
});
