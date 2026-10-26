import express, { type Response } from 'express';
import { accountId, requireSession } from '../middleware/session.js';
import { serverError } from '../middleware/serverError.js';
import type { FriendOutcome } from '../types/profile.js';
import type { Services } from '../types/services.js';

const failures: Record<Exclude<FriendOutcome, 'ok'>, [number, string]> = {
	self: [400, 'You cannot friend your own account.'],
	missing: [404, 'User not found'],
	friends: [409, 'You are already friends.'],
	pending: [409, 'Friend request already sent.'],
	incoming: [409, 'This user already sent you a friend request.'],
	noRequest: [404, 'Friend request not found'],
	notFriends: [404, 'You are not friends.']
};

function reply(res: Response, outcome: FriendOutcome, message: string) {
	if (outcome === 'ok') return res.status(200).json({ message });
	const [status, error] = failures[outcome];
	return res.status(status).json({ error });
}

export function createFriendsRouter({ auth, friendships, playback }: Services) {
	const router = express.Router();

	router.use(requireSession(auth));

	router.get('/me', (req, res) => {
		const id = accountId(req);
		return res.status(200).json(friendships.friends(id).map((friend) => playback.show(friend, id)));
	});

	router.get('/me/requests', (req, res) => {
		return res.status(200).json(friendships.requests(accountId(req)));
	});

	router.post('/me/requests/:id', (req, res) => {
		const outcome = friendships.request(accountId(req), req.params.id);
		return reply(res, outcome, 'Request sent successfully');
	});

	router.post('/me/requests/:id/accept', (req, res) => {
		const outcome = friendships.accept(accountId(req), req.params.id);
		return reply(res, outcome, 'Friend request accepted successfully');
	});

	router.delete('/me/requests/:id', (req, res) => {
		const outcome = friendships.decline(accountId(req), req.params.id);
		return reply(res, outcome, 'Friend request declined successfully');
	});

	router.delete('/me/:id', (req, res) => {
		const outcome = friendships.remove(accountId(req), req.params.id);
		return reply(res, outcome, 'Friend removed successfully');
	});

	router.use(serverError('Error processing friend request'));

	return router;
}
