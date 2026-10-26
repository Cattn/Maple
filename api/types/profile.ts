import type { LastPlayed, Listening, ListeningVisibility } from './playback.js';

export interface Profile {
	id: string;
	username: string;
	name: string | null;
}

export interface OwnProfile extends Profile {
	pfp: string | null;
	listeningVisibility: ListeningVisibility;
}

export interface ListeningRecord extends Profile {
	visibility: ListeningVisibility;
	lastPlayed: LastPlayed | null;
}

export interface ListeningProfile extends Profile {
	listening: Listening | null;
}

export interface FriendRequests {
	incoming: Profile[];
	outgoing: Profile[];
}

export type FriendOutcome =
	| 'ok'
	| 'self'
	| 'missing'
	| 'friends'
	| 'pending'
	| 'incoming'
	| 'noRequest'
	| 'notFriends';
