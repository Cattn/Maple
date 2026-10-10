import { browser } from '$app/environment';
import { get } from 'svelte/store';
import type { Socket } from 'socket.io-client';
import { activeSong, audioPlayer, isLoggedIn, SavedUser, socket } from '$lib/store';
import UserSettings from '$lib/preferences/usersettings';

export function playbackSnapshot() {
	const audio = get(audioPlayer).audio;
	const song = get(activeSong);
	const playing = !!audio?.src && !audio.paused && !audio.ended && !audio.error && !!song.id;
	return {
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
	const onConnect = () => publish(true);
	const onSettings = () => publish(true);
	const onVisibility = () => publish();
	const onUnload = () => {
		stopTimer();
		if (boundSocket?.connected) {
			boundSocket.emit('playbackState', { playing: false, discord: UserSettings.discord.enabled });
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
				boundSocket.off('disconnect', stopTimer);
				boundSocket.disconnect();
			}
			boundSocket = value;
			value?.on('connect', onConnect);
			value?.on('disconnect', stopTimer);
			publish(true);
		}),
		SavedUser.subscribe(({ id }) => {
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
				onUnload();
				boundSocket?.disconnect();
			}
		})
	];
	window.addEventListener('discordSettingsChanged', onSettings);
	window.addEventListener('pagehide', onUnload);
	document.addEventListener('visibilitychange', onVisibility);
	import.meta.hot?.dispose(() => {
		onUnload();
		for (const unsubscribe of subscriptions) unsubscribe();
		for (const event of events) boundAudio?.removeEventListener(event, onPlayback);
		boundSocket?.off('connect', onConnect);
		boundSocket?.off('disconnect', stopTimer);
		window.removeEventListener('discordSettingsChanged', onSettings);
		window.removeEventListener('pagehide', onUnload);
		document.removeEventListener('visibilitychange', onVisibility);
	});
}
