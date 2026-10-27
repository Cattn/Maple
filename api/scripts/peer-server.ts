import { PeerServer } from 'peer';

const port = Number(process.env.PEER_PORT || 9000);
const peerServer = PeerServer({ port, path: '/peerjs' }, () => {
	console.log(`[PEER] PeerJS server is running on port ${port}`);
});
peerServer.on('connection', (client) => {
	console.log(`[PEER] User connected with ID: ${client.getId()}`);
});
peerServer.on('disconnect', (client) => {
	console.log(`[PEER] User disconnected with ID: ${client.getId()}`);
});
