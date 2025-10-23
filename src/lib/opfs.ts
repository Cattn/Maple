import type { Album, Artist, Playlist, Song } from '$lib/types';
import { dir, file, write } from 'opfs-tools';
import { toast } from 'svelte-sonner';
export class OPFS {
	private static albumsCache: Album[] | null = null;
	private static artistsCache: Artist[] | null = null;
	private static tracksCache: Song[] | null = null;
	private static playlistsCache: Playlist[] | null = null;
	private static SERVER = 'https://api.maple.music';

	private static async getCache<T>(path: string, cache: T[] | null): Promise<T[]> {
		if (cache) return cache;
		try {
			const content = await file(path).text();
			const json = JSON.parse(content);
			return Array.isArray(json) ? json : [];
		} catch {
			return [];
		}
	}

	private static async writeCache<T>(path: string, cache: T[]): Promise<void> {
		await write(path, JSON.stringify(cache));
	}

	public static async initializeLibrary() {
		const paths = ['albums', 'artists', 'tracks', 'playlists', 'config', 'images'].map(
			(p) => `/${p}`
		);
		const files = [
			{ path: '/playlists/playlists.json', content: '' },
			{ path: '/albums/albums.json', content: '' },
			{ path: '/artists/artists.json', content: '' },
			{ path: '/config/config.json', content: '' },
			{ path: '/tracks/tracks.json', content: '' }
		];

		await Promise.all([
			...paths.map((p) =>
				dir(p)
					.exists()
					.then((exists) =>
						exists
							? Promise.resolve()
							: dir(p)
									.create()
									.then(() => Promise.resolve())
					)
			),
			...files.map((f) =>
				file(f.path)
					.exists()
					.then((exists) => (exists ? Promise.resolve() : write(f.path, f.content)))
			)
		]);
	}

	public static async ifExists(path: string) {
		const exists = await dir(path).exists();
		return exists;
	}

	public static async ls(path: string) {
		const files = await dir(path).children();
		return files;
	}

	public static async clearLibrary() {
		toast('Clearing library...');
		const paths = ['albums', 'artists', 'tracks', 'playlists', 'config', 'images'].map(
			(p) => `/${p}`
		);
		await Promise.all(
			paths.map((p) =>
				dir(p)
					.remove()
					.then(() => Promise.resolve())
			)
		);
		toast('Library cleared');
	}

