import { parseBlob, parseBuffer } from 'music-metadata';
import { OPFS } from '$lib/opfs';
import { toast } from 'svelte-sonner';
import { v4 as uuidv4 } from 'uuid';
import { writable } from 'svelte/store';
import type { Song, Album, Artist } from '$lib/types';
import UserSettings from '$lib/preferences/usersettings';
import { refreshLibrary } from '$lib/global.svelte';
import { statsManager } from '$lib/stats';

declare global {
	//prob fixes annoying ts warnings
	interface Window {
		showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
	}
}

const AUDIO_EXT = /\.(mp3|flac|m4a|aac|ogg|opus|wav|wma|aiff|alac|webm)$/i;

export const iosImportOpen = writable(false);

export const IOS_AUDIO_ACCEPT =
	'audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/flac,audio/ogg,audio/opus,audio/webm,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus';

export function isIOS(): boolean {
	if (typeof window !== 'undefined' && (window as Window & { __mapleIOS?: boolean }).__mapleIOS)
		return true;
	if (typeof navigator === 'undefined') return false;
	if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
	return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isDirectoryPickerSupported(): boolean {
	return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export function isWebkitDirectorySupported(): boolean {
	return typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input');
}

function isAudioFile(file: File): boolean {
	if (file.type.startsWith('audio/')) return true;
	return AUDIO_EXT.test(file.name);
}

function yieldToUI(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

const PARSE_HEAD_BYTES = 2 * 1024 * 1024;
const IMPORT_FLUSH_EVERY = 20;
const IMPORT_TOAST_ID = 'library-import';

async function parseMetadataWithTimeout(
	file: File,
	timeoutMs: number = 30000
): Promise<Awaited<ReturnType<typeof parseBlob>> | null> {
	try {
		const timeoutPromise = new Promise<null>((_, reject) =>
			setTimeout(() => reject(new Error('Metadata parsing timeout')), timeoutMs)
		);
		const parsePromise = parseBlob(file, { duration: false, skipPostHeaders: true });
		return await Promise.race([parsePromise, timeoutPromise]);
	} catch {
		return null;
	}
}

async function parseMetadataFast(file: File) {
	try {
		const headBytes = Math.min(file.size, PARSE_HEAD_BYTES);
		const buf = new Uint8Array(await file.slice(0, headBytes).arrayBuffer());
		const parsed = await parseBuffer(
			buf,
			{ mimeType: file.type || undefined, path: file.name, size: file.size },
			{ duration: false, skipPostHeaders: true }
		);
		if (parsed?.common?.title || parsed?.common?.artist) return parsed;
	} catch {
		/* fall through to full parse */
	}
	return parseMetadataWithTimeout(file);
}

export async function createLibrary(mobileFiles?: FileList | File[]): Promise<void> {
	if (mobileFiles === undefined) {
		iosImportOpen.set(true);
		return;
	}

	const selected = Array.from(mobileFiles);

	try {
		const sampleImage = await fetch('/placeholder.png');
		const blob = await sampleImage.blob();
		await OPFS.initializeLibrary();

		const handleFiles = async (files: FileList | File[]) => {
			if (!files || files.length === 0) {
				toast.error('No files selected. Please select audio files to upload.');
				return;
			}

			const audioFiles = Array.from(files).filter(isAudioFile);
			if (audioFiles.length === 0) {
				toast.error('No audio files found. Please select audio files (MP3, FLAC, etc.).');
				return;
			}

			let i = 0;
			let successCount = 0;
			let skippedCount = 0;
			const addedIds: string[] = [];
			await OPFS.beginImport();
			try {
				for (const file of audioFiles) {
					i++;
					if (i === 1 || i === audioFiles.length || i % 8 === 0) {
						toast(`${i} of ${audioFiles.length} | Processing ${file.name}`, {
							id: IMPORT_TOAST_ID
						});
						await yieldToUI();
					}

					try {
						const metadata = await parseMetadataFast(file);
						const picture = metadata?.common.picture?.[0];
						const cover = picture
							? new Blob([picture.data.slice()], { type: picture.format })
							: blob;
						const track: Song = {
							id: uuidv4(),
							title: metadata?.common.title || file.name.split('.').slice(0, -1).join('.'),
							artist: metadata?.common.artist || 'Unknown Artist',
							album: metadata?.common.album || 'Unknown Album',
							year: metadata?.common.year || 0,
							genre: metadata?.common.genre
								? Array.isArray(metadata.common.genre)
									? metadata.common.genre[0]
									: metadata.common.genre
								: 'Unknown Genre',
							duration: metadata?.format.duration || 0,
							image: cover,
							trackNumber: metadata?.common.track?.no ?? 0,
							disk: metadata?.common.disk?.no ?? 0,
							ext: file.name.split('.').pop() || 'mp3',
							fileName: file.name
						};

						const album: Album = {
							id: uuidv4(),
							name: metadata?.common.album || 'Unknown Album',
							artist: metadata?.common.artist || 'Unknown Artist',
							year: metadata?.common.year || 0,
							genre: metadata?.common.genre
								? Array.isArray(metadata.common.genre)
									? metadata.common.genre[0]
									: metadata.common.genre
								: 'Unknown Genre',
							image: cover
						};

						const artist: Artist = {
							id: uuidv4(),
							name: metadata?.common.artist || 'Unknown Artist'
						};

						if (await OPFS.hasTrack(track.title, track.artist)) {
							skippedCount++;
							continue;
						}

						try {
							await OPFS.addFile(track.id, file);
							if (!(await OPFS.addTrack(track))) {
								await OPFS.discardImportedTrack(track);
								skippedCount++;
								continue;
							}
							await OPFS.addAlbum(album, track.id);
							await OPFS.addArtist(artist, track.id, track.album);
						} catch (error) {
							await OPFS.discardImportedTrack(track).catch(() => {});
							throw error;
						}
						addedIds.push(track.id);
						successCount++;
						if (successCount % IMPORT_FLUSH_EVERY === 0) {
							await OPFS.flushImport();
						}
					} catch (error) {
						console.error(`Error processing file ${file.name}:`, error);
						if (error instanceof DOMException && error.name === 'QuotaExceededError') {
							toast.error('Storage is full. Free space on this device and try again.');
							break;
						}
					}
				}
			} finally {
				await OPFS.endImport();
			}
			statsManager.recordLibraryAddMany(addedIds);
			await refreshLibrary();
			const tracks = await OPFS.get().tracks();
			statsManager.setLibrarySize(tracks.length);
			OPFS.rememberLibrarySize(tracks.length);
			const skippedNote =
				skippedCount > 0
					? `, ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped`
					: '';
			if (successCount > 0) {
				toast.success(`Library added successfully! (${successCount} tracks${skippedNote})`);
				await OPFS.requestPersistentStorage();
			} else if (skippedCount > 0) {
				toast.info(
					`All ${skippedCount} track${skippedCount === 1 ? ' is' : 's are'} already in your library.`
				);
			} else {
				toast.error('No tracks could be processed. Please try again.');
			}
		};

		await handleFiles(selected);
	} catch (error) {
		console.error('Error in createLibrary:', error);
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				return;
			}
			toast.error(`Failed to create library: ${error.message}`);
		} else {
			toast.error('Failed to create library. Please try again.');
		}
	}
}

async function collectFilesFromDirectoryHandle(
	dirHandle: FileSystemDirectoryHandle
): Promise<File[]> {
	const files: File[] = [];

	if (UserSettings.preferences.jellyfinMode) {
		for await (const entry of dirHandle.values()) {
			if (entry.kind === 'directory') {
				const dir = await dirHandle.getDirectoryHandle(entry.name);

				let isArtistDir = false;
				for await (const subEntry of dir.values()) {
					if (subEntry.kind === 'directory') {
						isArtistDir = true;
						break;
					}
				}

				if (isArtistDir) {
					for await (const albumEntry of dir.values()) {
						if (albumEntry.kind === 'directory') {
							await processAlbumDirectory(dir, albumEntry, files);
						}
					}
				} else {
					await processAlbumDirectory(dirHandle, entry, files);
				}
			}
		}
	} else {
		for await (const entry of dirHandle.values()) {
			if (entry.kind === 'file') {
				const file = await entry.getFile();
				files.push(file);
			}
		}
	}

	return files;
}

export async function pickLibraryDirectory(): Promise<File[] | null> {
	if (!isDirectoryPickerSupported()) return null;
	try {
		const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
		return await collectFilesFromDirectoryHandle(dirHandle);
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return null;
		}
		console.error('Directory picker failed:', error);
		toast.error('Could not open the folder picker. Try selecting files instead.');
		return null;
	}
}

async function processAlbumDirectory(
	parentDir: FileSystemDirectoryHandle,
	albumEntry: FileSystemDirectoryHandle,
	files: File[]
) {
	const albumDir = await parentDir.getDirectoryHandle(albumEntry.name);

	let isMultiDisc = false;
	for await (const subEntry of albumDir.values()) {
		if (subEntry.kind === 'directory' && subEntry.name.toLowerCase().includes('disc')) {
			isMultiDisc = true;
			break;
		}
	}
	if (isMultiDisc) {
		for await (const discEntry of albumDir.values()) {
			if (discEntry.kind === 'directory' && discEntry.name.toLowerCase().includes('disc')) {
				const discDir = await albumDir.getDirectoryHandle(discEntry.name);
				for await (const songEntry of discDir.values()) {
					if (songEntry.kind === 'file') {
						const file = await discDir.getFileHandle(songEntry.name);
						files.push(await file.getFile());
					}
				}
			}
		}
	} else {
		for await (const songEntry of albumDir.values()) {
			if (songEntry.kind === 'file') {
				const file = await albumDir.getFileHandle(songEntry.name);
				files.push(await file.getFile());
			}
		}
	}
}
