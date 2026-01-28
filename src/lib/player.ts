import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { OPFS } from '$lib/opfs';
import type { Song } from '$lib/types';
import {
	activeSong,
	audioPlayer,
	context,
	curTime,
	queueState,
	recentlyPlayedManager,
	SavedUser,
	setCurTime,
	socket,
	loopEnabled,
	shuffleEnabled,
	originalQueue
} from '$lib/store';
import { statsManager } from '$lib/stats';
import type { QueueSnapshot } from '$lib/store';
import UserSettings from '$lib/preferences/usersettings';
import { UserManager } from './api/UserManager';
import { SERVER } from '$lib/api/server';

let mediaSessionInitialized = false;

function initMediaSession() {
	if (!browser || mediaSessionInitialized || !('mediaSession' in navigator)) return;
	mediaSessionInitialized = true;

	navigator.mediaSession.setActionHandler('play', () => {
		const state = get(audioPlayer);
		if (state.audio instanceof HTMLAudioElement && !state.playing) {
			togglePlay();
		}
	});

	navigator.mediaSession.setActionHandler('pause', () => {
		const state = get(audioPlayer);
		if (state.audio instanceof HTMLAudioElement && state.playing) {
			togglePlay();
		}
	});

	navigator.mediaSession.setActionHandler('previoustrack', () => {
		previous();
	});

	navigator.mediaSession.setActionHandler('nexttrack', () => {
		next();
	});

	navigator.mediaSession.setActionHandler('seekbackward', (details) => {
		const state = get(audioPlayer);
		if (state.audio instanceof HTMLAudioElement) {
			const skipTime = details.seekOffset || 10;
			seekTo(Math.max(state.audio.currentTime - skipTime, 0));
		}
	});

	navigator.mediaSession.setActionHandler('seekforward', (details) => {
		const state = get(audioPlayer);
		if (state.audio instanceof HTMLAudioElement) {
			const skipTime = details.seekOffset || 10;
			seekTo(Math.min(state.audio.currentTime + skipTime, state.audio.duration || 0));
		}
	});

	navigator.mediaSession.setActionHandler('seekto', (details) => {
		if (details.seekTime !== undefined) {
			seekTo(details.seekTime);
		}
	});

	navigator.mediaSession.setActionHandler('stop', () => {
		const state = get(audioPlayer);
		if (state.audio instanceof HTMLAudioElement) {
			state.audio.pause();
			state.audio.currentTime = 0;
			audioPlayer.update((value) => ({ ...value, playing: false, currentTime: 0 }));
		}
	});
}

function updateMediaSessionMetadata(song: Song, artworkUrl?: string) {
	if (!browser || !('mediaSession' in navigator)) return;
	initMediaSession();

	const artwork: MediaImage[] = artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : [];

	navigator.mediaSession.metadata = new MediaMetadata({
		title: song.title || 'Unknown Title',
		artist: song.artist || 'Unknown Artist',
		album: song.album || 'Unknown Album',
		artwork
	});
}

