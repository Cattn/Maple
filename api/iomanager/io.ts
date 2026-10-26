import type { MapleServer } from '../types/socket.js';

export function accountRoom(id: string) {
	return `account:${id}`;
}

export function sessionRoom(sessionId: string) {
	return `session:${sessionId}`;
}

export function disconnectAccount(io: MapleServer, id: string) {
	io.in(accountRoom(id)).disconnectSockets(true);
}

export function disconnectSession(io: MapleServer, sessionId: string) {
	io.in(sessionRoom(sessionId)).disconnectSockets(true);
}
