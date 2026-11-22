const MAX_PAGE_BYTES = 27 + 255 + 255 * 255;
const OGG_MAGIC = 0x4f676753;

export async function readOpusDuration(file: Blob): Promise<number | undefined> {
	const head = new DataView(await file.slice(0, 27 + 255 + 12).arrayBuffer());
	if (head.byteLength < 28 || head.getUint32(0) !== OGG_MAGIC || head.getUint16(4) !== 2)
		return;
	const packet = 27 + head.getUint8(26);
	if (
		packet + 12 > head.byteLength ||
		head.getUint32(packet) !== 0x4f707573 ||
		head.getUint32(packet + 4) !== 0x48656164
	) return;

	const serial = head.getUint32(14, true);
	const preSkip = head.getUint16(packet + 10, true);
	const tail = new DataView(await file.slice(-MAX_PAGE_BYTES).arrayBuffer());
	for (let offset = tail.byteLength - 27; offset >= 0; offset--) {
		if (
			tail.getUint32(offset) !== OGG_MAGIC ||
			tail.getUint8(offset + 4) !== 0 ||
			!(tail.getUint8(offset + 5) & 4) ||
			tail.getUint32(offset + 14, true) !== serial
		) continue;

		const tableEnd = offset + 27 + tail.getUint8(offset + 26);
		if (tableEnd > tail.byteLength) continue;
		let pageEnd = tableEnd;
		for (let i = offset + 27; i < tableEnd; i++) pageEnd += tail.getUint8(i);
		if (pageEnd !== tail.byteLength) continue;

		const samples = Number(tail.getBigInt64(offset + 6, true)) - preSkip;
		if (Number.isSafeInteger(samples) && samples >= 0) return samples / 48000;
	}
}
