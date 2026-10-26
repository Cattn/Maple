const signatures = [
	{ type: 'image/jpeg', extension: 'jpg', bytes: [0xff, 0xd8, 0xff] },
	{ type: 'image/png', extension: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
	{ type: 'image/gif', extension: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] }
];

export function imageFormat(image: Buffer) {
	return signatures.find(({ bytes }) => bytes.every((byte, index) => image[index] === byte));
}
