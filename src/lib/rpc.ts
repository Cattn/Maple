import { browser } from '$app/environment';
import { get } from 'svelte/store';
import type { Socket } from 'socket.io-client';
import { activeSong, audioPlayer, isLoggedIn, SavedUser, socket } from '$lib/store';
import UserSettings from '$lib/preferences/usersettings';

let ownershipGeneration: string | undefined;
let artworkRequest = 0;
let artwork: { songId: string; account: string; deadline: number; id?: string } | undefined;
let artworkTimer: ReturnType<typeof setTimeout> | undefined;
let uploadQueue: Promise<void> = Promise.resolve();
let publishArtwork = () => {};

// Begin synchronously, before changing activeSong/audio: no event can announce the
// next track with the previous cover. Serialize writes to Maple's per-user image.
export function prepareRpcArtwork(songId: string, upload: () => Promise<string | undefined>): Promise<void> {
	const request = ++artworkRequest;
	const account = get(SavedUser).id;
	clearTimeout(artworkTimer);
	const pending = { songId, account, deadline: Date.now() + 30000, id: undefined as string | undefined };
	artwork = pending;
	publishArtwork();
	const current = () => request === artworkRequest && account === get(SavedUser).id &&
		get(isLoggedIn) && get(activeSong).id === songId;
	artworkTimer = setTimeout(() => { if (current()) publishArtwork(); }, 30000);
	uploadQueue = uploadQueue.then(async () => {
		if (!current()) return;
		try {
			const id = await upload();
			if (current() && typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)) {
				pending.id = id;
				clearTimeout(artworkTimer);
				publishArtwork();
			}
		} catch (error) {
			console.error('Unable to upload RPC artwork:', error);
		}
	});
	return uploadQueue;
}

export function playbackSnapshot() {
	const audio = get(audioPlayer).audio;
	const song = get(activeSong);
	const cover = artwork && artwork.songId === song.id && artwork.account === get(SavedUser).id ? artwork : undefined;
	const artworkWait = cover ? Math.max(0, (cover.deadline - Date.now()) / 1000) : 30;
	const playing = !!audio?.src && !audio.paused && !audio.ended && !audio.error && !!song.id &&
		!!cover && (!!cover.id || artworkWait === 0);
	return {
		generation: ownershipGeneration,
		artworkId: cover?.id,
		artworkWait,
		title: song.title,
		artist: song.artist,
		album: song.album,
		discord: UserSettings.discord.enabled,
		playing,
		position: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
		duration: audio && Number.isFinite(audio.duration) ? audio.duration : undefined,
		playbackRate: audio?.playbackRate ?? 1
	};
}

if (browser) {
	let boundSocket: Socket | null = null;
	let boundAudio: HTMLAudioElement | null = null;
	let timer: ReturnType<typeof setInterval> | undefined;
	let lastReport = 0;
	let account = get(SavedUser).id;
	let pendingClaim = false;
	const events = [
		'playing',
		'pause',
		'seeked',
		'ratechange',
		'loadedmetadata',
		'timeupdate',
		'ended',
		'error',
		'emptied'
	];
	const stopTimer = () => {
		clearInterval(timer);
		timer = undefined;
	};
	const publish = (claim = false) => {
		stopTimer();
		if (!boundSocket?.connected || !get(isLoggedIn) || !get(SavedUser).id) return;
		if (!ownershipGeneration) {
			pendingClaim ||= claim;
			return;
		}
		const snapshot = playbackSnapshot();
		lastReport = Date.now();
		boundSocket.emit('playbackState', { ...snapshot, claim });
		if (snapshot.playing && snapshot.discord) {
			timer = setInterval(() => publish(), 15000);
		}
	};
	const onPlayback = (event: Event) => {
		if (event.type === 'timeupdate' && Date.now() - lastReport < 15000) return;
		publish(['playing', 'seeked', 'ratechange'].includes(event.type));
	};
	publishArtwork = () => publish(true);
	const resetOwnership = () => {
		stopTimer();
		ownershipGeneration = undefined;
		pendingClaim = false;
	};
	const onConnect = () => {
		resetOwnership();
		publish(true);
		boundSocket?.emit('rpcOwnershipRequest');
	};
	const onOwnership = (data: { generation?: unknown; owned?: unknown } | null) => {
		if (!data || typeof data.generation !== 'string' || !data.generation || data.generation.length > 128) return;
		const changed = ownershipGeneration !== data.generation;
		ownershipGeneration = data.generation;
		// Ownership broadcasts refresh the token; they do not claim playback for an old tab.
		if (pendingClaim) {
			pendingClaim = false;
			publish(true);
		} else if (changed && data.owned === true) {
			// A quick pause/seek may have been queued with the pre-claim token. Resample
			// only the confirmed owner so that it can correct state after the handoff.
			publish();
		}
	};
	const onSettings = () => publish(true);
	const onVisibility = () => publish();
	const onUnload = () => {
		++artworkRequest;
		clearTimeout(artworkTimer);
		stopTimer();
		if (boundSocket?.connected) {
			boundSocket.emit('playbackState', { playing: false, discord: UserSettings.discord.enabled, generation: ownershipGeneration });
		}
	};
	const subscriptions = [
		audioPlayer.subscribe(({ audio }) => {
			if (audio === boundAudio) return;
			if (boundAudio) {
				for (const event of events) boundAudio.removeEventListener(event, onPlayback);
			}
			boundAudio = audio;
			if (audio) {
				for (const event of events) audio.addEventListener(event, onPlayback);
			}
			publish();
		}),
		socket.subscribe((value) => {
			if (value === boundSocket) return;
			if (boundSocket) {
				boundSocket.off('connect', onConnect);
				boundSocket.off('disconnect', resetOwnership);
				boundSocket.off('rpcOwnership', onOwnership);
				boundSocket.disconnect();
			}
			resetOwnership();
			boundSocket = value;
			value?.on('connect', onConnect);
			value?.on('disconnect', resetOwnership);
			value?.on('rpcOwnership', onOwnership);
			if (value?.connected) onConnect();
		}),
		SavedUser.subscribe(({ id }) => {
			if (account !== id) { ++artworkRequest; artwork = undefined; clearTimeout(artworkTimer); }
			if (account && account !== id && boundSocket) {
				onUnload();
				boundSocket.disconnect();
				if (id) boundSocket.connect();
			}
			account = id;
		}),
		isLoggedIn.subscribe((loggedIn) => {
			if (loggedIn) {
				if (UserSettings.preferences.socket) boundSocket?.connect();
				publish(true);
			} else {
				++artworkRequest;
				artwork = undefined;
				clearTimeout(artworkTimer);
				onUnload();
				boundSocket?.disconnect();
			}
		})
	];
	window.addEventListener('discordSettingsChanged', onSettings);
	window.addEventListener('pagehide', onUnload);
	document.addEventListener('visibilitychange', onVisibility);
	import.meta.hot?.dispose(() => {
		++artworkRequest;
		publishArtwork = () => {};
		onUnload();
		for (const unsubscribe of subscriptions) unsubscribe();
		for (const event of events) boundAudio?.removeEventListener(event, onPlayback);
		boundSocket?.off('connect', onConnect);
		boundSocket?.off('disconnect', resetOwnership);
		boundSocket?.off('rpcOwnership', onOwnership);
		window.removeEventListener('discordSettingsChanged', onSettings);
		window.removeEventListener('pagehide', onUnload);
		document.removeEventListener('visibilitychange', onVisibility);
	});
}
