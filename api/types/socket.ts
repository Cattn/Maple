import type { Server, Socket } from 'socket.io';
import type { SessionUser } from './auth.js';
import type { Listening, PlaybackReply, RpcUpdate } from './playback.js';

type Reply = (result: PlaybackReply) => void;

export interface ClientEvents {
	playbackStart: (data: unknown, reply?: Reply) => void;
	playbackUpdate: (data: unknown, reply?: Reply) => void;
	playbackStop: (data: unknown, reply?: Reply) => void;
}

export interface ServerEvents {
	friendRequest: (data: { id: string }) => void;
	friendRemoved: (data: { id: string }) => void;
	listening: (data: { id: string; listening: Listening | null }) => void;
	playbackOwnership: (data: { playbackId: string | null }) => void;
	rpcUpdate: (data: RpcUpdate) => void;
	requestAccepted: (data: { id: string; message: string }) => void;
	acceptedRequest: (data: { id: string; message: string }) => void;
}

export interface SocketData {
	user: SessionUser;
}

export type MapleServer = Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
export type MapleSocket = Socket<ClientEvents, ServerEvents, Record<string, never>, SocketData>;
