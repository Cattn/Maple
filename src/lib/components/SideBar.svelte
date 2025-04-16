<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	
	import {
		Home,
		Music,
		Mic2,
		Radio,
		ListMusic,
		Users,
		Heart,
		PlusCircle,
		Settings,
		HelpCircle,
		Info,
		ChevronDown,
		ChevronRight,
		ChevronLeft,
		Menu
	} from 'lucide-svelte';
	
	import { Button } from '$lib/components/ui/button/index.js';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	
	export let open = true;
	export let toggleSidebar: () => void = () => open = !open;
	
	// Navigation items
	const mainNavItems = [
		{ href: '/', label: 'Home', icon: Home },
		{ href: '/explore', label: 'Explore', icon: Radio },
		{ href: '/friends', label: 'Friends', icon: Users }
	];
	
	const libraryNavItems = [
		{ href: '/songs', label: 'Songs', icon: Music },
		{ href: '/artists', label: 'Artists', icon: Mic2 },
		{ href: '/albums', label: 'Albums', icon: ListMusic },
		{ href: '/liked', label: 'Liked', icon: Heart }
	];
	
	const otherNavItems = [
		{ href: '/settings', label: 'Settings', icon: Settings },
		{ href: '/help', label: 'Help & Support', icon: HelpCircle },
		{ href: '/about', label: 'About', icon: Info }
	];
	
	// Playlists (will be fetched from the API)
	let playlists: { id: string; name: string; }[] = [];
	let playlistsExpanded = true;
	
	onMount(() => {
		if (browser) {
			// Fetch playlists from the API or local storage
			// This is a placeholder - replace with actual API call
			playlists = [
				{ id: '1', name: 'Favorite Tracks' },
				{ id: '2', name: 'Workout Mix' },
				{ id: '3', name: 'Chill Vibes' },
				{ id: '4', name: 'Party Playlist' },
				{ id: '5', name: 'Road Trip' }
			];
		}
	});
	
	function isActive(href: string): boolean {
		if (href === '/') {
			return $page.url.pathname === href;
		}
		return $page.url.pathname.startsWith(href);
	}
	
	function createPlaylist() {
		// Implement create playlist functionality
		// This is a placeholder
		console.log('Create new playlist');
	}
	
	function togglePlaylistsSection() {
		playlistsExpanded = !playlistsExpanded;
	}
</script>

<aside 
	class="sidebar {open ? 'sidebar-open' : 'sidebar-closed'}"
