import { isRecord } from '../types/record.js';

export interface Validation {
	valid: boolean;
	message: string[];
	flag: boolean;
}

function requireText(data: Record<string, unknown>, key: string, errors: string[]) {
	const value = data[key];
	if (!value) {
		errors.push(`${key} is not provided`);
	} else if (typeof value !== 'string' || value.trim() === '') {
		errors.push(`${key} is not a string or is empty`);
	}
}

function hasText(value: unknown) {
	return typeof value === 'string' && value.trim() !== '';
}

export function validateNowPlaying(data: unknown): Validation {
	if (!data) {
		return { valid: false, message: ['Data is not provided'], flag: false };
	} else if (!isRecord(data)) {
		return { valid: false, message: ['Data is not an object'], flag: false };
	}

	const errors: string[] = [];
	for (const key of ['id', 'album', 'title', 'artist']) {
		requireText(data, key, errors);
	}

	if (!('discord' in data)) {
		errors.push('discord is not provided');
	} else if (typeof data.discord !== 'boolean') {
		errors.push('discord is not a boolean');
	}

	if (errors.length > 0) {
		return { valid: false, message: errors, flag: false };
	}

	// Check optional fields
	const warnings: string[] = [];
	if (!hasText(data.timePlayed)) {
		warnings.push('timePlayed is missing or invalid');
	}
	if (!hasText(data.source)) {
		warnings.push('source is missing or invalid');
	}

	if (warnings.length > 0) {
		return { valid: true, message: warnings, flag: true };
	}

	return { valid: true, message: [], flag: false };
}

export function friendIds(rows: Record<string, unknown>[], id: string) {
	const ids: string[] = [];
	for (const { user_id, friend_id } of rows) {
		if (typeof user_id !== 'string' || typeof friend_id !== 'string') continue;
		if (user_id === id && friend_id !== id) {
			ids.push(friend_id);
		} else if (friend_id === id && user_id !== id) {
			ids.push(user_id);
		}
	}
	return ids;
}
