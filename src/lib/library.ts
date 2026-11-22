import { embeddedLyrics } from '$lib/lyrics';
import { parseBlob, parseBuffer } from 'music-metadata';
import { readOpusMetadata } from '$lib/opus';
import { IFS, type LinkedFolder } from '$lib/ifs';
import { OPFS } from '$lib/opfs';
import { toast } from 'svelte-sonner';
import { v4 as uuidv4 } from 'uuid';
import { writable } from 'svelte/store';
import type { Song, Album, Artist, SongSource } from '$lib/types';
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

export function isMobileImportPlatform(): boolean {
	return isIOS() || (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent));
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
const SMALL_IMPORT_LIMIT = 20;
const IMPORT_TOAST_ID = 'library-import';

function needsOggDuration(file: File) {
	return (
		/\.(opus|ogg|oga)$/i.test(file.name) ||
		/^(?:audio\/(?:ogg|opus)|application\/ogg)(?:;|$)/i.test(file.type)
	);
}

async function parseMetadataWithTimeout(
	file: File,
	timeoutMs: number = 30000
): Promise<Awaited<ReturnType<typeof parseBlob>> | null> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeoutPromise = new Promise<null>((_, reject) => {
			timeout = setTimeout(() => reject(new Error('Metadata parsing timeout')), timeoutMs);
		});
		const parsePromise = (async () => {
			const ogg = needsOggDuration(file);
			if (ogg) {
				const metadata = await readOpusMetadata(file);
				if (metadata) return metadata;
			}
			return parseBlob(file, {
				duration: ogg,
				skipPostHeaders: false
			});
		})();
		return await Promise.race([parsePromise, timeoutPromise]);
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function parseMetadataFast(file: File) {
	const full = await parseMetadataWithTimeout(file);
	if (full) return full;
	try {
		const headBytes = Math.min(file.size, PARSE_HEAD_BYTES);
		const buf = new Uint8Array(await file.slice(0, headBytes).arrayBuffer());
		const parsed = await parseBuffer(
			buf,
			{ mimeType: file.type || undefined, path: file.name, size: file.size },
			{ duration: false, skipPostHeaders: false }
		);
		if (parsed?.common?.title || parsed?.common?.artist) {
			// A partial Ogg stream can report the duration of just the pages we read.
			if (headBytes < file.size && needsOggDuration(file)) {
				return { ...parsed, format: { ...parsed.format, duration: undefined } };
			}
			return parsed;
		}
	} catch {
		return null;
	}
	return null;
}

type LibraryFile = { file: File; source: SongSource } | { handle: FileSystemFileHandle; source: SongSource };
let pendingImport = Promise.resolve();
type FolderAction = { kind: 'refresh' | 'relink'; id: string };

export function openTrackFile(song: Song): Promise<File | undefined> {
	if (song.source?.kind === 'linked-folder') return IFS.openFile(song.source);
	return OPFS.getSong(song);
}

export async function createLibrary(
	selection?: FileList | File[] | FileSystemDirectoryHandle
): Promise<void> {
	if (selection === undefined) {
		iosImportOpen.set(true);
		return;
	}
	return queueImport('kind' in selection ? selection : Array.from(selection));
}

export async function refreshLinkedFolder(folder: LinkedFolder): Promise<void> {
	const handle = folder.handle as FileSystemDirectoryHandle & {
		requestPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
	};
	if (handle.requestPermission && (await handle.requestPermission({ mode: 'read' })) !== 'granted') {
		throw new Error(`Allow read access to refresh “${handle.name}”.`);
	}
	return queueImport(handle, { kind: 'refresh', id: folder.id });
}

export async function relinkFolder(folder: LinkedFolder): Promise<void> {
	const handle = await pickLibraryFolder();
	if (handle) await queueImport(handle, { kind: 'relink', id: folder.id });
}

function queueImport(selection: File[] | FileSystemDirectoryHandle, action?: FolderAction) {
	pendingImport = pendingImport.then(() => importSelection(selection, action));
	return pendingImport;
}

