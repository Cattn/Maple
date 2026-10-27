export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function field(value: unknown, key: string): unknown {
	return isRecord(value) ? value[key] : undefined;
}
