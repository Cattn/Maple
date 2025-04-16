<script lang="ts">
	import { goto } from '$app/navigation';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tabs from '$lib/components/ui/tabs';
	import { OPFS } from '$lib/opfs';
	import { isSmallDevice, title } from '$lib/store';
	import type { Album } from '$lib/types/album';
	import { ArrowDownZA, ArrowUpAZ, Grid, List, ListFilter, Music, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	// @ts-ignore
	import Lazy from 'svelte-lazy';

	let albums: Album[] = [];
	let searchQuery = '';
	let filteredAlbums: Album[] = [];
	let isLoading = true;

	onMount(async () => {
		try {
			albums = (await OPFS.get().albums()).sort((a, b) => a.name.localeCompare(b.name));
			filteredAlbums = [...albums];
			title.set('Albums');
		} catch (error) {
			console.error('Error loading albums:', error);
			toast.error('Failed to load albums');
		} finally {
			isLoading = false;
		}
	});

	async function getImageUrl(imagePath: string): Promise<string> {
		try {
			const response = await OPFS.get().image(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer]);
			const respons2e = await fetch(URL.createObjectURL(blob));
			if (respons2e.headers.get('Content-Length') === '0') {
				return '';
			}
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error('Error loading image:', error);
			return '';
		}
	}

	let sort = 'title';
	let ascending = true;
	let listType = 'grid';

	function filterAlbums() {
		if (!searchQuery.trim()) {
			filteredAlbums = [...albums];
		} else {
			const query = searchQuery.toLowerCase().trim();
			filteredAlbums = albums.filter(
				(album) =>
					album.name.toLowerCase().includes(query) || album.artist.toLowerCase().includes(query)
			);
		}
		sortAlbums(sort);
	}

	$: searchQuery, filterAlbums();

	async function sortAlbums(s: string) {
		sort = s;
		if (s === 'title') {
			filteredAlbums = filteredAlbums.sort((a, b) =>
				ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
			);
		} else if (s === 'artist') {
			filteredAlbums = filteredAlbums.sort((a, b) =>
				ascending ? a.artist.localeCompare(b.artist) : b.artist.localeCompare(a.artist)
			);
		} else if (s === 'year') {
			filteredAlbums = filteredAlbums.sort((a, b) =>
				ascending ? a.year - b.year : b.year - a.year
			);
		}
	}

	function swapAscending() {
		ascending = !ascending;
		sortAlbums(sort);
	}

	function swapListType(type: string) {
		listType = type;
	}

	let isOpenAlert = false;
	let selectedAlbum: Album | null = null;

	function deleteAlbum() {
		if (selectedAlbum) {
			OPFS.artist().delete(selectedAlbum);
			toast.success(`Album ${selectedAlbum.name} deleted successfully!`);
			albums = albums.filter((a) => a.id !== selectedAlbum?.id);
			filteredAlbums = filteredAlbums.filter((a) => a.id !== selectedAlbum?.id);
			isOpenAlert = false;
		} else {
			console.error('Album not found');
		}
	}

	function openAlert(album: Album) {
		selectedAlbum = album;
		isOpenAlert = true;
	}
</script>

