import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const apiRoot = path.basename(moduleRoot) === 'dist' ? path.dirname(moduleRoot) : moduleRoot;

export function databasePath(configured: string | undefined) {
	// Relative paths are always relative to api/, regardless of the working directory.
	return path.resolve(apiRoot, configured || 'data/maple.sqlite');
}
