import { createHmac, timingSafeEqual } from 'node:crypto';

const windowSeconds = 30 * 60;

export interface ArtworkLink {
	id: string;
	artworkId: string;
	expires: number;
	signature: string;
}

export function createArtworkLinks(secret: string, apiURL: string) {
	const key = createHmac('sha256', secret).update('maple:artwork-links').digest();
	const sign = (id: string, artworkId: string, expires: number) =>
		createHmac('sha256', key).update(`${id}\n${artworkId}\n${expires}`).digest('base64url');

	return {
		url(id: string, artworkId: string, now = Date.now()) {
			const expires = (Math.floor(now / 1000 / windowSeconds) + 2) * windowSeconds;
			const path = [id, artworkId, String(expires), sign(id, artworkId, expires)]
				.map(encodeURIComponent)
				.join('/');
			return `${apiURL}/public/artwork/${path}`;
		},

		verify({ id, artworkId, expires, signature }: ArtworkLink, now = Date.now()) {
			const seconds = now / 1000;
			if (!Number.isSafeInteger(expires) || expires <= seconds) return false;
			if (expires > seconds + 2 * windowSeconds) return false;
			const expected = Buffer.from(sign(id, artworkId, expires));
			const actual = Buffer.from(signature);
			return actual.length === expected.length && timingSafeEqual(actual, expected);
		}
	};
}

export type ArtworkLinks = ReturnType<typeof createArtworkLinks>;
