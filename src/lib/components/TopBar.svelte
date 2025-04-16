<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { writable } from 'svelte/store';
	
	import {
		Bell,
		Search,
		Menu,
		X,
		MessageSquare,
		Settings,
		User,
		LogOut,
		Moon,
		Sun,
		ChevronLeft
	} from 'lucide-svelte';
	
	import Button from './ui/button/button.svelte';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuLabel,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	
	// Create theme store
	const currentTheme = writable('dark');
	
	// Mock user manager
	const userManager = {
		logout: () => {
			// Placeholder for actual logout functionality
			console.log('User logged out');
		}
	};

	// Add props for sidebar
	export let sidebarOpen = true;
	export let toggleSidebar: () => void;
	
	let searchQuery = '';
	let showSearch = false;
	let notificationCount = 0;
	let messageCount = 0;
	let username = '';
	let profilePicture = '';
	
	onMount(() => {
		if (browser) {
			// Initialize theme from local storage if available
			const savedTheme = localStorage.getItem('theme');
			if (savedTheme) {
				currentTheme.set(savedTheme);
			}
		}
	});
	
	function handleSearch() {
		if (searchQuery) {
			goto(`/search?q=${encodeURIComponent(searchQuery)}`);
			searchQuery = '';
			showSearch = false;
		}
	}
	
	function toggleSearchBar() {
		showSearch = !showSearch;
		if (!showSearch) {
			searchQuery = '';
		}
	}
	
	function logout() {
		// Implement logout functionality
		userManager.logout();
		goto('/login');
	}
	
	function goToProfile() {
		goto('/settings');
	}
	
	function goToSettings() {
		goto('/settings');
	}
	
	function goToNotifications() {
		goto('/notifications');
	}
	
	function goToMessages() {
		goto('/messages');
	}
	
	function toggleTheme() {
		currentTheme.update(theme => {
			const newTheme = theme === 'dark' ? 'light' : 'dark';
			if (browser) {
				localStorage.setItem('theme', newTheme);
			}
			return newTheme;
		});
	}
</script>

