import { UserPeer } from '$lib/store';
import Peer from 'peerjs';
import { get } from 'svelte/store';
export class PeerManager {
	public static getPeer = async () => {
		const peer = get(UserPeer);
		if (peer) {
			return peer;
		}
		return null;
	};

	public static createPeer = async () => {
		try {
			const response = await fetch('https://maple.kolf.pro:3000/peerjs/generate-id', {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Failed to get authenticated ID');
			}

			const { id } = await response.json();

			const peer = new Peer(id, {
				host: 'maple.kolf.pro',
				port: 3000,
				secure: true,
				path: '/peerjs'
			});

			await new Promise((resolve, reject) => {
				peer.on('open', (id) => {
					console.log('[PEER] Connected with ID:', id);
					resolve(id);
				});
				peer.on('error', (error) => {
					console.error('[PEER] Error:', error);
					reject(error);
				});
			});

			UserPeer.set(peer);
			return peer;
		} catch (error) {
			console.error('[PEER] Error creating peer:', error);
			return null;
		}
	};
}
