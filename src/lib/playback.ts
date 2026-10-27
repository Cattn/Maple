import { browser } from '$app/environment';
import { get } from 'svelte/store';
import type { PlaybackReply, PlaybackUpdate } from '$shared/types/playback';
import { UserManager } from '$lib/api/UserManager';
import UserSettings from '$lib/preferences/usersettings';
import { audioPlayer, isLoggedIn, socket } from '$lib/store';
import type { MapleSocket, Song } from '$lib/types';

const HEARTBEAT_MS = 25000;
const MAX_SECONDS = 86400;

let playbackId: string | undefined;
let owned = false;
let ownerPlaybackId: string | null = null;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let uploadQueue: Promise<void> = Promise.resolve();

function seconds(value: number | undefined) {
	return value !== undefined && Number.isFinite(value)
		? Math.min(Math.max(value, 0), MAX_SECONDS)
		: 0;
}

function text(value: string | undefined) {
	return (value ?? '').trim().slice(0, 512);
}

function snapshot(id: string): PlaybackUpdate {
	const audio = get(audioPlayer).audio;
	const duration = seconds(audio?.duration);
	return {
		playbackId: id,
		playing: !!audio?.src && !audio.paused && !audio.ended,
		position: seconds(audio?.currentTime),
		playbackRate: Math.min(Math.max(audio?.playbackRate || 1, 0.1), 16),
		duration: duration > 0 ? duration : null,
		discord: UserSettings.discord.enabled
	};
}

async function send(
	request: (client: ReturnType<MapleSocket['timeout']>) => Promise<PlaybackReply>
) {
	const client = get(socket);
	if (!client?.connected) return undefined;
	try {
		return await request(client.timeout(10000));
	} catch {
		return undefined;
	}
}

function release() {
	owned = false;
	clearInterval(heartbeat);
	heartbeat = undefined;
}

export function ownsPlayback() {
	return owned;
}

export function sendUpdate() {
	if (!owned || !playbackId) return;
	const id = playbackId;
	void send((client) => client.emitWithAck('playbackUpdate', snapshot(id))).then((reply) => {
		if (reply && !reply.ok && playbackId === id) release();
	});
}

export function stopPlayback() {
	const id = playbackId;
	playbackId = undefined;
	release();
	if (id) void send((client) => client.emitWithAck('playbackStop', { playbackId: id }));
}

export async function claimPlayback(song: Song, artwork: () => Promise<File | undefined>) {
	release();
	const id = crypto.randomUUID();
	playbackId = id;
	if (!get(isLoggedIn)) return;
	const connection = get(socket);
	const state = snapshot(id);
	const reply = await send((client) =>
		client.emitWithAck('playbackStart', {
			...state,
			title: text(song.title) || 'Unknown Title',
			artist: text(song.artist),
			album: text(song.album),
			duration: state.duration ?? (song.duration > 0 ? seconds(song.duration) : null)
		})
	);
	if (reply && !reply.ok) console.error('Unable to report playback:', reply.error);
	if (
		!reply?.ok ||
		playbackId !== id ||
		ownerPlaybackId !== id ||
		!get(isLoggedIn) ||
		get(socket) !== connection ||
		!connection?.connected
	)
		return;
	owned = true;
	heartbeat = setInterval(sendUpdate, HEARTBEAT_MS);
	sendUpdate();
	// Track uploads separately from playback, and serialize writes to the account's cover.
	uploadQueue = uploadQueue.then(async () => {
		if (!owned || playbackId !== id) return;
		try {
			const file = await artwork();
			if (file && owned && playbackId === id) await UserManager.setAlbumArt(file, id);
		} catch (error) {
			console.error('Unable to upload RPC artwork:', error);
		}
	});
}

export function watchPlayback(client: MapleSocket) {
	// Ownership broadcasts carry the owner's playbackId; they never claim playback for an old tab.
	client.on('playbackOwnership', (data) => {
		if (get(socket) !== client) return;
		ownerPlaybackId = data.playbackId;
		if (data.playbackId !== playbackId) release();
	});
	client.on('disconnect', () => {
		if (get(socket) !== client) return;
		ownerPlaybackId = null;
		release();
	});
}

if (browser) {
	let boundAudio: HTMLAudioElement | null = null;
	const updates = ['playing', 'pause', 'seeked', 'ratechange', 'durationchange'];
	const stops = ['ended', 'error'];
	const unsubscribeAudio = audioPlayer.subscribe(({ audio }) => {
		if (audio === boundAudio) return;
		for (const event of updates) boundAudio?.removeEventListener(event, sendUpdate);
		for (const event of stops) boundAudio?.removeEventListener(event, stopPlayback);
		boundAudio = audio;
		for (const event of updates) audio?.addEventListener(event, sendUpdate);
		for (const event of stops) audio?.addEventListener(event, stopPlayback);
	});
	const unsubscribeLogin = isLoggedIn.subscribe((loggedIn) => {
		if (!loggedIn) stopPlayback();
	});
	window.addEventListener('discordSettingsChanged', sendUpdate);
	window.addEventListener('pagehide', stopPlayback);
	import.meta.hot?.dispose(() => {
		stopPlayback();
		unsubscribeAudio();
		unsubscribeLogin();
		for (const event of updates) boundAudio?.removeEventListener(event, sendUpdate);
		for (const event of stops) boundAudio?.removeEventListener(event, stopPlayback);
		window.removeEventListener('discordSettingsChanged', sendUpdate);
		window.removeEventListener('pagehide', stopPlayback);
	});
}
