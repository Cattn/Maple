import { parseBlob } from 'music-metadata';
import { OPFS } from '$lib/opfs';
import { toast } from 'svelte-sonner';
import { v4 as uuidv4 } from 'uuid';
import type { Song } from '$lib/types/song';
import type { Album } from '$lib/types/album';
import type { Artist } from '$lib/types/artist';

declare global {
	//prob fixes annoying ts warnings
	interface Window {
		showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
	}
}

export async function createLibrary(mobileFiles?: FileList): Promise<void> {
	try {
		const sampleImage = await fetch('/placeholder.png');
		const blob = await sampleImage.blob();
		await OPFS.initializeLibrary();

		const input = document.getElementById('files') as HTMLInputElement;

		const handleFiles = async (files: FileList | File[]) => {
			let i = 0;
			for (const file of Array.from(files)) {
				if (file.type.startsWith('audio/')) {
					i++;
					toast(`${i} of ${files.length} | Processing ${file.name}`);
					try {
						const metadata = await parseBlob(file);
						const track: Song = {
							id: uuidv4(),
							title: metadata.common.title || file.name.split('.').slice(0, -1).join('.'),
							artist: metadata.common.artist || 'Unknown Artist',
							album: metadata.common.album || 'Unknown Album',
							year: metadata.common.year || 0,
							genre: Array.isArray(metadata.common.genre)
								? metadata.common.genre[0]
								: metadata.common.genre || 'Unknown Genre',
							duration: metadata.format.duration || 0,
							image: metadata.common.picture
								? new Blob([metadata.common.picture[0].data], {
										type: metadata.common.picture[0].format
									})
								: blob,
							trackNumber: metadata.common.track?.no ?? 0,
							disk: metadata.common.disk?.no ?? 0,
							ext: file.name.split('.').pop() || 'mp3',
							fileName: file.name
						};

						const album: Album = {
							id: uuidv4(),
							name: metadata.common.album || 'Unknown Album',
							artist: metadata.common.artist || 'Unknown Artist',
							year: metadata.common.year || 0,
							genre: Array.isArray(metadata.common.genre)
								? metadata.common.genre[0]
								: metadata.common.genre || 'Unknown Genre',
							image: metadata.common.picture
								? new Blob([metadata.common.picture[0].data], {
										type: metadata.common.picture[0].format
									})
								: blob
						};

						const artist: Artist = {
							id: uuidv4(),
							name: metadata.common.artist || 'Unknown Artist'
						};

						await OPFS.addAlbum(album, track.id);
						await OPFS.addArtist(artist, track.id, track.album);
						await OPFS.addTrack(track);
						await OPFS.addFile(track.id, file, track);
					} catch (error) {
						console.error(`Error processing file ${file.name}:`, error);
					}
				}
			}
			toast.success(`Library added successfully!`);
		};

		if (window.showDirectoryPicker && !mobileFiles) {
			const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
			const files: File[] = [];

			for await (const entry of dirHandle.values()) {
				if (entry.kind === 'file') {
					const file: File = await entry.getFile();
					files.push(file);
				}
			}

			handleFiles(files);
		} else {
			if (mobileFiles) {
				handleFiles(mobileFiles);
			} else if (input.files) {
				handleFiles(input.files);
			}
		}
	} catch (error) {
		console.error('Error in createLibrary:', error);
		toast.error('Failed to create library');
	}
}
