<script lang="ts">
	//@ts-nocheck
	import { UserManager } from '$lib/api/UserManager';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '$lib/components/ui/card/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { friends, isLoggedIn, pendingRequests, title } from '$lib/store';
	import { AudioLines, EllipsisVertical, Music2, UserCheck, UserPlus, UserX, Search, Music, Users, MoreHorizontal, MessageSquare, Share2, Radio, Clock, Bell, BellOff, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { fade, slide } from 'svelte/transition';
	import * as Alert from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import { writable } from 'svelte/store';

	import { OPFS } from '$lib/opfs';
	import type { Playlist } from '$lib/types/playlist';
	import type { Song } from '$lib/types/song';

	let tracks: Song[] = [];
	let playlists: Playlist[] = [];
	let selectedFriend = '';
	let searchQuery = '';
	let selectedTab = 'friends';
	let friendToRemove = null;
	let showRemoveDialog = false;
	
	// Create writable stores for outgoing requests and suggested friends
	const outgoingRequests = writable([
		{
			id: 'out1',
			name: 'Jane Smith',
			username: 'janesmith',
			avatar: null,
			timestamp: '2 hours ago'
		}
	]);
	const suggestedFriends = writable([
		{
			id: 'sug1',
			name: 'Alex Johnson',
			username: 'alexj',
			avatar: null
		},
		{
			id: 'sug2',
			name: 'Sam Taylor',
			username: 'samtaylor',
			avatar: null
		}
	]);

	// Filter friends based on search query
	$: filteredFriends = $friends ? $friends.filter(friend => 
		friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
		friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
	) : [];

	onMount(async () => {
		tracks = (await OPFS.get().tracks()).sort((a, b) => a.title.localeCompare(b.title));
		playlists = await OPFS.get().playlists();
		title.set('Friends');
		filteredFriends = [...$friends];
	});

	async function addFriend() {
		if (!selectedFriend.trim()) {
			toast.error('Please enter a username');
			return;
		}
		
		try {
			const selectedUser = (await UserManager.getUserName(selectedFriend)).id;
			await UserManager.addFriend(selectedUser);
			toast.success('Friend request sent to: ' + selectedFriend);
			selectedFriend = '';
		} catch (error) {
			toast.error('User not found or could not send request');
		}
	}

	function confirmRemoveFriend(friend) {
		friendToRemove = friend;
		showRemoveDialog = true;
	}

	async function removeFriend() {
		if (friendToRemove) {
			try {
				await UserManager.removeFriend(friendToRemove.id);
				toast.success(`Removed ${friendToRemove.username} from friends`);
				showRemoveDialog = false;
				friendToRemove = null;
			} catch (error) {
				toast.error('Could not remove friend');
			}
		}
	}

	function handleSearch() {
		if (!searchQuery.trim()) {
			filteredFriends = [...$friends];
			return;
		}

		const query = searchQuery.toLowerCase();
		filteredFriends = $friends.filter(
			(friend) =>
				friend.name.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query)
		);
	}

	function acceptFriendRequest(request) {
		// Mock implementation
		toast.success(`You are now friends with ${request.name}`);
		
		// Add to friends list
		$friends = [
			...$friends,
			{
				id: request.id,
				name: request.name,
				username: request.username,
				avatar: request.avatar,
				status: 'online'
			}
		];
		
		// Remove from requests
		$pendingRequests = $pendingRequests.filter((req) => req.id !== request.id);
	}

	function rejectFriendRequest(request) {
		// Mock implementation
		toast.info(`Friend request from ${request.name} rejected`);
		
		// Remove from requests
		$pendingRequests = $pendingRequests.filter((req) => req.id !== request.id);
	}

	function cancelFriendRequest(request) {
		// Mock implementation
		toast.info(`Friend request to ${request.name} canceled`);
		
		// Remove from outgoing requests
		$outgoingRequests = $outgoingRequests.filter((req) => req.id !== request.id);
	}

	function sendFriendRequest(friend) {
		// Mock implementation
		toast.success(`Friend request sent to ${friend.name}`);
		
		// Add to outgoing requests
		$outgoingRequests = [
			...$outgoingRequests,
			{
				id: friend.id,
				name: friend.name,
				username: friend.username,
				avatar: friend.avatar,
				timestamp: 'Just now'
			}
		];
		
		// Remove from suggested
		$suggestedFriends = $suggestedFriends.filter((f) => f.id !== friend.id);
	}

	function toggleMute(friend) {
		// Mock implementation
		friend.isMuted = !friend.isMuted;
		toast.success(
			friend.isMuted
				? `Notifications muted for ${friend.name}`
				: `Notifications unmuted for ${friend.name}`
		);
		$friends = [...$friends]; // Trigger reactivity
		filteredFriends = [...filteredFriends]; // Trigger reactivity
	}

	function getStatusClasses(status) {
		switch (status) {
			case 'online':
				return 'bg-green-500';
			case 'offline':
				return 'bg-gray-400';
			case 'away':
				return 'bg-yellow-500';
			case 'listening':
				return 'bg-blue-500';
			default:
				return 'bg-gray-400';
		}
	}

	function getStatusLabel(friend) {
		switch (friend.status) {
			case 'online':
				return 'Online';
			case 'offline':
				return `Offline • Last seen ${friend.lastSeen}`;
			case 'away':
				return 'Away';
			case 'listening':
				return `Listening to ${friend.currentlyPlaying?.title}`;
			default:
				return 'Offline';
		}
	}
