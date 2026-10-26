export type ListeningVisibility = 'public' | 'private';

export interface Track {
	title: string;
	artist: string;
	album: string;
	duration: number | null;
}

export interface PlaybackStart extends Track {
	playbackId: string;
	playing: boolean;
	position: number;
	playbackRate: number;
	discord: boolean;
}

export interface PlaybackUpdate {
	playbackId: string;
	playing: boolean;
	position: number;
	playbackRate: number;
	duration: number | null;
	discord: boolean;
}

export interface PlaybackStop {
	playbackId: string;
}

export type PlaybackReply = { ok: true } | { ok: false; error: string };

export interface CurrentPlayback extends Track {
	playing: boolean;
	position: number;
	playbackRate: number;
	artwork: string | null;
}

export interface LastPlayed extends Track {
	playedAt: string | null;
	artwork: string | null;
}

export interface Listening {
	current: CurrentPlayback | null;
	lastPlayed: LastPlayed | null;
}

export type RpcUpdate =
	| { playing: false }
	| {
			playing: true;
			id: string;
			title: string;
			artist: string;
			album: string;
			state: string | null;
			largeImageKey: string;
			largeImageText: string | null;
			smallImageKey: string;
			smallText: string;
			position: number;
			duration: number | null;
			playbackRate: number;
			buttons: { label: string; url: string }[];
	  };