>
	<div class="sidebar-inner">
		<!-- Toggle button -->
		<div class="sidebar-toggle-container">
			<Button variant="ghost" size="icon" on:click={toggleSidebar} class="sidebar-toggle-button">
				{#if open}
					<ChevronLeft size={18} />
				{:else}
					<Menu size={18} />
				{/if}
			</Button>
		</div>
		
		<!-- Main navigation -->
		<div class="sidebar-section">
			<nav class="sidebar-nav">
				{#each mainNavItems as item}
					<a 
						href={item.href} 
						class="sidebar-link {isActive(item.href) ? 'sidebar-link-active' : ''}"
					>
						<svelte:component this={item.icon} size={20} />
						{#if open}
							<span class="sidebar-link-text">{item.label}</span>
						{:else}
							<Tooltip.Root>
								<Tooltip.Trigger asChild>
									<span class="sr-only">{item.label}</span>
								</Tooltip.Trigger>
								<Tooltip.Content side="right">
									<p>{item.label}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					</a>
				{/each}
			</nav>
		</div>
		
		<!-- Library section -->
		<div class="sidebar-section">
			<div class="sidebar-section-header">
				{#if open}
					<h2 class="sidebar-section-title">Library</h2>
				{/if}
			</div>
			<nav class="sidebar-nav">
				{#each libraryNavItems as item}
					<a 
						href={item.href} 
						class="sidebar-link {isActive(item.href) ? 'sidebar-link-active' : ''}"
					>
						<svelte:component this={item.icon} size={20} />
						{#if open}
							<span class="sidebar-link-text">{item.label}</span>
						{:else}
							<Tooltip.Root>
								<Tooltip.Trigger asChild>
									<span class="sr-only">{item.label}</span>
								</Tooltip.Trigger>
								<Tooltip.Content side="right">
									<p>{item.label}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					</a>
				{/each}
			</nav>
		</div>
		
		<!-- Playlists section -->
		{#if open}
			<div class="sidebar-section">
				<div class="sidebar-section-header">
					<Button variant="ghost" size="sm" class="sidebar-section-toggle" on:click={togglePlaylistsSection}>
						<div class="sidebar-section-title-wrapper">
							<h2 class="sidebar-section-title">Playlists</h2>
							<span class="sidebar-section-icon">
								{#if playlistsExpanded}
									<ChevronDown size={16} />
								{:else}
									<ChevronRight size={16} />
								{/if}
							</span>
						</div>
					</Button>
					
					<Button variant="ghost" size="icon-sm" on:click={createPlaylist} class="sidebar-action-button">
						<PlusCircle size={16} />
					</Button>
				</div>
				
				{#if playlistsExpanded}
					<div class="sidebar-playlist-container" transition:fade={{ duration: 150 }}>
						<ScrollArea class="sidebar-scrollarea">
							<nav class="sidebar-nav sidebar-nav-nested">
								{#each playlists as playlist}
									<a 
										href={`/playlist/${playlist.id}`} 
										class="sidebar-link sidebar-link-nested {isActive(`/playlist/${playlist.id}`) ? 'sidebar-link-active' : ''}"
									>
										<span class="sidebar-link-text">{playlist.name}</span>
									</a>
								{/each}
							</nav>
						</ScrollArea>
					</div>
				{/if}
			</div>
		{:else}
			<div class="sidebar-section">
				<div class="sidebar-section-header">
					<Tooltip.Root>
						<Tooltip.Trigger asChild>
							<Button variant="ghost" size="icon" class="sidebar-section-icon-only">
								<ListMusic size={20} />
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content side="right">
							<p>Playlists</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
			</div>
		{/if}
		
		<!-- Other links -->
		<div class="sidebar-section sidebar-section-bottom">
			<nav class="sidebar-nav">
				{#each otherNavItems as item}
					<a 
						href={item.href} 
						class="sidebar-link {isActive(item.href) ? 'sidebar-link-active' : ''}"
					>
						<svelte:component this={item.icon} size={20} />
						{#if open}
							<span class="sidebar-link-text">{item.label}</span>
						{:else}
							<Tooltip.Root>
								<Tooltip.Trigger asChild>
									<span class="sr-only">{item.label}</span>
								</Tooltip.Trigger>
								<Tooltip.Content side="right">
									<p>{item.label}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					</a>
				{/each}
			</nav>
		</div>
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		background-color: hsl(var(--background));
		border-right: 1px solid hsl(var(--border));
		height: 100vh;
		position: sticky;
		top: 0;
		left: 0;
		z-index: 30;
		overflow: hidden;
		transition: width 0.3s ease-in-out;
	}
	
	.sidebar-open {
		width: 240px;
	}
	
	.sidebar-closed {
		width: 60px;
	}
	
	.sidebar-inner {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 1rem 0.5rem;
	}
	
	.sidebar-toggle-container {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 1rem;
		padding: 0 0.5rem;
	}
	
	.sidebar-toggle-button {
		width: 2rem;
		height: 2rem;
		border-radius: 0.375rem;
	}
	
	.sidebar-section {
		margin-bottom: 1.5rem;
	}
	
	.sidebar-section-bottom {
		margin-top: auto;
		margin-bottom: 1rem;
	}
	
	.sidebar-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	.sidebar-section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
		letter-spacing: 0.05em;
	}
	
	.sidebar-section-title-wrapper {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}
	
	.sidebar-section-toggle {
		width: 100%;
		justify-content: start;
		padding: 0;
		height: auto;
	}
	
	.sidebar-section-icon {
		display: flex;
		align-items: center;
		color: hsl(var(--muted-foreground));
	}
	
	.sidebar-section-icon-only {
		padding: 0.25rem;
		color: hsl(var(--muted-foreground));
	}
	
	.sidebar-action-button {
		color: hsl(var(--muted-foreground));
		width: 1.75rem;
		height: 1.75rem;
	}
	
	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.sidebar-nav-nested {
		padding-left: 0.5rem;
	}
	
	.sidebar-playlist-container {
		padding: 0 0.5rem;
	}
	
	.sidebar-link {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		border-radius: 0.375rem;
		color: hsl(var(--foreground));
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}
	
	.sidebar-link:hover {
		background-color: hsl(var(--accent)/0.1);
	}
	
	.sidebar-link-active {
		background-color: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}
	
	.sidebar-link-active:hover {
		background-color: hsl(var(--accent)/0.9);
	}
	
	.sidebar-link-text {
		margin-left: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.sidebar-link-nested {
		padding-left: 0.75rem;
		font-size: 0.8125rem;
	}
	
	.sidebar-scrollarea {
		height: 10rem;
	}
	
	/* Custom scrollbar for webkit browsers */
	.sidebar-inner::-webkit-scrollbar {
		width: 4px;
	}
	
	.sidebar-inner::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.sidebar-inner::-webkit-scrollbar-thumb {
		background: hsl(var(--muted));
		border-radius: 2px;
	}
	
	.sidebar-inner::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground));
	}
</style>