</script>

<div class="container mx-auto max-w-4xl px-4 py-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-foreground">Friends</h1>
		<p class="mt-1 text-muted-foreground">Connect and share music with your friends</p>
	</div>

	<div class="mb-6">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="text"
				placeholder="Search friends..."
				class="pl-10 pr-10"
				bind:value={searchQuery}
				on:input={handleSearch}
			/>
			{#if searchQuery}
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					on:click={() => {
						searchQuery = '';
						handleSearch();
					}}
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	<Tabs.Root value={selectedTab} class="w-full" onValueChange={(val) => (selectedTab = val)}>
		<Tabs.List class="grid w-full grid-cols-3">
			<Tabs.Trigger value="friends" class="flex items-center justify-center gap-2">
				<Users size={16} />
				<span>Friends {friends.length > 0 ? `(${friends.length})` : ''}</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="requests" class="flex items-center justify-center gap-2">
				<UserPlus size={16} />
				<span>
					Requests {$pendingRequests.length + $outgoingRequests.length > 0
						? `(${$pendingRequests.length + $outgoingRequests.length})`
						: ''}
				</span>
			</Tabs.Trigger>
			<Tabs.Trigger value="discover" class="flex items-center justify-center gap-2">
				<Search size={16} />
				<span>Discover</span>
			</Tabs.Trigger>
		</Tabs.List>

		<div class="mt-6">
			<!-- Friends Tab -->
			<Tabs.Content value="friends" class="space-y-4">
				{#if filteredFriends.length === 0 && !searchQuery}
					<div in:fade={{ duration: 200 }}>
						<Alert.Root>
							<Users class="h-4 w-4" />
							<Alert.Title>No friends yet</Alert.Title>
							<Alert.Description>
								Add friends to share music and see what they're listening to.
							</Alert.Description>
						</Alert.Root>
					</div>
				{:else if filteredFriends.length === 0 && searchQuery}
					<div in:fade={{ duration: 200 }}>
						<Alert.Root>
							<Search class="h-4 w-4" />
							<Alert.Title>No results found</Alert.Title>
							<Alert.Description>
								No friends match your search for "{searchQuery}".
							</Alert.Description>
						</Alert.Root>
					</div>
				{:else}
					<div class="grid gap-4">
						{#each filteredFriends as friend (friend.id)}
							<div in:fade={{ duration: 200 }}>
								<Card
									class="overflow-hidden transition-all hover:shadow-md"
								>
									<div class="flex items-center justify-between p-4">
										<div class="flex items-center gap-3">
											<div class="relative">
												<div class="h-10 w-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
													{#if friend.avatar}
														<img src={friend.avatar} alt={friend.name} class="h-full w-full object-cover" />
													{:else}
														<span class="text-sm font-medium">{friend.name.substring(0, 2)}</span>
													{/if}
												</div>
												<span
													class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background {getStatusClasses(
														friend.status
													)}"
												></span>
											</div>
											<div>
												<h3 class="font-medium text-foreground">{friend.name}</h3>
												<p class="text-xs text-muted-foreground">{friend.username}</p>
												<p class="mt-0.5 text-xs">
													{#if friend.status === 'listening'}
														<span class="flex items-center gap-1 text-blue-500">
															<Music size={12} />
															{friend.currentlyPlaying?.title} • {friend.currentlyPlaying?.artist}
														</span>
													{:else}
														<span class="text-muted-foreground">
															{getStatusLabel(friend)}
														</span>
													{/if}
												</p>
											</div>
										</div>

										<div class="flex items-center gap-2">
											{#if friend.status === 'listening'}
												<Button
													variant="outline"
													size="sm"
													class="h-8 w-8 rounded-full p-0"
													title="Listen along"
												>
													<Radio size={14} />
													<span class="sr-only">Listen along</span>
												</Button>
											{/if}

											<Button
												variant="outline"
												size="sm"
												class="h-8 w-8 rounded-full p-0"
												title="Message"
											>
												<MessageSquare size={14} />
												<span class="sr-only">Message</span>
											</Button>

											<DropdownMenu.Root>
												<DropdownMenu.Trigger asChild let:builder>
													<Button
														variant="ghost"
														size="sm"
														class="h-8 w-8 rounded-full p-0"
														builders={[builder]}
													>
														<MoreHorizontal size={16} />
														<span class="sr-only">More options</span>
													</Button>
												</DropdownMenu.Trigger>
												<DropdownMenu.Content>
													<DropdownMenu.Label>Actions</DropdownMenu.Label>
													<DropdownMenu.Item class="flex items-center gap-2">
														<Share2 size={14} />
														<span>Share playlist</span>
													</DropdownMenu.Item>
													<DropdownMenu.Item
														class="flex items-center gap-2"
														on:click={() => toggleMute(friend)}
													>
														{#if friend.isMuted}
															<Bell size={14} />
															<span>Unmute notifications</span>
														{:else}
															<BellOff size={14} />
															<span>Mute notifications</span>
														{/if}
													</DropdownMenu.Item>
													<DropdownMenu.Separator />
													<DropdownMenu.Item
														class="flex items-center gap-2 text-destructive focus:text-destructive"
														on:click={() => confirmRemoveFriend(friend)}
													>
														<UserX size={14} />
														<span>Remove friend</span>
													</DropdownMenu.Item>
												</DropdownMenu.Content>
											</DropdownMenu.Root>
										</div>
									</div>

									{#if friend.status === 'listening'}
										<div
											class="flex items-center gap-3 bg-primary/5 px-4 py-2 text-sm text-muted-foreground"
										>
											<Music class="h-4 w-4 text-primary" />
											<span>
												Currently listening to <span class="font-medium text-foreground"
													>{friend.currentlyPlaying?.title}</span
												> by {friend.currentlyPlaying?.artist}
											</span>
										</div>
									{/if}
								</Card>
							</div>
						{/each}
					</div>
				{/if}
			</Tabs.Content>

			<!-- Requests Tab -->
			<Tabs.Content value="requests" class="space-y-6">
				{#if pendingRequests.length > 0}
					<div>
						<h2 class="mb-3 text-lg font-medium text-foreground">Incoming Requests</h2>
						<div class="grid gap-3">
							{#each pendingRequests as request (request.id)}
								<div in:fade={{ duration: 200 }}>
									<Card>
										<div class="flex items-center justify-between p-4">
											<div class="flex items-center gap-3">
												<div class="h-10 w-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
													{#if request.avatar}
														<img src={request.avatar} alt={request.name} class="h-full w-full object-cover" />
													{:else}
														<span class="text-sm font-medium">{request.name.substring(0, 2)}</span>
													{/if}
												</div>
												<div>
													<h3 class="font-medium text-foreground">{request.name}</h3>
													<p class="text-xs text-muted-foreground">{request.username}</p>
													<div class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
														<Clock size={12} />
														<span>Requested {request.timestamp}</span>
													</div>
												</div>
											</div>
											<div class="flex gap-2">
												<Button
													size="sm"
													class="h-9"
													on:click={() => acceptFriendRequest(request)}
												>
													<UserCheck class="mr-1 h-4 w-4" />
													Accept
												</Button>
												<Button
													variant="outline"
													size="sm"
													class="h-9"
													on:click={() => rejectFriendRequest(request)}
												>
													Ignore
												</Button>
											</div>
										</div>
									</Card>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if $outgoingRequests.length > 0}
					<div>
						<h2 class="mb-3 text-lg font-medium text-foreground">Sent Requests</h2>
						<div class="grid gap-3">
							{#each $outgoingRequests as request (request.id)}
								<div in:fade={{ duration: 200 }}>
									<Card>
										<div class="flex items-center justify-between p-4">
											<div class="flex items-center gap-3">
												<div class="h-10 w-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
													{#if request.avatar}
														<img src={request.avatar} alt={request.name} class="h-full w-full object-cover" />
													{:else}
														<span class="text-sm font-medium">{request.name.substring(0, 2)}</span>
													{/if}
												</div>
												<div>
													<h3 class="font-medium text-foreground">{request.name}</h3>
													<p class="text-xs text-muted-foreground">{request.username}</p>
													<div class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
														<Clock size={12} />
														<span>Sent {request.timestamp}</span>
													</div>
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												class="h-9"
												on:click={() => cancelFriendRequest(request)}
											>
												Cancel
											</Button>
										</div>
									</Card>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if $pendingRequests.length === 0 && $outgoingRequests.length === 0}
					<div in:fade={{ duration: 200 }}>
						<Alert.Root>
							<UserPlus class="h-4 w-4" />
							<Alert.Title>No pending requests</Alert.Title>
							<Alert.Description>
								You don't have any incoming or outgoing friend requests at the moment.
							</Alert.Description>
						</Alert.Root>
					</div>
				{/if}
			</Tabs.Content>

			<!-- Discover Tab -->
			<Tabs.Content value="discover" class="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Suggested Friends</CardTitle>
						<CardDescription>People you might want to connect with</CardDescription>
					</CardHeader>
					<CardContent>
						{#if $suggestedFriends.length === 0}
							<div class="py-4 text-center text-muted-foreground">
								No suggestions available at the moment.
							</div>
						{:else}
							<div class="grid gap-4">
								{#each $suggestedFriends as friend (friend.id)}
									<div in:fade={{ duration: 200 }}>
										<div
											class="flex items-center justify-between rounded-lg border p-3"
										>
											<div class="flex items-center gap-3">
												<div class="h-10 w-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
													{#if friend.avatar}
														<img src={friend.avatar} alt={friend.name} class="h-full w-full object-cover" />
													{:else}
														<span class="text-sm font-medium">{friend.name.substring(0, 2)}</span>
													{/if}
												</div>
												<div>
													<h3 class="font-medium text-foreground">{friend.name}</h3>
													<p class="text-xs text-muted-foreground">{friend.username}</p>
												</div>
											</div>
											<Button size="sm" on:click={() => sendFriendRequest(friend)}>
												<UserPlus class="mr-1 h-4 w-4" />
												Add Friend
											</Button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Find Friends</CardTitle>
						<CardDescription>Search for people by username or email</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="flex gap-2">
							<Input
								type="text"
								placeholder="Search by username or email"
								class="flex-1"
							/>
							<Button variant="default">Search</Button>
						</div>
					</CardContent>
				</Card>
			</Tabs.Content>
		</div>
	</Tabs.Root>
</div>

<!-- Confirmation dialog for removing friends -->
<AlertDialog.Root bind:open={showRemoveDialog}>
	<AlertDialog.Content class="sm:max-w-[425px]">
		<AlertDialog.Header>
			<AlertDialog.Title>Remove Friend</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to remove {friendToRemove?.name || friendToRemove?.username} from your friends list?
				This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action on:click={removeFriend}>Remove</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
	
	.inter-normal {
		font-family: 'Inter', serif;
		font-optical-sizing: auto;
		font-weight: 600;
		font-style: normal;
	}
</style>
