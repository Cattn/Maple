import type http from 'node:http';
import { ExpressPeerServer } from 'peer';

export function createPeerServer(server: http.Server) {
	const peerServer = ExpressPeerServer(server);
	peerServer.on('connection', (client) => {
		console.log(`[PEER] User connected with ID: ${client.getId()}`);
	});
	peerServer.on('disconnect', (client) => {
		console.log(`[PEER] User disconnected with ID: ${client.getId()}`);
	});
	return peerServer;
}