function updateMediaSessionPlaybackState(playing: boolean) {
	if (!browser || !('mediaSession' in navigator)) return;
	navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

function updateMediaSessionPositionState(audio: HTMLAudioElement) {
	if (!browser || !('mediaSession' in navigator) || !audio.duration || !isFinite(audio.duration)) return;
	try {
		navigator.mediaSession.setPositionState({
			duration: audio.duration,
			playbackRate: audio.playbackRate,
			position: audio.currentTime
		});
	} catch {

	}
}

type QueueSourceState = QueueSnapshot['source'];

function updateQueue(items: Song[], index: number, source?: QueueSourceState) {
	queueState.set({
		items,
		currentIndex: index,
		source: source ?? { type: 'custom', id: undefined, label: undefined }
	});
	context.set(items);
}

async function getImageFile(imagePath: string): Promise<File> {
	const response = await OPFS.get().image(imagePath);
	const arrayBuffer = await response.arrayBuffer();
	return new File([arrayBuffer], imagePath, { type: 'image/jpeg' });
}

async function uploadAlbumArt(song: Song): Promise<boolean> {
	const isLoggedIn = await UserManager.isLoggedIn();
	if (!isLoggedIn) return false;

	if (!song.image || typeof song.image !== 'string') return false;

	try {
		const image = await getImageFile(song.image);
		const imageBuffer = await image.arrayBuffer();
		const imageFile = new File([imageBuffer], 'album.jpg', { type: 'image/jpeg' });
		await UserManager.setAlbumArt(imageFile);
		return true;
	} catch (error) {
		console.error('Error uploading album art:', error);
		return false;
	}
}

async function sendWebhook(song: Song) {
	if (!UserSettings.webhook.enabled || !UserSettings.webhook.url) return;

	const isLoggedIn = await UserManager.isLoggedIn();
	if (!isLoggedIn) return;

	if (!song.image || typeof song.image !== 'string') return;

	try {
		const image = await getImageFile(song.image);
		const user = get(SavedUser);
		const formData = new FormData();
		formData.append('file', image, 'album.jpg');
		formData.append(
			'payload_json',
			JSON.stringify({
				embeds: [
					{
						title: 'Now Playing',
						description: `**${song.title}** by ${song.artist}`,
						color: 0x8f4a4c,
						fields: [
							{
								name: 'Album',
								value: song.album
							},
							{
								name: 'Year',
								value: song.year ? song.year.toString() : 'N/A'
							},
							{
								name: 'Track Number',
								value: song.trackNumber ? song.trackNumber.toString() : 'N/A'
							}
						],
						image: {
							url: 'attachment://album.jpg'
						}
					}
				],
				username: user?.name || 'User',
				avatar_url: `${SERVER}/public/get/pfp/${user?.id}`
			})
		);

		await fetch(UserSettings.webhook.url, {
			method: 'POST',
			body: formData
		});
	} catch (error) {
		console.error('Error sending webhook:', error);
	}
}

async function emitNowPlaying(song: Song) {
	const s = get(socket);
	const user = get(SavedUser);
	if (!s || !user?.id) return;
	const formatted = new Date().toISOString().slice(0, 19).replace('T', ' ');
	const payload = {
		title: song.title,
		artist: song.artist,
		album: song.album,
		discord: UserSettings.discord.enabled,
		id: user.id,
		timePlayed: formatted,
		source: 'Web'
	};
	s.emit('nowPlaying', { nowPlaying: payload });

	const artworkUploaded = await uploadAlbumArt(song);
	const artworkUrl = artworkUploaded ? `${SERVER}/public/get/albumArt/${user.id}/${crypto.randomUUID()}` : undefined;
	updateMediaSessionMetadata(song, artworkUrl);

	await sendWebhook(song);
}

async function playAtIndex(index: number) {
	const state = get(queueState);
	if (!state.items.length) return;
	const length = state.items.length;
	const normalized = ((index % length) + length) % length;
	const song = state.items[normalized];
	updateQueue(state.items, normalized, state.source);
	activeSong.set(song);
	statsManager.recordPlay(song, state.source);
	recentlyPlayedManager.add(song);
	const buffer = await OPFS.getSong(song);
	if (!buffer) return;
	const arrayBuffer = await buffer.arrayBuffer();
	const blob = new Blob([arrayBuffer], { type: `audio/${song.ext}` });
	const audioUrl = URL.createObjectURL(blob);
	curTime.set(0);
	setCurTime.set(0);
	audioPlayer.update((value) => {
		const audio = value.audio ?? (browser ? new Audio() : null);
		if (audio) {
			audio.src = audioUrl;
			audio.currentTime = 0;
			audio.play();
			audio.addEventListener('loadedmetadata', () => {
				updateMediaSessionPositionState(audio);
			}, { once: true });
			return { ...value, audio, playing: true, currentTime: 0, onEnded: next };
		}
		return value;
	});
	updateMediaSessionPlaybackState(true);
	await emitNowPlaying(song);
}

export async function startPlayback(
	items: Song[],
	start: Song | string,
	source?: { type?: QueueSourceState['type']; id?: string; label?: string }
) {
	const unshuffled = items.filter(Boolean);
	if (!unshuffled.length) return;
	originalQueue.set(unshuffled.slice());
	const startId = typeof start === 'string' ? start : start.id;
	const startIndex = Math.max(
		unshuffled.findIndex((s) => s.id === startId),
		0
	);
	const startSong = unshuffled[startIndex];
	let queue = unshuffled.slice();
	if (get(shuffleEnabled) && queue.length > 1) {
		const otherSongs = queue.filter((_, i) => i !== startIndex);
		for (let i = otherSongs.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[otherSongs[i], otherSongs[j]] = [otherSongs[j], otherSongs[i]];
		}
		queue = [startSong, ...otherSongs];
	}
	updateQueue(queue, get(shuffleEnabled) ? 0 : startIndex, {
		type: source?.type ?? 'custom',
		id: source?.id,
		label: source?.label
	});
	statsManager.recordQueueStart(get(queueState).source, queue.length);
	await playAtIndex(get(shuffleEnabled) ? 0 : startIndex);
}

export async function next() {
	const state = get(queueState);
	if (!state.items.length) return;
	const isLastTrack = state.currentIndex >= state.items.length - 1;
	if (isLastTrack && !get(loopEnabled)) {
		audioPlayer.update((value) => {
			if (value.audio instanceof HTMLAudioElement) {
				value.audio.pause();
			}
			return { ...value, playing: false };
		});
		updateMediaSessionPlaybackState(false);
		return;
	}
	statsManager.recordSkip();
	await playAtIndex(state.currentIndex + 1);
}

export async function previous() {
	const state = get(queueState);
	if (!state.items.length) return;
	statsManager.recordSkip();
	await playAtIndex(state.currentIndex - 1);
}

export function togglePlay() {
	const state = get(audioPlayer);
	if (state.playing) {
		statsManager.recordPause();
	} else {
		statsManager.recordResume();
	}
	const newPlayingState = !state.playing;
	audioPlayer.update((value) => {
		if (value.audio instanceof HTMLAudioElement) {
			if (value.playing) {
				value.audio.pause();
			} else {
				value.audio.play();
			}
			updateMediaSessionPositionState(value.audio);
			return { ...value, playing: newPlayingState, currentTime: value.audio.currentTime };
		}
		return value;
	});
	updateMediaSessionPlaybackState(newPlayingState);
} 

export function setVolumeLevel(volume: number) {
	audioPlayer.update((value) => ({ ...value, volume, changeVolume: true }));
}

export function seekTo(time: number) {
	curTime.set(time);
	setCurTime.set(time);
	audioPlayer.update((value) => {
		if (value.audio instanceof HTMLAudioElement) {
			value.audio.currentTime = time;
			updateMediaSessionPositionState(value.audio);
			return { ...value, currentTime: time };
		}
		return value;
	});
}

export async function playRecent(index = 0) {
	const recent = recentlyPlayedManager.get().filter(Boolean);
	if (!recent.length) return;
	const startIndex = index >= 0 && index < recent.length ? index : 0;
	await startPlayback(recent, recent[startIndex].id, { type: 'recent' });
}

export function setQueueSource(source: QueueSourceState) {
	const state = get(queueState);
	updateQueue(state.items, state.currentIndex, source);
}

export function toggleShuffle() {
	const current = get(shuffleEnabled);
	shuffleEnabled.set(!current);
	const state = get(queueState);
	if (state.items.length <= 1) return;
	const currentSong = state.items[state.currentIndex];
	if (!current) {
		const otherSongs = state.items.filter((_, i) => i !== state.currentIndex);
		for (let i = otherSongs.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[otherSongs[i], otherSongs[j]] = [otherSongs[j], otherSongs[i]];
		}
		const shuffled = [currentSong, ...otherSongs];
		updateQueue(shuffled, 0, state.source);
	} else {
		const original = get(originalQueue);
		if (!original.length) return;
		const newIndex = original.findIndex((s) => s.id === currentSong.id);
		updateQueue(original.slice(), newIndex >= 0 ? newIndex : 0, state.source);
	}
}

export function toggleLoop() {
	loopEnabled.update((v) => !v);
}
