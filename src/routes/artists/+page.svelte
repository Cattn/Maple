<script lang="ts">
	import { goto } from '$app/navigation';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import ContextMenu from '$lib/components/ui/context-menu/context-menu.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { OPFS } from '$lib/opfs';
	import { title } from '$lib/store';
	import type { Artist } from '$lib/types/artist';
	import { ArrowDownZA, ArrowUpAZ, Grid, List, ListFilter, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let artists: Artist[] = [];
	let searchQuery = '';
	let filteredArtists: Artist[] = [];
	let listType = 'grid';

	onMount(async () => {
		artists = (await OPFS.get().artists()).sort((a, b) => a.name.localeCompare(b.name));
		filteredArtists = [...artists];
		title.set('Artists');
	});

	async function getImageUrl(imagePath: string): Promise<string> {
		try {
			const response = await OPFS.get().image(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer]);
			if (blob && blob.size === 0) {
				return '';
			}
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error('Error loading image:', error);
			return '';
		}
	}

	let sort = 'name';
	let ascending = true;

	function filterArtists() {
		if (!searchQuery.trim()) {
			filteredArtists = [...artists];
		} else {
			const query = searchQuery.toLowerCase().trim();
			filteredArtists = artists.filter((artist) => artist.name.toLowerCase().includes(query));
		}
		sortArtists(sort);
	}

	$: searchQuery, filterArtists();

	async function sortArtists(s: string) {
		sort = s;
		if (s === 'name') {
			filteredArtists = filteredArtists.sort((a, b) =>
				ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
			);
		}
	}

	function swapAscending() {
		ascending = !ascending;
		sortArtists(sort);
	}

	function swapListType(type: string) {
		listType = type;
	}

	let isOpenAlert = false;
	let selectedArtist: Artist | null = null;

	function deleteArtist() {
		if (selectedArtist) {
			OPFS.artist().delete(selectedArtist);
			toast.success(`Artist ${selectedArtist.name} deleted successfully!`);
			goto('/artists');
		} else {
			console.error('Artist not found');
		}
	}

	function openAlert(artist: Artist) {
		selectedArtist = artist;
		isOpenAlert = true;
	}
</script>

<div class="animate-fade-in px-4 py-4 md:px-6">
	<header class="animate-slide-up">
		<h1 class="mb-2 text-2xl font-semibold text-foreground md:text-3xl">Your Artists</h1>

		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div class="relative w-full md:w-72">
				<div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
					<Search size={18} />
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search artists..."
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
							<DropdownMenu.RadioItem value="name" on:click={() => sortArtists('name')}
								>Name</DropdownMenu.RadioItem
							>
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
	</header>

	{#if filteredArtists.length === 0}
		<div class="animate-fade-in flex h-64 flex-col items-center justify-center text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/40">
				<Search size={24} class="text-muted-foreground" />
			</div>
			<h2 class="text-xl font-medium text-foreground">No artists found</h2>
			<p class="mt-2 text-muted-foreground">Try adjusting your search</p>
		</div>
	{:else if listType === 'grid'}
		<div
			class="animate-fade-in my-6 grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:grid-cols-5"
		>
			{#each filteredArtists as artist, i}
				<div
					class="hover-scale group relative flex flex-col items-start"
					style="animation-delay: {i * 60}ms"
				>
					{#await getImageUrl(artist.image) then image}
						<ContextMenu type={'artist'} on:delete={() => openAlert(artist)}>
							<a class="w-full" href={`/artist?artist=${artist.id}`}>
								{#if image !== ''}
									<div class="relative h-0 overflow-hidden rounded-full pb-[100%] shadow-lg">
										<img
											class="absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
											src={image}
											alt={artist.name}
										/>
									</div>
								{:else}
									<div
										class="track-backdrop h-0 w-full overflow-hidden rounded-full bg-secondary pb-[100%] shadow-lg"
									>
										<div
											class="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"
										></div>
										<div
											class="absolute inset-0 flex items-center justify-center text-4xl font-bold text-foreground/50"
										>
											{artist.name.charAt(0).toUpperCase()}
										</div>
									</div>
								{/if}
							</a>
						</ContextMenu>
						<div class="mt-3 flex w-full flex-col items-start space-y-1 px-1 text-center">
							<h1
								class="line-clamp-1 w-full text-base font-semibold leading-tight text-foreground transition-colors duration-300 group-hover:text-primary md:text-lg"
							>
								{artist.name}
							</h1>
						</div>
					{:catch error}
						<div class="aspect-square w-full animate-pulse rounded-full bg-muted"></div>
					{/await}
				</div>
			{/each}
		</div>
	{:else}
		<div class="my-4 flex flex-col space-y-1">
			{#each filteredArtists as artist, i}
				<div class="animate-slide-up" style="animation-delay: {i * 30}ms">
					<div
						class="group relative mb-2 flex w-full items-center rounded-xl p-2 transition-all duration-200 hover:bg-secondary/30"
					>
						<a class="flex-grow" href={`/artist?artist=${artist.id}`}>
							<div class="flex w-full items-center gap-4">
								<div
									class="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full md:h-14 md:w-14"
								>
									{#await getImageUrl(artist.image) then image}
										{#if image !== ''}
											<img
												class="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
												src={image}
												alt={artist.name}
											/>
										{:else}
											<div
												class="flex h-full w-full items-center justify-center bg-secondary text-xl font-bold text-foreground/50"
											>
												{artist.name.charAt(0).toUpperCase()}
											</div>
										{/if}
									{:catch error}
										<div class="h-full w-full animate-pulse rounded-full bg-muted"></div>
									{/await}
								</div>
								<div class="flex min-w-0 flex-1 flex-col">
									<h1
										class="line-clamp-1 text-base font-medium text-foreground transition-colors duration-300 group-hover:text-primary"
									>
										{artist.name}
									</h1>
								</div>
							</div>
						</a>

						<div class="ml-2 flex items-center">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger asChild let:builder>
									<Button
										class="h-8 w-8 bg-transparent p-0 opacity-60 transition-opacity duration-300 hover:bg-secondary/80 group-hover:opacity-100"
										builders={[builder]}
									>
										<ListFilter size={16} class="text-muted-foreground" />
									</Button>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="glass-effect w-56">
									<DropdownMenu.Label>Options</DropdownMenu.Label>
									<DropdownMenu.Separator />
									<DropdownMenu.Item on:click={() => openAlert(artist)}>Delete</DropdownMenu.Item>
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
	<AlertDialog.Trigger></AlertDialog.Trigger>
	<AlertDialog.Content class="glass-effect border-0">
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this artist?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will delete the artist, but it will NOT remove the tracks
				associated with this artist.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={() => deleteArtist()}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
