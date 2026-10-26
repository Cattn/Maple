import * as z from 'zod';
import type {
	ListeningVisibility,
	PlaybackStart,
	PlaybackStop,
	PlaybackUpdate
} from '../types/playback.js';

export const playbackIdPattern = /^[\w-]{1,64}$/;

const playbackId = z.string().regex(playbackIdPattern, 'playbackId is invalid.');
const text = z.string().trim().max(512);
// Check optional fields
const position = z.number().min(0).max(86400);
const duration = z.number().positive().max(86400).nullable().default(null);
const playbackRate = z.number().positive().max(16).default(1);

export const playbackStartSchema: z.ZodType<PlaybackStart> = z.object({
	playbackId,
	title: text.min(1, 'title is required.'),
	artist: text,
	album: text,
	duration,
	playing: z.boolean().default(true),
	position: position.default(0),
	playbackRate,
	discord: z.boolean()
});

export const playbackUpdateSchema: z.ZodType<PlaybackUpdate> = z.object({
	playbackId,
	playing: z.boolean(),
	position,
	playbackRate,
	duration,
	discord: z.boolean()
});

export const playbackStopSchema: z.ZodType<PlaybackStop> = z.object({ playbackId });

export const listeningVisibilitySchema: z.ZodType<ListeningVisibility> = z.enum(
	['public', 'private'],
	'Visibility must be public or private.'
);
