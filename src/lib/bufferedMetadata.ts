import { parseBlob, parseBuffer } from 'music-metadata';

const PREFIX_BYTES = 256 * 1024;
const SUFFIX_BYTES = 8 * 1024;

export async function readBufferedMetadata(file: Blob, duration: boolean) {
	const options = { duration, skipPostHeaders: false };
	if (file.size <= PREFIX_BYTES + SUFFIX_BYTES) {
		return parseBuffer(new Uint8Array(await file.arrayBuffer()), { mimeType: file.type }, options);
	}
	const suffixStart = file.size - SUFFIX_BYTES;
	const [prefix, suffix] = await Promise.all([
		file.slice(0, PREFIX_BYTES).arrayBuffer(),
		file.slice(suffixStart).arrayBuffer()
	]);
	const buffered = new Blob([prefix, file.slice(PREFIX_BYTES, suffixStart), suffix], {
		type: file.type
	});
	return parseBlob(buffered, options);
}
