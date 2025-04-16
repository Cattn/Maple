export type AddedFriend = {
	id: string;
	name: string;
	username: string;
	pfp?: string;
	nowPlaying?: {
		title: string;
		artist: string;
		album: string;
	};
};
