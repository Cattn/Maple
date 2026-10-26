import type { Auth } from '../auth/auth.js';
import type { RpcManager } from '../iomanager/rpc.js';
import type { Database } from '../storage/sqlite.js';
import type { MapleServer } from './socket.js';

export interface Services {
	db: Database;
	io: MapleServer;
	rpc: RpcManager;
	auth: Auth;
}
