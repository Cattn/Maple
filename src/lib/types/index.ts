import type { Socket } from 'socket.io-client';
import type {
	Listening,
	PlaybackReply,
	PlaybackStart,
	PlaybackStop,
	PlaybackUpdate,
	RpcUpdate
} from '$shared/types/playback';
import type { ListeningProfile, OwnProfile } from '$shared/types/profile';

export type { FriendRequests, Profile } from '$shared/types/profile';
export type { Listening, ListeningVisibility } from '$shared/types/playback';

export type User = OwnProfile;
export type Friend = ListeningProfile;

type Reply = (result: PlaybackReply) => void;

export type MapleSocket = Socket<
	{
		friendRequest: (data: { id: string }) => void;
		friendRemoved: (data: { id: string }) => void;
		listening: (data: { id: string; listening: Listening | null }) => void;
		playbackOwnership: (data: { playbackId: string | null }) => void;
		rpcUpdate: (data: RpcUpdate) => void;
		requestAccepted: (data: { id: string; message: string }) => void;
		acceptedRequest: (data: { id: string; message: string }) => void;
	},
	{
		playbackStart: (data: PlaybackStart, reply: Reply) => void;
		playbackUpdate: (data: PlaybackUpdate, reply: Reply) => void;
		playbackStop: (data: PlaybackStop, reply: Reply) => void;
	}
>;

export type Album = {
	id: string;
	name: string;
	artist: string;
	image: string | Blob;
	year: number;
	genre?: string;
	tracks?: string[];
};

export type Artist = {
	id: string;
	name: string;
	image?: string | Blob;
	tracks?: string[];
	albums?: string[];
};

export enum DataType {
	FILE = 'FILE',
	OTHER = 'OTHER'
}

export interface PeerData {
	dataType: DataType;
	file?: Blob;
	fileName?: string;
	fileType?: string;
	message?: string;
}

export type Playlist = {
	id: string;
	name: string;
	description: string;
	tracks?: string[];
	image?: string | Blob;
	createdAt?: number;
	modifiedAt?: number;
};

export type Song = {
	id: string;
	title: string;
	artist: string;
	album: string;
	year: number;
	genre?: string;
	fileName: string;
	duration: number;
	image?: string | Blob;
	trackNumber: number;
	disk: number;
	ext: string;
};
