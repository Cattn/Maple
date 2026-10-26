import type { ArtworkLinks } from '../auth/artworkLinks.js';
import type { Auth } from '../auth/auth.js';
import type { PlaybackManager } from '../iomanager/playback.js';
import type { Database } from '../storage/sqlite.js';
import type { FriendshipManager } from '../user/friendships.js';
import type { ProfileManager } from '../user/profiles.js';
import type { MapleServer } from './socket.js';

export interface Services {
	db: Database;
	io: MapleServer;
	auth: Auth;
	links: ArtworkLinks;
	profiles: ProfileManager;
	friendships: FriendshipManager;
	playback: PlaybackManager;
}
