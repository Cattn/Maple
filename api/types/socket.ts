import type { Server, Socket } from 'socket.io';
import type { SessionUser } from './auth.js';

export interface RpcSnapshot {
	title: string;
	artist: string;
	album: string;
	image: string | undefined;
	artworkRequestId: string | undefined;
	artworkReady: boolean | undefined;
	artworkWait: number | undefined;
	id: string;
	playing: true;
	position: number;
	duration: number | undefined;
	playbackRate: number;
}

export type RpcState = RpcSnapshot | { playing: false };

export type RpcUpdate =
	| { playing: false }
	| {
			artist: string | undefined;
			title: string | undefined;
			state: string | undefined;
			largeImageKey: string;
			largeImageText: string | undefined;
			id: string;
			album: string | undefined;
			artworkRequestId: string | undefined;
			artworkReady: boolean | undefined;
			artworkWait: number | undefined;
			playing: true;
			position: number;
			duration: number | undefined;
			playbackRate: number;
			smallImageKey: string;
			smallText: string;
			buttons: { label: string; url: string }[];
	  };

export interface ClientEvents {
	nowPlaying: (data: unknown) => void;
	playbackState: (data: unknown) => void;
	rpcOwnershipRequest: () => void;
}

export interface ServerEvents {
	friendRequest: (data: { id: string }) => void;
	nowPlaying: (data: { nowPlaying: Record<string, unknown>; id: string }) => void;
	rpcUpdate: (data: RpcUpdate) => void;
	rpcOwnership: (data: { generation: string; owned: boolean }) => void;
	albumArtUploaded: (data: { id: string; artworkRequestId: string | undefined }) => void;
	invalidNowPlaying: (data: { message: string[] }) => void;
	semiValidNowPlaying: (data: { message: string[] }) => void;
	error: (message: string) => void;
	requestAccepted: (data: { id: string; message: string }) => void;
	acceptedRequest: (data: { id: string; message: string }) => void;
}

export interface SocketData {
	user: SessionUser;
	rpcSuperseded?: boolean;
}

export type MapleServer = Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
export type MapleSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
