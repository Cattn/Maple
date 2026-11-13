import type { LyricLine } from '$lib/types';
import type { ILyricsTag } from 'music-metadata';

export function parseLyrics(text: string): LyricLine[] {
	const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
	const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
	const timed: LyricLine[] = [];
	for (const line of lines) {
		const tags = [...line.matchAll(/\[(\d+):(\d{2}(?:\.\d+)?)\]/g)];
		for (const tag of tags)
			timed.push({
				time: Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + offset),
				text: line.replace(/\[[^\]]*\]/g, '').trim()
			});
	}
	return timed.length
		? timed.sort((a, b) => a.time! - b.time!)
		: lines.filter((line) => !/^\[\w+:.*\]$/.test(line)).map((text) => ({ text }));
}

export function embeddedLyrics(tags?: ILyricsTag[]): LyricLine[] | undefined {
	for (const tag of tags ?? []) {
		if (tag.timeStampFormat === 2 && tag.syncText?.length)
			return tag.syncText.map((line) => ({
				text: line.text,
				time: line.timestamp === undefined ? undefined : line.timestamp / 1000
			}));
		if (tag.text?.trim()) return parseLyrics(tag.text);
	}
	return undefined;
}