<div class="animate-fade-in px-4 py-4 md:px-6">
	<header class="animate-slide-up">
		<h1 class="mb-2 text-2xl font-semibold text-foreground md:text-3xl">Your Albums</h1>

		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div class="relative w-full md:w-72">
				<div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
					<Search size={18} />
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search albums..."
					class="h-10 w-full rounded-lg bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
				/>
			</div>

			<div class="flex items-center gap-2">
				<Tabs.Root value={listType} onValueChange={swapListType} class="mr-2">
					<Tabs.List class="grid grid-cols-2 bg-secondary/30">
						<Tabs.Trigger
							value="grid"
							class="flex h-9 items-center justify-center data-[state=active]:shadow-none"
						>
							<Grid size={18} />
						</Tabs.Trigger>
						<Tabs.Trigger
							value="list"
							class="flex h-9 items-center justify-center data-[state=active]:shadow-none"
						>
							<List size={18} />
						</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>

				<Button
					variant="outline"
					size="sm"
					class="glass-effect border-0"
					on:click={() => swapAscending()}
				>
					{#if ascending}
						<ArrowUpAZ size={18} />
					{:else}
						<ArrowDownZA size={18} />
					{/if}
				</Button>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger asChild let:builder>
						<Button variant="outline" size="sm" class="glass-effect border-0" builders={[builder]}>
							<ListFilter size={18} />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="glass-effect w-56">
						<DropdownMenu.Label>Sort By</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.RadioGroup bind:value={sort}>
							<DropdownMenu.RadioItem value="title" on:click={() => sortAlbums('title')}
								>Title</DropdownMenu.RadioItem
							>
							<DropdownMenu.RadioItem value="artist" on:click={() => sortAlbums('artist')}
								>Artist</DropdownMenu.RadioItem
							>
							<DropdownMenu.RadioItem value="year" on:click={() => sortAlbums('year')}
								>Year</DropdownMenu.RadioItem
							>
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</header>

	{#if isLoading}
		<div
			class="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:grid-cols-5"
		>
			{#each Array(10) as _, i}
				<div class="animate-pulse">
					<div class="aspect-square w-full rounded-xl bg-secondary/40"></div>
					<div class="mt-3 h-5 w-3/4 rounded bg-secondary/40"></div>
					<div class="mt-2 h-4 w-2/4 rounded bg-secondary/30"></div>
				</div>
			{/each}
		</div>
	{:else if filteredAlbums.length === 0}
		<div class="animate-fade-in flex h-64 flex-col items-center justify-center text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/40">
				<Search size={24} class="text-muted-foreground" />
			</div>
			<h2 class="text-xl font-medium text-foreground">No albums found</h2>
			<p class="mt-2 text-muted-foreground">Try adjusting your search or filters</p>
		</div>
	{:else if listType === 'grid'}
		<div
			class="animate-fade-in my-6 grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:grid-cols-5"
		>
			{#each filteredAlbums as album, i}
				<div
					class="hover-scale animate-slide-up group relative flex flex-col items-start"
					style="animation-delay: {i * 40}ms"
				>
					<a
						class="perspective w-full"
						href={`/album?album=${album.id}`}
						on:contextmenu|preventDefault={() => openAlert(album)}
					>
						<div class="relative h-0 w-full overflow-hidden rounded-xl pb-[100%] shadow-lg">
							{#await getImageUrl(album.image) then image}
								<Lazy height={208} keep={true}>
									{#if image}
										<img
											class="absolute left-0 top-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
											src={image}
											alt={album.name}
										/>
									{:else}
										<div
											class="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-secondary/30"
										>
											<Music size={48} class="text-muted-foreground/50" />
										</div>
									{/if}
								</Lazy>
							{:catch error}
								<div
									class="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-secondary/30"
								>
									<Music size={48} class="text-muted-foreground/50" />
								</div>
							{/await}
							<div
								class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
							></div>
						</div>
					</a>

					<div class="mt-3 flex w-full flex-col items-start space-y-1 px-1">
						<div class="flex w-full items-center justify-between">
							<h2
								class="line-clamp-1 flex-1 text-base font-semibold leading-tight text-foreground transition-colors duration-300 group-hover:text-primary md:text-lg"
							>
								{album.name}
							</h2>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger asChild let:builder>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
										builders={[builder]}
									>
										<ListFilter size={14} class="text-muted-foreground" />
									</Button>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="glass-effect">
									<DropdownMenu.Item on:click={() => openAlert(album)}>
										Delete Album
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>

						<h3
							class="line-clamp-1 w-full text-sm font-normal leading-tight text-muted-foreground md:text-base"
						>
							{album.artist}
						</h3>
						{#if album.year}
							<h4 class="text-xs text-muted-foreground/60">
								{album.year}
							</h4>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="glass-effect my-4 flex flex-col space-y-1 rounded-lg p-2">
			{#each filteredAlbums as album, i}
				<div class="animate-slide-up" style="animation-delay: {i * 30}ms">
					<div
						class="group relative mb-2 flex w-full items-center rounded-xl p-3 transition-all duration-200 hover:bg-secondary/30"
					>
						<a class="flex-grow" href={`/album?album=${album.id}`}>
							<div class="flex w-full items-center gap-4">
								<div
									class="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg md:h-16 md:w-16"
								>
									{#await getImageUrl(album.image) then image}
										<Lazy height={64} keep={true}>
											{#if image}
												<img
													class="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
													src={image}
													alt={album.name}
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center bg-secondary/30">
													<Music size={24} class="text-muted-foreground/50" />
												</div>
											{/if}
										</Lazy>
									{:catch error}
										<div class="flex h-full w-full items-center justify-center bg-secondary/30">
											<Music size={24} class="text-muted-foreground/50" />
										</div>
									{/await}
								</div>
								<div class="flex min-w-0 flex-1 flex-col">
									<h1
										class="line-clamp-1 text-base font-medium text-foreground transition-colors duration-300 group-hover:text-primary"
									>
										{album.name}
									</h1>
									<div class="flex items-center">
										<h2 class="line-clamp-1 text-sm text-muted-foreground">
											{album.artist}
										</h2>
										{#if album.year}
											<span class="mx-2 text-xs text-muted-foreground/40">•</span>
											<h3 class="text-xs text-muted-foreground/60">
												{album.year}
											</h3>
										{/if}
									</div>
								</div>
							</div>
						</a>

						<div class="ml-2 flex items-center">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger asChild let:builder>
									<Button
										class="h-8 w-8 bg-transparent p-0 opacity-0 transition-opacity duration-300 hover:bg-secondary/80 group-hover:opacity-100"
										builders={[builder]}
									>
										<ListFilter size={16} class="text-muted-foreground" />
									</Button>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="glass-effect" align="end">
									<DropdownMenu.Item on:click={() => openAlert(album)}>
										Delete Album
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<AlertDialog.Root bind:open={isOpenAlert}>
	<AlertDialog.Content class="glass-effect border-0">
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this album?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will delete the album, but it will NOT remove the tracks
				contained within it.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={() => deleteAlbum()}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
