import type { Response } from 'express';
import { imageFormat } from '../validation/image.js';

export function sendImage(res: Response, id: string, image: Buffer) {
	const format = imageFormat(image);
	res.set('Content-Type', format?.type ?? 'application/octet-stream');
	res.set('X-Content-Type-Options', 'nosniff');
	res.set('Content-Disposition', `attachment; filename="${id}.${format?.extension ?? 'bin'}"`);
	return res.send(image);
}