async function importSelection(selection: File[] | FileSystemDirectoryHandle, action?: FolderAction) {
	try {
		const sampleImage = await fetch('/placeholder.png');
		const blob = await sampleImage.blob();
		await OPFS.initializeLibrary();

		let files: LibraryFile[] | AsyncIterable<LibraryFile>;
		let total: number | undefined;
		const knownPaths = new Set<string>();
		if ('kind' in selection) {
			let folderId: string;
			if (action) {
				folderId = action.id;
				const paths: string[][] = [];
				for (const { source } of await OPFS.get().tracks()) {
					if (source?.kind === 'linked-folder' && source.folderId === folderId) {
						knownPaths.add(JSON.stringify(source.path));
						if (action.kind === 'relink') paths.push(source.path);
					}
				}
				if (action.kind === 'relink') {
					await IFS.linkFolder(selection, { id: folderId, paths });
				}
			} else {
				folderId = await IFS.linkFolder(selection);
			}
			files = IFS.scanFolder(folderId, selection);
		} else {
			files = selection
				.filter(isAudioFile)
				.map((file) => ({
					file,
					source: { kind: 'opfs' }
				}));
			total = files.length;
		}

		let processedCount = 0;
		const mobile = isMobileImportPlatform();
		let successCount = 0;
		let skippedCount = 0;
		const addedIds: string[] = [];
		await OPFS.beginImport();
		try {
			for await (const entry of files) {
				const { source } = entry;
				if (source.kind === 'linked-folder' && knownPaths.has(JSON.stringify(source.path))) {
					skippedCount++;
					continue;
				}
				const file = 'file' in entry ? entry.file : await entry.handle.getFile();
				if (!isAudioFile(file)) continue;
				processedCount++;
				const perSong = mobile || (total ?? processedCount) <= SMALL_IMPORT_LIMIT;
				if (perSong || processedCount === 1 || processedCount === total || processedCount % 8 === 0) {
					const progress = total ? `${processedCount} of ${total}` : processedCount;
					toast(`${progress} | Processing ${file.name}`, {
						id: IMPORT_TOAST_ID
					});
					await yieldToUI();
				}

				try {
					const metadata = await parseMetadataFast(file);
					const duration = metadata?.format.duration ?? 0;
					const picture = metadata?.common.picture?.[0];
					const cover = picture ? new Blob([picture.data.slice()], { type: picture.format }) : blob;
					const track: Song = {
						id: uuidv4(),
						source,
						title: metadata?.common.title || file.name.split('.').slice(0, -1).join('.'),
						artist: metadata?.common.artist || 'Unknown Artist',
						album: metadata?.common.album || 'Unknown Album',
						year: metadata?.common.year || 0,
						genre: metadata?.common.genre
							? Array.isArray(metadata.common.genre)
								? metadata.common.genre[0]
								: metadata.common.genre
							: 'Unknown Genre',
						duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
						image: cover,
						trackNumber: metadata?.common.track?.no ?? 0,
						disk: metadata?.common.disk?.no ?? 0,
						ext: file.name.split('.').pop() || 'mp3',
						fileName: file.name,
						lyrics: metadata ? (embeddedLyrics(metadata.common.lyrics) ?? []) : undefined
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

					if (source.kind === 'opfs' && (await OPFS.hasTrack(track.title, track.artist))) {
						skippedCount++;
						continue;
					}

					try {
						if (source.kind === 'opfs') await OPFS.addFile(track.id, file);
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
					if (source.kind === 'linked-folder') knownPaths.add(JSON.stringify(source.path));
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
			if (processedCount > 0) toast.dismiss(IMPORT_TOAST_ID);
			await OPFS.endImport();
			statsManager.recordLibraryAddMany(addedIds);
			await refreshLibrary();
			const tracks = await OPFS.get().tracks();
			statsManager.setLibrarySize(tracks.length);
			OPFS.rememberLibrarySize(tracks.length);
		}
		const skippedNote =
			skippedCount > 0 ? `, ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped` : '';
		if (successCount > 0) {
			if (action?.kind === 'relink') {
				toast.success(`Folder relinked. Added ${successCount} new ${successCount === 1 ? 'track' : 'tracks'}.`);
			} else {
				toast.success(`Library added successfully! (${successCount} tracks${skippedNote})`);
			}
			await OPFS.requestPersistentStorage();
		} else if (action?.kind === 'relink' && processedCount === 0) {
			toast.success('Folder relinked.');
		} else if (action && processedCount === 0) {
			toast.info('No new tracks found in this folder.');
		} else if (skippedCount > 0) {
			toast.info(
				`All ${skippedCount} track${skippedCount === 1 ? ' is' : 's are'} already in your library.`
			);
		} else if (processedCount === 0) {
			toast.error('No audio files found.');
		} else {
			toast.error('No tracks could be processed. Please try again.');
		}
	} catch (error) {
		console.error('Error in createLibrary:', error);
		if (error instanceof Error && error.name === 'AbortError') return;
		toast.error(
			error instanceof Error
				? `Could not finish adding music: ${error.message}`
				: 'Could not finish adding music.'
		);
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

export async function pickLibraryFolder(): Promise<FileSystemDirectoryHandle | null> {
	if (!isDirectoryPickerSupported()) return null;
	try {
		return await window.showDirectoryPicker();
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return null;
		}
		console.error('Directory picker failed:', error);
		toast.error('Could not open the folder picker. Try selecting files instead.');
		return null;
	}
}

export async function pickLibraryDirectory(): Promise<File[] | null> {
	const handle = await pickLibraryFolder();
	if (!handle) return null;
	try {
		return await collectFilesFromDirectoryHandle(handle);
	} catch (error) {
		console.error('Could not read music folder:', error);
		toast.error('Could not read the folder. Try selecting files instead.');
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