<header class="topbar bg-card/80 backdrop-blur-lg border-b border-border/50 shadow-sm">
	<div class="topbar-container">
		<!-- Mobile menu toggle and sidebar toggle -->
		<div class="topbar-start">
			<Button variant="ghost" size="icon" class="sidebar-toggle-button" on:click={toggleSidebar}>
				{#if sidebarOpen}
					<ChevronLeft size={20} />
				{:else}
					<Menu size={20} />
				{/if}
			</Button>
			
			<!-- App title/logo (visible on larger screens when search is not active) -->
			<div class="app-title hidden md:flex {showSearch ? 'md:hidden' : ''}">
				<h1 class="text-xl font-bold">UMLA</h1>
			</div>
		</div>
		
		<!-- Search bar (expandable on mobile) -->
		<div class="topbar-center">
			{#if showSearch}
				<div class="search-container" in:fade={{ duration: 200 }}>
					<form on:submit|preventDefault={handleSearch} class="search-form">
						<div class="search-input-wrapper">
							<Search size={18} class="search-icon" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search..."
								class="search-input"
								autofocus
							/>
						</div>
						<Button 
							type="submit" 
							variant="ghost" 
							size="icon" 
							class="search-close-button"
							on:click={toggleSearchBar}
						>
							<X size={18} />
						</Button>
					</form>
				</div>
			{:else}
				<div class="hidden md:block">
					<form on:submit|preventDefault={handleSearch} class="search-form-compact">
						<div class="search-input-wrapper-compact">
							<Search size={16} class="search-icon" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search..."
								class="search-input-compact"
							/>
						</div>
					</form>
				</div>
			{/if}
		</div>
		
		<!-- User actions -->
		<div class="topbar-end">
			<!-- Search button (mobile only) -->
			<Button variant="ghost" size="icon" class="action-button md:hidden" on:click={toggleSearchBar}>
				<Search size={20} />
			</Button>
			
			<!-- Theme toggle -->
			<Button variant="ghost" size="icon" class="action-button" on:click={toggleTheme}>
				{#if $currentTheme === 'dark'}
					<Sun size={20} />
				{:else}
					<Moon size={20} />
				{/if}
			</Button>
			
			<!-- Notifications -->
			<Button variant="ghost" size="icon" class="action-button" on:click={goToNotifications}>
				<div class="indicator">
					<Bell size={20} />
					{#if notificationCount > 0}
						<span class="indicator-badge">{notificationCount > 9 ? '9+' : notificationCount}</span>
					{/if}
				</div>
			</Button>
			
			<!-- Messages -->
			<Button variant="ghost" size="icon" class="action-button" on:click={goToMessages}>
				<div class="indicator">
					<MessageSquare size={20} />
					{#if messageCount > 0}
						<span class="indicator-badge">{messageCount > 9 ? '9+' : messageCount}</span>
					{/if}
				</div>
			</Button>
			
			<!-- User dropdown -->
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" class="user-button">
						{#if profilePicture}
							<img src={profilePicture} alt={username} class="user-avatar" />
						{:else}
							<div class="user-avatar-placeholder">
								<User size={16} />
							</div>
						{/if}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>
						<div class="user-info">
							<p class="user-name">{username || 'User'}</p>
							<p class="user-email">user@example.com</p>
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem on:click={goToProfile}>
						<User size={16} class="mr-2" />
						Profile
					</DropdownMenuItem>
					<DropdownMenuItem on:click={goToSettings}>
						<Settings size={16} class="mr-2" />
						Settings
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem on:click={logout}>
						<LogOut size={16} class="mr-2" />
						Logout
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</div>
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		width: 100%;
		height: 60px;
		z-index: 40;
	}
	
	.topbar-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
		padding: 0 1rem;
	}
	
	.topbar-start {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.app-title {
		margin-left: 0.5rem;
	}

	.sidebar-toggle-button {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.topbar-center {
		flex: 1;
		display: flex;
		justify-content: center;
		max-width: 600px;
	}
	
	.search-container {
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: 0.75rem 1rem;
		background-color: hsl(var(--card));
		border-bottom: 1px solid hsl(var(--border));
		z-index: 45;
	}
	
	.search-form {
		display: flex;
		align-items: center;
		width: 100%;
	}
	
	.search-input-wrapper {
		display: flex;
		align-items: center;
		flex: 1;
		background-color: hsl(var(--muted));
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
	}
	
	.search-icon {
		color: hsl(var(--muted-foreground));
		margin-right: 0.5rem;
	}
	
	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: hsl(var(--foreground));
		font-size: 0.875rem;
	}
	
	.search-close-button {
		margin-left: 0.5rem;
	}
	
	.search-form-compact {
		width: 100%;
		max-width: 400px;
	}
	
	.search-input-wrapper-compact {
		display: flex;
		align-items: center;
		background-color: hsl(var(--muted));
		border-radius: 0.5rem;
		padding: 0.375rem 0.75rem;
	}
	
	.search-input-compact {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: hsl(var(--foreground));
		font-size: 0.875rem;
		width: 250px;
	}
	
	.topbar-end {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	
	.action-button {
		width: 40px;
		height: 40px;
		position: relative;
	}
	
	.indicator {
		position: relative;
	}
	
	.indicator-badge {
		position: absolute;
		top: -5px;
		right: -5px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background-color: hsl(var(--destructive));
		color: hsl(var(--destructive-foreground));
		border-radius: 9999px;
		font-size: 0.6rem;
		font-weight: 600;
	}
	
	.user-button {
		width: 40px;
		height: 40px;
		padding: 0;
		border-radius: 9999px;
		overflow: hidden;
	}
	
	.user-avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.user-avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}
	
	.user-info {
		margin: -0.5rem 0;
	}
	
	.user-name {
		font-weight: 600;
		font-size: 0.875rem;
	}
	
	.user-email {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}
</style>
