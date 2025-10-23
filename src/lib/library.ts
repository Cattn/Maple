import { parseBlob } from 'music-metadata';
import { OPFS } from '$lib/opfs';
import { toast } from 'svelte-sonner';
import { v4 as uuidv4 } from 'uuid';
import type { Song, Album, Artist } from '$lib/types';
import UserSettings from '$lib/preferences/usersettings';
import { refreshLibrary } from '$lib/global.svelte';

declare global { //prob fixes annoying ts warnings
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
                            genre: Array.isArray(metadata.common.genre) ? metadata.common.genre[0] : metadata.common.genre || 'Unknown Genre',
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
                            genre: Array.isArray(metadata.common.genre) ? metadata.common.genre[0] : metadata.common.genre || 'Unknown Genre',
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
            await refreshLibrary();
            toast.success(`Library added successfully!`);
        };

        if (window.showDirectoryPicker && !mobileFiles) {
            const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
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

            await handleFiles(files);
        } else {
            if (mobileFiles) {
                await handleFiles(mobileFiles);
            } else if (input.files) {
                await handleFiles(input.files);
            }
        }
    } catch (error) {
        console.error('Error in createLibrary:', error);
        toast.error('Failed to create library');
    }
}

async function processAlbumDirectory(parentDir: FileSystemDirectoryHandle, albumEntry: FileSystemDirectoryHandle, files: File[]) {
    const albumDir = await parentDir.getDirectoryHandle(albumEntry.name);
    
    let isMultiDisc = false;
    for await (const subEntry of albumDir.values()) {
        if (subEntry.kind === 'directory' && subEntry.name.toLowerCase().includes('disc')) {
            isMultiDisc = true;
            break;
        }
    }
    // this should be illegal, but whatever
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