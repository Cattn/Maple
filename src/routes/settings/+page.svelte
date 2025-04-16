<script lang="ts">
	//@ts-nocheck
	import Button from '$lib/components/ui/button/button.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Textarea } from '$lib/components/ui/textarea';
	import { OPFS } from '$lib/opfs';
	import { Settings } from '$lib/preferences/fetch';
	import UserSettings from '$lib/preferences/usersettings';
	import { title, hideTips } from '$lib/store';
	import { createLibrary } from '$lib/library';
	import { Users } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		FileUp,
		FolderUp,
		Trash2,
		Download,
		FileText,
		Info,
		Settings as SettingsIcon,
		Moon,
		Sun,
		Computer,
		Check
	} from 'lucide-svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as Alert from '$lib/components/ui/alert';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	let preferences = new Settings('preferences');

	let errorText = 'LOG will appear here';
	let devMode = false;
	let showLogging = false;
	let p2p = true;
	let socket = true;

	let deferredPrompt;

	let length = 0;
	async function getLength() {
		length = (await OPFS.ls('/tracks')).length - 1;
		if (length < 0) {
			length = 0;
		}
	}

	let tracks: any[] = [];
	let hasPreviouslyUploadedTracks = true;
	let songs = [];
	let selectedTab = 'upload';
	let theme = 'system';
	let showTips = true;
	let syncWithItunes = false;
	let confirmDeleteOpen = false;

	onMount(async () => {
		getLength();
		findDevice();
		title.set('Settings');
		p2p = UserSettings.preferences.p2p;
		devMode = UserSettings.preferences.devMode;
		showLogging = UserSettings.preferences.showLogging;
		socket = UserSettings.preferences.socket;
		hasPreviouslyUploadedTracks = await OPFS.ifExists('tracks');
		tracks = await OPFS.get().tracks();
		showTips = !$hideTips;
		
		// Get current theme from local storage or default to system
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme) {
			theme = storedTheme;
		}
	});

	let device = 'chrome';
	function findDevice() {
		if (!window.showDirectoryPicker) {
			device = 'ew';
		}
	}
	let dir = '';
	let text = '> ';
	async function send() {
		const lines = text.split('\n');
		const newText = lines[lines.length - 1].substring(dir.length + 2);
		if (newText.startsWith('ls')) {
			let selectedDir = '';
			let subdir = newText.split(' ')[1] || '';
			if (subdir.startsWith('/')) {
				subdir = subdir.substring(1);
			}
			if (!subdir.endsWith('/') && subdir !== '') {
				subdir = subdir + '/';
			}
			if (dir === '' && subdir === '') {
				selectedDir = '/';
			} else if (dir === '') {
				selectedDir = subdir;
			} else {
				selectedDir = dir + subdir;
			}

			const ls = await OPFS.ls(selectedDir);
			let names = [];
			ls.forEach((file) => {
				names.push(file.name);
			});

			if (names.length === 0) {
				text += `No files found in ${selectedDir}\n${dir}> `;
			} else {
				text += `${names.join('\n')}\n${dir}> `;
			}
		} else if (newText == 'clear') {
			await clearLibrary();
			text += 'Library cleared\n' + dir + '> ';
			getLength();
		} else if (newText == 'exit') {
			text = dir + '> ';
		} else if (newText.startsWith('help')) {
			let helpCmd = newText.split(' ')[1] || '';
			text += '\n';
			if (helpCmd == 'ls') {
				text +=
					"This command lists the files in the selected directory, or if left blank, the current directory: 'ls (directory)'\n" +
					dir +
					'> ';
			} else if (helpCmd == 'clear') {
				text += "This command clears the library. Use with caution: 'clear'\n" + dir + '> ';
			} else if (helpCmd == 'exit') {
				text += "This command clears the terminal: 'exit'\n" + dir + '> ';
			} else if (helpCmd == 'import') {
				text += "This command imports a library from your computer: 'import'\n" + dir + '> ';
			} else if (helpCmd == 'cd') {
				text +=
					"This command changes the current directory to the specified directory: 'cd [directory]'\n" +
					dir +
					'> ';
			} else if (helpCmd == 'download') {
				text +=
					"This command downloads a file from the library: 'download [filePath]'\n" + dir + '> ';
			} else if (helpCmd == 'help') {
				text +=
					"This command lists the available commands, and information about them: 'help [command]'\n" +
					dir +
					'> ';
			} else {
				text += 'Welcome to the OPFS CLI!\n';
				text +=
					"Commands: ls, clear, exit, import, cd, download, help\n For more information, type 'help [command]'\n" +
					dir +
					'> ';
			}
		} else if (newText == 'import') {
			await createLibrary();
			text += 'Library imported\n' + dir + '> ';
		} else if (newText.startsWith('cd')) {
			dir = newText.split(' ')[1];
			if (!dir.startsWith('/')) {
				dir = '/' + dir;
			}
			if (!dir.endsWith('/')) {
				dir = dir + '/';
			}
			text += '\n' + dir + '> ';
		} else if (newText.startsWith('download')) {
			let selectedDir = '';
			let subdir = newText.split(' ')[1] || '';
			if (!subdir.startsWith('/')) {
				subdir = '/' + subdir;
			}
			if (dir === '' && subdir === '') {
				selectedDir = '/';
			} else if (dir === '') {
				selectedDir = subdir;
			} else {
				selectedDir = dir + subdir;
			}

			const fileObj = await OPFS.downloadFile(selectedDir);
			const file = fileObj[1];
			const fileName = fileObj[0];
			let type = file.type;
			file.text().then((text) => {
				const blob = new Blob([text], { type });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = fileName;
				a.click();
				URL.revokeObjectURL(url);
			});
			text += 'Downloading ' + selectedDir + '...\n' + dir + '> ';
		} else {
			text += 'Command not found\n' + dir + '> ';
		}
	}
	function handleKeydown(event) {
		if (event.key === 'Backspace') {
			if (text.length <= dir.length + 2) {
				event.preventDefault();
			}
		}
		if (event.key === 'Enter') {
			if (text.length > 2) {
				send();
			} else {
				event.preventDefault();
			}
		}
	}

	function clearLibrary() {
		OPFS.clearLibrary();
		localStorage.clear();
		getLength();
	}

	function updatePrefs() {
		preferences.set('p2p', p2p);
		preferences.set('devMode', devMode);
		preferences.set('showLogging', showLogging);
		preferences.set('socket', socket);
		toast.success('Settings updated', {
			action: {
				label: 'Refresh now?',
				onClick: () => {
					window.location.reload();
				}
			}
		});
	}

	async function handleFilesUpload(files: FileList) {
		const fileArray = Array.from(files);
		const filesValidate = fileArray.filter((file) => file.type.includes('audio'));
		
		if (filesValidate.length === 0) {
			toast.error('No audio files found in selection');
			return;
		}
		
		toast.success(`Processing ${filesValidate.length} files...`);
		
		try {
			for (const file of filesValidate) {
				await OPFS.track().add(file);
			}
			toast.success(`Successfully uploaded ${filesValidate.length} files`);
			tracks = await OPFS.get().tracks();
			hasPreviouslyUploadedTracks = true;
		} catch (error) {
			toast.error('Error uploading files: ' + error.message);
		}
	}

	async function handleFolderUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		
		const files = Array.from(input.files);
		const audioFiles = files.filter(file => file.type.includes('audio'));
		
		if (audioFiles.length === 0) {
			toast.error('No audio files found in folder');
			return;
		}
		
		toast.success(`Processing ${audioFiles.length} files from folder...`);
		
		try {
			for (const file of audioFiles) {
				await OPFS.track().add(file);
			}
			toast.success(`Successfully uploaded ${audioFiles.length} files from folder`);
			tracks = await OPFS.get().tracks();
			hasPreviouslyUploadedTracks = true;
		} catch (error) {
			toast.error('Error uploading folder: ' + error.message);
		}
	}

	async function handleDeleteLibrary() {
		try {
			await OPFS.deleteLibrary();
			toast.success('Library deleted successfully');
			tracks = [];
			hasPreviouslyUploadedTracks = false;
			confirmDeleteOpen = false;
		} catch (error) {
			toast.error('Error deleting library: ' + error.message);
		}
	}

	function updateTheme(newTheme: string) {
		theme = newTheme;
		localStorage.setItem('theme', theme);
		
		// Apply theme to document
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else if (theme === 'light') {
			document.documentElement.classList.remove('dark');
		} else {
			// System preference
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
		
		toast.success(`Theme updated to ${theme} mode`);
	}

	function toggleTips() {
		showTips = !showTips;
		hideTips.set(!showTips);
		toast.success(showTips ? 'Tips enabled' : 'Tips disabled');
	}

	function exportLibrary() {
		// Implementation for exporting library
		toast.info('Export functionality coming soon');
	}

	function importLibrary() {
		// Implementation for importing library
		toast.info('Import functionality coming soon');
	}
</script>

<div class="container mx-auto max-w-5xl px-4 py-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-foreground">Settings</h1>
		<p class="mt-1 text-muted-foreground">Manage your music library and application preferences</p>
	</div>

	<Tabs.Root value={selectedTab} class="w-full" onValueChange={(val) => (selectedTab = val)}>
		<Tabs.List class="grid w-full grid-cols-3">
			<Tabs.Trigger value="upload" class="flex items-center justify-center gap-2">
				<FileUp size={16} />
				<span>Upload</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="library" class="flex items-center justify-center gap-2">
				<FileText size={16} />
				<span>Library</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="preferences" class="flex items-center justify-center gap-2">
				<SettingsIcon size={16} />
				<span>Preferences</span>
			</Tabs.Trigger>
		</Tabs.List>

		<div class="mt-6">
			<!-- Upload Tab -->
			<Tabs.Content value="upload" class="space-y-6">
				<Card.Root class="overflow-hidden">
					<Card.Header>
						<Card.Title>Upload Music</Card.Title>
						<Card.Description>
							Add music to your personal library through file or folder upload
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="grid gap-6 sm:grid-cols-2">
							<div>
								<div class="flex flex-col items-center justify-center gap-2 text-center h-48 border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 hover:border-primary/50 transition-colors relative cursor-pointer">
									<FileUp class="h-8 w-8 text-muted-foreground" />
									<div class="space-y-1">
										<p class="text-sm font-medium text-foreground">Drop audio files here</p>
										<p class="text-xs text-muted-foreground">
											Drag and drop your music files, or click to browse
										</p>
									</div>
									<input 
										type="file" 
										accept="audio/*" 
										multiple
										class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
										on:change={(e) => handleFilesUpload(e.target.files)}
									/>
								</div>
							</div>

							<div class="flex flex-col items-center justify-center gap-4">
								<div class="w-full text-center">
									<p class="mb-2 text-sm font-medium text-foreground">Or upload a folder</p>
									<div class="flex justify-center">
										<Label
											for="folder-upload"
											class="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
										>
											<FolderUp size={18} />
											<span>Browse Folders</span>
											<input
												type="file"
												webkitdirectory
												directory
												id="folder-upload"
												class="hidden"
												on:change={handleFolderUpload}
											/>
										</Label>
									</div>
								</div>

								<div class="w-full text-center">
									<p class="mb-2 text-sm font-medium text-foreground">Upload progress</p>
									<div class="h-8 w-full rounded-full bg-secondary p-1">
										<div 
											class="h-full rounded-full bg-primary text-xs font-medium text-primary-foreground" 
											style="width: 0%"
										></div>
									</div>
								</div>
							</div>
						</div>
					</Card.Content>
					<Card.Footer>
						<p class="text-xs text-muted-foreground">
							Supported formats: MP3, FLAC, WAV, AAC, and OGG files.
						</p>
					</Card.Footer>
				</Card.Root>

				{#if hasPreviouslyUploadedTracks}
					<Card.Root>
						<Card.Header>
							<Card.Title>Library Status</Card.Title>
							<Card.Description>
								Your library currently has {tracks.length} track{tracks.length !== 1 ? 's' : ''}
							</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="rounded-lg bg-secondary/30 p-4">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
											<Check size={20} />
										</div>
										<div>
											<p class="font-medium text-foreground">Library is ready</p>
											<p class="text-sm text-muted-foreground">Your music is ready to play</p>
										</div>
									</div>
									<Button variant="outline" href="/tracks">
										Browse Tracks
									</Button>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{:else}
					<Alert.Root>
						<Alert.Title>No music in your library</Alert.Title>
						<Alert.Description>
							Upload some tracks to get started with your personal music library.
						</Alert.Description>
					</Alert.Root>
				{/if}
			</Tabs.Content>

			<!-- Library Tab -->
			<Tabs.Content value="library" class="space-y-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Library Management</Card.Title>
						<Card.Description>
							Manage your existing music library and perform maintenance tasks
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="rounded-lg border bg-card p-4 shadow-sm">
								<div class="mb-3 flex items-center gap-3">
									<div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
										<Download size={18} />
									</div>
									<h3 class="font-medium text-foreground">Export Library</h3>
								</div>
								<p class="mb-3 text-sm text-muted-foreground">
									Export your music library data for backup or transfer
								</p>
								<Button variant="outline" class="w-full" on:click={exportLibrary}>
									Export Data
								</Button>
							</div>

							<div class="rounded-lg border bg-card p-4 shadow-sm">
								<div class="mb-3 flex items-center gap-3">
									<div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
										<FileUp size={18} />
									</div>
									<h3 class="font-medium text-foreground">Import Library</h3>
								</div>
								<p class="mb-3 text-sm text-muted-foreground">
									Import music library data from a previous export
								</p>
								<Button variant="outline" class="w-full" on:click={importLibrary}>
									Import Data
								</Button>
							</div>
						</div>

						<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
							<div class="mb-3 flex items-center gap-3">
								<div class="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/20 text-destructive">
									<Trash2 size={18} />
								</div>
								<h3 class="font-medium text-foreground">Delete Library</h3>
							</div>
							<p class="mb-3 text-sm text-muted-foreground">
								Remove all tracks and playlist data from your library. This action cannot be undone.
							</p>
							<Button variant="destructive" class="w-full" on:click={() => (confirmDeleteOpen = true)}>
								Delete All Data
							</Button>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Library Statistics</Card.Title>
						<Card.Description>Overview of your music collection</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="grid gap-4 sm:grid-cols-3">
							<div class="rounded-lg bg-secondary/30 p-4 text-center">
								<p class="text-xl font-bold text-foreground">{tracks.length}</p>
								<p class="text-sm text-muted-foreground">Total Tracks</p>
							</div>

							<div class="rounded-lg bg-secondary/30 p-4 text-center">
								<p class="text-xl font-bold text-foreground">
									{new Set(tracks.map((t) => t.artist)).size}
								</p>
								<p class="text-sm text-muted-foreground">Artists</p>
							</div>

							<div class="rounded-lg bg-secondary/30 p-4 text-center">
								<p class="text-xl font-bold text-foreground">
									{new Set(tracks.map((t) => t.album)).size}
								</p>
								<p class="text-sm text-muted-foreground">Albums</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>

			<!-- Preferences Tab -->
			<Tabs.Content value="preferences" class="space-y-6">
				<Card.Root>
					<Card.Header>
						<Card.Title>Appearance</Card.Title>
						<Card.Description>Customize how the application looks</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-6">
						<div class="space-y-2">
							<Label for="theme">Theme</Label>
							<div class="grid grid-cols-3 gap-2">
								<Button
									variant={theme === 'light' ? 'default' : 'outline'}
									class="flex flex-col items-center justify-center gap-2 py-3"
									on:click={() => updateTheme('light')}
								>
									<Sun size={18} />
									<span class="text-xs">Light</span>
								</Button>

								<Button
									variant={theme === 'dark' ? 'default' : 'outline'}
									class="flex flex-col items-center justify-center gap-2 py-3"
									on:click={() => updateTheme('dark')}
								>
									<Moon size={18} />
									<span class="text-xs">Dark</span>
								</Button>

								<Button
									variant={theme === 'system' ? 'default' : 'outline'}
									class="flex flex-col items-center justify-center gap-2 py-3"
									on:click={() => updateTheme('system')}
								>
									<Computer size={18} />
									<span class="text-xs">System</span>
								</Button>
							</div>
						</div>

						<div class="flex items-center justify-between rounded-lg border p-4">
							<div class="space-y-0.5">
								<Label class="text-base">Show Tips</Label>
								<p class="text-sm text-muted-foreground">
									Display helpful tips throughout the application
								</p>
							</div>
							<Switch checked={showTips} on:change={toggleTips} />
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Advanced Settings</Card.Title>
						<Card.Description>Configure additional application settings</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="flex items-center justify-between rounded-lg border p-4">
							<div class="space-y-0.5">
								<Label class="text-base">iTunes Sync</Label>
								<p class="text-sm text-muted-foreground">
									Synchronize with your iTunes library (experimental)
								</p>
							</div>
							<Switch checked={syncWithItunes} on:change={() => (syncWithItunes = !syncWithItunes)} />
						</div>

						<div class="rounded-lg border p-4">
							<Label for="cache-limit" class="mb-2 block text-base">Cache Limit</Label>
							<p class="mb-3 text-sm text-muted-foreground">
								Set the maximum cache size for offline playback
							</p>
							<div class="flex items-center gap-2">
								<Input id="cache-limit" type="number" value="1000" min="100" step="100" />
								<span class="text-sm font-medium text-muted-foreground">MB</span>
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>About</Card.Title>
						<Card.Description>Information about this application</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="rounded-lg bg-secondary/30 p-4">
							<div class="mb-4 flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
									<Info size={20} />
								</div>
								<div>
									<h3 class="font-medium text-foreground">Maple Music Player</h3>
									<p class="text-sm text-muted-foreground">v1.0.0</p>
								</div>
							</div>
							<p class="text-sm text-muted-foreground">
								A modern, lightweight web-based music player for your personal library. Developed with SvelteKit and powered by the Origin Private File System (OPFS) API.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</div>
	</Tabs.Root>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={confirmDeleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Library?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently delete all your music files and playlists. This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={handleDeleteLibrary}>
				Delete Library
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<style>
	@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
</style>
