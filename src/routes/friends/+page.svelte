<script lang="ts">
	import { Card, Button } from 'm3-svelte';
	import { UserManager } from '$lib/api/UserManager';
	import { friends, isLoggedIn, pendingRequests, title } from '$lib/store';
	import { onMount } from 'svelte';
	import { refreshFriends, refreshRequests } from '$lib/refreshFriends';
	import { goto } from '$app/navigation';

	let selectedFriend = $state('');
	let addingFriend = $state(false);
	const pfpErrors = $state(new Set<string>());

	onMount(async () => {
		title.set('Friends');
		await refreshRequests();
		await refreshFriends();
	});

	async function addFriend() {
		if (!selectedFriend.trim()) return;
		addingFriend = true;
		const user = await UserManager.getUserName(selectedFriend);
		if (user?.id) {
			await UserManager.addFriend(user.id);
			selectedFriend = '';
		}
		addingFriend = false;
	}

	async function acceptRequest(userId: string) {
		await UserManager.acceptRequest(userId);
		await refreshRequests();
		await refreshFriends();
	}

	async function rejectRequest(userId: string) {
		await UserManager.rejectRequest(userId);
	}

	async function removeFriend(friendId: string) {
		await UserManager.removeFriend(friendId);
	}
</script>

<div class="flex w-full justify-center px-4 py-12">
	<div class="flex w-full max-w-4xl flex-col gap-8">
		{#if !$isLoggedIn}
			<div class="flex flex-col items-center justify-center gap-4 py-16">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="64"
					height="64"
					viewBox="0 0 24 24"
					class="text-on-surface-variant"
				>
					<path
						fill="currentColor"
						d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
					/>
				</svg>
				<h1 class="text-2xl font-bold">You're not logged in</h1>
				<p class="text-on-surface-variant text-sm">Login to manage your friends</p>
				<Button variant="filled" onclick={() => goto('/login')}>Login</Button>
			</div>
		{:else}
			<div class="flex flex-col gap-1">
				<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Social</p>
				<h1 class="text-4xl font-black">Friends</h1>
				<p class="text-on-surface-variant text-sm">Manage your friends and friend requests</p>
			</div>

			<section class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Add Friend</p>
					<p class="text-on-surface-variant text-sm">Enter a username to send a friend request</p>
				</div>

				<Card variant="outlined" class="p-6">
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
						<div class="flex items-center gap-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								class="text-primary"
							>
								<path
									fill="currentColor"
									d="M15 14q-.625 0-1.062-.437T13.5 12.5t.438-1.062T15 11t1.063.438t.437 1.062t-.437 1.063T15 14m-6 0q-.625 0-1.062-.437T7.5 12.5t.438-1.062T9 11t1.063.438t.437 1.062t-.437 1.063T9 14m3 8q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"
								/>
							</svg>
						</div>
						<input
							type="text"
							bind:value={selectedFriend}
							placeholder="Enter username"
							class="bg-surface text-on-surface placeholder:text-on-surface-variant/70 ring-outline focus:ring-primary flex-1 rounded-lg px-3 py-2 ring-1 focus:ring-2 focus:outline-none"
						/>
						<Button
							variant="filled"
							onclick={addFriend}
							disabled={addingFriend || !selectedFriend.trim()}
						>
							{#if addingFriend}
								Sending...
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									class="mr-2"
								>
									<path
										fill="currentColor"
										d="M18 14v-3h-3V9h3V6h2v3h3v2h-3v3zm-9-2q-1.65 0-2.825-1.175T5 8t1.175-2.825T9 4t2.825 1.175T13 8t-1.175 2.825T9 12m-8 8v-2.8q0-.85.438-1.562T2.6 14.55q1.55-.775 3.15-1.162T9 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T17 17.2V20z"
									/>
								</svg>
								Add Friend
							{/if}
						</Button>
					</div>
				</Card>
			</section>

			{#if $pendingRequests && $pendingRequests.length > 0}
				<section class="flex flex-col gap-3">
					<div class="flex flex-col gap-1">
						<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">
							Friend Requests
						</p>
						<p class="text-on-surface-variant text-sm">People who want to be your friend</p>
					</div>

					<Card variant="outlined" class="p-6">
						<div class="flex flex-col gap-4">
							{#each $pendingRequests as request}
								{#await UserManager.getUserbyId(request.user_id) then user}
									{#if user}
										<div
											class="bg-surface-container-high flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
										>
											<div class="flex items-center gap-4">
												{#if user.pfp && !pfpErrors.has(user.id)}
													<img
														src={user.pfp}
														alt="Profile"
														class="h-12 w-12 rounded-full object-cover"
														onerror={() => pfpErrors.add(user.id)}
													/>
												{:else}
													<div
														class="bg-primary/20 text-primary flex h-12 w-12 items-center justify-center rounded-full"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="24"
															height="24"
															viewBox="0 0 24 24"
														>
															<path
																fill="currentColor"
																d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
															/>
														</svg>
													</div>
												{/if}
												<div>
													<h3 class="text-on-surface font-semibold">
														{user.name || user.username}
													</h3>
													<p class="text-on-surface-variant text-sm">@{user.username}</p>
												</div>
											</div>
											<div class="flex items-center gap-2">
												<Button variant="filled" onclick={() => acceptRequest(request.user_id)}>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="20"
														height="20"
														viewBox="0 0 24 24"
														class="mr-1"
													>
														<path
															fill="currentColor"
															d="m9 16.2l-3.5-3.5a.984.984 0 0 0-1.4 0a.984.984 0 0 0 0 1.4l4.19 4.19c.39.39 1.02.39 1.41 0L20.3 7.7a.984.984 0 0 0 0-1.4a.984.984 0 0 0-1.4 0z"
														/>
													</svg>
													Accept
												</Button>
												<Button variant="outlined" onclick={() => rejectRequest(request.user_id)}>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="20"
														height="20"
														viewBox="0 0 24 24"
														class="mr-1"
													>
														<path
															fill="currentColor"
															d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59L7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12L5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4"
														/>
													</svg>
													Decline
												</Button>
											</div>
										</div>
									{/if}
								{/await}
							{/each}
						</div>
					</Card>
				</section>
			{/if}

			<section class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Your Friends</p>
					<p class="text-on-surface-variant text-sm">People you're connected with</p>
				</div>

				<Card variant="outlined" class="p-6">
					{#if $friends && $friends.length > 0}
						<div class="flex flex-col gap-4">
							{#each $friends as friend}
								<div
									class="bg-surface-container-high flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div class="flex min-w-0 items-center gap-4">
										{#if friend.pfp && !pfpErrors.has(friend.id)}
											<img
												src={friend.pfp}
												alt="Profile"
												class="h-12 w-12 flex-shrink-0 rounded-full object-cover"
												onerror={() => pfpErrors.add(friend.id)}
											/>
										{:else}
											<div
												class="bg-primary/20 text-primary flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="24"
													height="24"
													viewBox="0 0 24 24"
												>
													<path
														fill="currentColor"
														d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
													/>
												</svg>
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<h3 class="text-on-surface truncate font-semibold">
												{friend.name || friend.username}
											</h3>
											<p class="text-on-surface-variant truncate text-sm">@{friend.username}</p>
											{#if friend.nowPlaying}
												<div class="mt-1 flex items-center gap-2">
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="16"
														height="16"
														viewBox="0 0 24 24"
														class="text-primary flex-shrink-0"
													>
														<path
															fill="currentColor"
															d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
														/>
													</svg>
													<p class="text-on-surface-variant truncate text-xs">
														{friend.nowPlaying.title || 'Unknown Track'} - {friend.nowPlaying
															.artist || 'Unknown Artist'}
													</p>
												</div>
											{/if}
										</div>
									</div>
									<div class="flex flex-shrink-0 items-center gap-2">
										<Button variant="outlined" onclick={() => removeFriend(friend.id)}>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="24"
												height="24"
												viewBox="0 0 24 24"
												><path
													fill="currentColor"
													d="M17 9h4q.425 0 .713.288T22 10t-.288.713T21 11h-4q-.425 0-.712-.288T16 10t.288-.712T17 9m-8 3q-1.65 0-2.825-1.175T5 8t1.175-2.825T9 4t2.825 1.175T13 8t-1.175 2.825T9 12m-8 6v-.8q0-.85.438-1.562T2.6 14.55q1.55-.775 3.15-1.162T9 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T17 17.2v.8q0 .825-.587 1.413T15 20H3q-.825 0-1.412-.587T1 18m2 0h12v-.8q0-.275-.137-.5t-.363-.35q-1.35-.675-2.725-1.012T9 15t-2.775.338T3.5 16.35q-.225.125-.363.35T3 17.2zm6-8q.825 0 1.413-.587T11 8t-.587-1.412T9 6t-1.412.588T7 8t.588 1.413T9 10m0 8"
												/></svg
											>
											Remove
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center gap-2 py-8">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="48"
								height="48"
								viewBox="0 0 640 512"
								class="text-on-surface-variant"
							>
								<path
									fill="currentColor"
									d="M192 256c61.9 0 112-50.1 112-112S253.9 32 192 32S80 82.1 80 144s50.1 112 112 112m76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C51.6 288 0 339.6 0 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2M480 256c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96s43 96 96 96m48 32h-3.8c-13.9 4.8-28.6 8-44.2 8s-30.3-3.2-44.2-8H432c-20.4 0-39.2 5.9-55.7 15.4c24.4 26.3 39.7 61.2 39.7 99.8v38.4c0 2.2-.5 4.3-.6 6.4H592c26.5 0 48-21.5 48-48c0-61.9-50.1-112-112-112"
								/>
							</svg>
							<p class="text-on-surface-variant text-sm">No friends yet</p>
							<p class="text-on-surface-variant text-xs">Add someone using their username above</p>
						</div>
					{/if}
				</Card>
			</section>
		{/if}
	</div>
</div>
