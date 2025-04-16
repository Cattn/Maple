<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Music,
		DiscAlbum,
		ListMusic,
		SquareUser,
		Home,
		Settings,
		CirclePlus,
		Users,
		MoreHorizontal,
		X
	} from 'lucide-svelte';
	import { SavedUser } from '$lib/store';
	import { createEventDispatcher } from 'svelte';
	import { slide, fade } from 'svelte/transition';

	let isMenuOpen = false;
	const dispatch = createEventDispatcher();

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
		dispatch('menuToggle', { isOpen: isMenuOpen });
	}

	function handleMenuClick() {
		isMenuOpen = false;
	}

	function handleCloseClick(e: MouseEvent) {
		e.stopPropagation();
		isMenuOpen = false;
	}
</script>

<div
	class="h-15 fixed bottom-0 left-0 right-0 flex items-center justify-around border-t bg-background px-2"
>
	<Button
		class="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-transparent p-2 hover:bg-secondary"
		href="/"
	>
		<Home size={32} class="text-foreground" />
	</Button>

	<Button
		class="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-transparent p-2 hover:bg-secondary"
		href="/tracks"
	>
		<Music size={32} class="text-foreground" />
	</Button>

	<Button
		class="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-transparent p-2 hover:bg-secondary"
		href="/playlists"
	>
		<ListMusic size={32} class="text-foreground" />
	</Button>

	<Button
		class="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-transparent p-2 hover:bg-secondary"
		on:click={toggleMenu}
	>
		<MoreHorizontal size={32} class="text-foreground" />
	</Button>
</div>

{#if isMenuOpen}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
		on:click={toggleMenu}
		transition:fade
	>
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="fixed bottom-10 left-0 right-0 rounded-t-2xl bg-background p-4 shadow-lg"
			transition:slide|local={{ duration: 200 }}
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-foreground">More</h2>
				<Button variant="ghost" size="icon" on:click={handleCloseClick}>
					<X size={24} />
				</Button>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<Button
					class="flex h-24 flex-col items-center justify-center space-y-1 rounded-xl bg-secondary/50 p-4 hover:bg-secondary"
					href="/albums"
					on:click={handleMenuClick}
				>
					<DiscAlbum size={40} class="text-foreground" />
					<span class="text-sm font-medium text-foreground">Albums</span>
				</Button>
				<Button
					class="flex h-24 flex-col items-center justify-center space-y-1 rounded-xl bg-secondary/50 p-4 hover:bg-secondary"
					href="/artists"
					on:click={handleMenuClick}
				>
					<SquareUser size={40} class="text-foreground" />
					<span class="text-sm font-medium text-foreground">Artists</span>
				</Button>
				{#if $SavedUser.id}
					<Button
						class="flex h-24 flex-col items-center justify-center space-y-1 rounded-xl bg-secondary/50 p-4 hover:bg-secondary"
						href="/friends"
						on:click={handleMenuClick}
					>
						<Users size={40} class="text-foreground" />
						<span class="text-sm font-medium text-foreground">Friends</span>
					</Button>
				{/if}
				<Button
					class="flex h-24 flex-col items-center justify-center space-y-1 rounded-xl bg-secondary/50 p-4 hover:bg-secondary"
					href="/playlists?create=true"
					on:click={handleMenuClick}
				>
					<CirclePlus size={40} class="text-foreground" />
					<span class="text-sm font-medium text-foreground">New Playlist</span>
				</Button>
				<Button
					class="flex h-24 flex-col items-center justify-center space-y-1 rounded-xl bg-secondary/50 p-4 hover:bg-secondary"
					href="/settings"
					on:click={handleMenuClick}
				>
					<Settings size={40} class="text-foreground" />
					<span class="text-sm font-medium text-foreground">Settings</span>
				</Button>
			</div>
		</div>
	</div>
{/if}