	public static async getImageUrl(path: string) {
		const response = await OPFS.get().image(path);
		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer]);
		return URL.createObjectURL(blob);
	}

	public static async addAlbum(album: Album, id: string) {
		if (!this.albumsCache) {
			this.albumsCache = await this.getCache('/albums/albums.json', this.albumsCache);
		}

		const imageFileName = `${album.id}.image`;
		const imageArrayBuffer = await new Response(album.image).arrayBuffer();
		await write(`/images/${imageFileName}`, imageArrayBuffer);
		album.image = `/images/${imageFileName}`;

		if (!album.tracks) {
			album.tracks = [];
		}
		album.tracks.push(id);

		if (!this.albumsCache.some((a) => a.name === album.name)) {
			this.albumsCache.push(album);
			await this.writeCache('/albums/albums.json', this.albumsCache);
		} else {
			const existingAlbum = this.albumsCache.find((a) => a.name === album.name);
			if (existingAlbum) {
				if (!existingAlbum.tracks) {
					existingAlbum.tracks = [];
				}
				existingAlbum.tracks.push(id);
				await this.writeCache('/albums/albums.json', this.albumsCache);
			}
		}
	}

	public static async addArtist(artist: Artist, id: string, album: string) {
		if (!this.artistsCache) {
			this.artistsCache = await this.getCache('/artists/artists.json', this.artistsCache);
		}

		if (!artist.tracks) {
			artist.tracks = [];
		}
		artist.tracks.push(id);

		if (!artist.albums) {
			artist.albums = [];
		}
		artist.albums.push(album);

		if (!this.artistsCache.some((a) => a.name === artist.name)) {
			this.artistsCache.push(artist);
			await this.writeCache('/artists/artists.json', this.artistsCache);
		} else {
			const existingArtist = this.artistsCache.find((a) => a.name === artist.name);
			if (existingArtist) {
				if (!existingArtist.tracks) {
					existingArtist.tracks = [];
				}
				existingArtist.tracks.push(id);
				if (!existingArtist.albums) {
					existingArtist.albums = [];
				}
				existingArtist.albums.push(album);
				await this.writeCache('/artists/artists.json', this.artistsCache);
			}
		}
	}

	public static async addFile(id: string, file: File, track: Song) {
		const fileContent = await file.arrayBuffer();
		const extension = file.name.split('.').pop();
		await write(`/tracks/${id}.${extension}`, fileContent);
	}

	public static async addTrack(track: Song) {
		if (!this.tracksCache) {
			this.tracksCache = await this.getCache('/tracks/tracks.json', this.tracksCache);
		}

		const imageFileName = `${track.id}.image`;
		const imageArrayBuffer = await new Response(track.image).arrayBuffer();
		await write(`/images/${imageFileName}`, imageArrayBuffer);
		const trackWithImagePath = { ...track, image: `/images/${imageFileName}` };

		if (!this.tracksCache.find((t) => t.title === track.title && t.artist === track.artist)) {
			this.tracksCache.push(trackWithImagePath);
			await this.writeCache('/tracks/tracks.json', this.tracksCache);
		}
	}

	public static async getSong(track: Song) {
		const audioArrayBuffer = await file(`/tracks/${track.id}.${track.ext}`).arrayBuffer();
		return new Response(audioArrayBuffer);
	}

	public static async addPlaylist(playlist: Playlist) {
		if (!this.playlistsCache) {
			this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
		}

		const imageFileName = `${playlist.id}.image`;
		const imageArrayBuffer = await new Response(playlist.image).arrayBuffer();
		await write(`/images/${imageFileName}`, imageArrayBuffer);
		playlist.image = `/images/${imageFileName}`;

		this.playlistsCache.push(playlist);
		await this.writeCache('/playlists/playlists.json', this.playlistsCache);
	}

	public static get = () => ({
		tracks: async () => {
			if (!this.tracksCache) {
				this.tracksCache = await this.getCache('/tracks/tracks.json', this.tracksCache);
			}
			return this.tracksCache;
		},

		track: async (id: string) => {
			if (!this.tracksCache) {
				this.tracksCache = await this.getCache('/tracks/tracks.json', this.tracksCache);
			}
			return this.tracksCache.find((t) => t.id === id);
		},

		albums: async () => {
			if (!this.albumsCache) {
				this.albumsCache = await this.getCache('/albums/albums.json', this.albumsCache);
			}
			return this.albumsCache;
		},

		album: async (id: string) => {
			if (!this.albumsCache) {
				this.albumsCache = await this.getCache('/albums/albums.json', this.albumsCache);
			}
			return this.albumsCache.find((a) => a.id === id);
		},

		artists: async () => {
			if (!this.artistsCache) {
				this.artistsCache = await this.getCache('/artists/artists.json', this.artistsCache);
			}
			return this.artistsCache;
		},

		artist: async (id: string) => {
			if (!this.artistsCache) {
				this.artistsCache = await this.getCache('/artists/artists.json', this.artistsCache);
			}
			return this.artistsCache.find((a) => a.id === id);
		},

		image: async (image: string) => {
			const imageArrayBuffer = await file(`${image}`).arrayBuffer();
			return new Response(imageArrayBuffer);
		},

		playlists: async () => {
			if (!this.playlistsCache) {
				this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
			}
			return this.playlistsCache;
		},

		playlist: async (id: string) => {
			if (!this.playlistsCache) {
				this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
			}
			return this.playlistsCache.find((p) => p.id === id);
		}
	});

	public static album = () => ({
		edit: async (album: Album) => {
			if (!this.albumsCache) {
				this.albumsCache = await this.getCache('/albums/albums.json', this.albumsCache);
			}
			const index = this.albumsCache.findIndex((a) => a.id === album.id);
			if (index !== -1) {
				if (album.image instanceof Blob) {
					const imageFileName = `${album.id}.image`;
					const imageArrayBuffer = await new Response(album.image).arrayBuffer();
					await write(`/images/${imageFileName}`, imageArrayBuffer);
					album.image = `/images/${imageFileName}`;
				}
				this.albumsCache[index] = album;
				await this.writeCache('/albums/albums.json', this.albumsCache);
			}
		},

		delete: async (album: Album) => {
			if (!this.albumsCache) {
				this.albumsCache = await this.getCache('/albums/albums.json', this.albumsCache);
			}
			const index = this.albumsCache.findIndex((a) => a.id === album.id);
			if (index !== -1) {
				this.albumsCache.splice(index, 1);
				await this.writeCache('/albums/albums.json', this.albumsCache);
			}
		}
	});

	public static async downloadFile(path: string) {
		const fileArrayBuffer = await file(path).arrayBuffer();
		let fileName = await file(path).name;
		let returnArray = [fileName, new Response(fileArrayBuffer)];
		return returnArray;
	}

	public static artist = () => ({
		edit: async (artist: Artist) => {
			if (!this.artistsCache) {
				this.artistsCache = await this.getCache('/artists/artists.json', this.artistsCache);
			}
			const index = this.artistsCache.findIndex((a) => a.id === artist.id);
			if (index !== -1) {
				if (artist.image instanceof Blob) {
					const imageFileName = `${artist.id}.image`;
					const imageArrayBuffer = await new Response(artist.image).arrayBuffer();
					await write(`/images/${imageFileName}`, imageArrayBuffer);
					artist.image = `/images/${imageFileName}`;
				}
				this.artistsCache[index] = artist;
				await this.writeCache('/artists/artists.json', this.artistsCache);
			}
		},

		delete: async (artist: Artist) => {
			if (!this.artistsCache) {
				this.artistsCache = await this.getCache('/artists/artists.json', this.artistsCache);
			}
			const index = this.artistsCache.findIndex((a) => a.id === artist.id);
			if (index !== -1) {
				this.artistsCache.splice(index, 1);
				await this.writeCache('/artists/artists.json', this.artistsCache);
			}
		}
	});

	public static playlist = () => ({
		edit: async (playlist: Playlist) => {
			if (!this.playlistsCache) {
				this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
			}
			const index = this.playlistsCache.findIndex((p) => p.id === playlist.id);
			if (index !== -1) {
				if (playlist.image instanceof Blob) {
					const imageFileName = `${playlist.id}.image`;
					const imageArrayBuffer = await new Response(playlist.image).arrayBuffer();
					await write(`/images/${imageFileName}`, imageArrayBuffer);
					playlist.image = `/images/${imageFileName}`;
				}
				this.playlistsCache[index] = playlist;
				await this.writeCache('/playlists/playlists.json', this.playlistsCache);
			}
		},

		delete: async (playlist: Playlist) => {
			if (!this.playlistsCache) {
				this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
			}
			const index = this.playlistsCache.findIndex((p) => p.id === playlist.id);
			if (index !== -1) {
				this.playlistsCache.splice(index, 1);
				await this.writeCache('/playlists/playlists.json', this.playlistsCache);
			}
		},

		remove: async (playlist: Playlist, trackIndex: number) => {
			if (!this.playlistsCache) {
				this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
			}
			const playlistIndex = this.playlistsCache.findIndex((p) => p.id === playlist.id);
			if (playlistIndex !== -1) {
				this.playlistsCache[playlistIndex].tracks?.splice(trackIndex, 1);
				await this.writeCache('/playlists/playlists.json', this.playlistsCache);
			}
		}
	});

	public static track = () => ({
		delete: async (track: Song) => {
			if (!this.tracksCache) {
				this.tracksCache = await this.getCache('/tracks/tracks.json', this.tracksCache);
			}
			const index = this.tracksCache.findIndex((t) => t.id === track.id);
			if (index !== -1) {
				this.tracksCache.splice(index, 1);
				await this.writeCache('/tracks/tracks.json', this.tracksCache);
				await file(`/tracks/${track.id}.${track.ext}`).remove();
				await file(`/images/${track.id}.image`).remove();

				async function removeTrackFromCollections(
					trackId: string,
					collections: any[],
					editFn: (item: any) => Promise<void>
				) {
					for (const item of collections) {
						const index = item.tracks?.findIndex((t: string) => t === trackId);
						if (index !== undefined && index !== -1) {
							item.tracks?.splice(index, 1);
							await editFn(item);
						}
					}
				}

				const trackId = track.id;

				const albums: Album[] = await this.get().albums();
				await removeTrackFromCollections(trackId, albums, this.album().edit);

				const artists: Artist[] = await this.get().artists();
				await removeTrackFromCollections(trackId, artists, this.artist().edit);

				const playlists: Playlist[] = await this.get().playlists();
				await removeTrackFromCollections(trackId, playlists, this.playlist().edit);
			}
		},

		addToPlaylist: async (track: Song, playlist: Playlist) => {
			if (!this.playlistsCache) {
				this.playlistsCache = await this.getCache('/playlists/playlists.json', this.playlistsCache);
			}
			const playlistIndex = this.playlistsCache.findIndex((p) => p.id === playlist.id);

			if (playlistIndex !== -1) {
				this.playlistsCache[playlistIndex].tracks?.push(track.id);
				await this.writeCache('/playlists/playlists.json', this.playlistsCache);
			}
		}
	});
}