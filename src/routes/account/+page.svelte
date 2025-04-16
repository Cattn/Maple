<script lang="ts">
	import { UserManager } from '$lib/api/UserManager';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { SavedUser, title } from '$lib/store';
	import type { User } from '$lib/types/user';
	import { Camera, ChevronRight, Edit2, LogOut, User as UserIcon, Shield, Key, Settings } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let userData: User = {
		username: '',
		id: ''
	};

	let username = '';
	let displayName = '';
	let pfpBlob: Blob | null = null;
	let isEditingProfile = false;

	async function getUserData() {
		userData = await UserManager.getUser();
	}

	onMount(() => {
		getUserData();
		title.set('My Account');
	});

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			pfpBlob = input.files[0];
			toast.info('Profile picture selected. Save changes to update.');
		}
	}

	async function updateUser() {
		if (isEditingProfile && !displayName.trim()) {
			toast.error('Display name cannot be empty');
			return;
		}

		const user = {
			id: userData.id,
			username: userData.username,
			name: displayName || userData.name,
			pfp: pfpBlob
		};
		
		try {
			const updatedUser = await UserManager.updateUser(user);
			SavedUser.set(updatedUser as User);
			toast.success('Profile updated successfully');
			isEditingProfile = false;
		} catch (error) {
			console.error('Error updating user:', error);
			toast.error('Failed to update profile');
		}
	}

	function toggleEditMode() {
		isEditingProfile = !isEditingProfile;
		if (isEditingProfile) {
			displayName = userData.name || '';
		}
	}

	function logout() {
		UserManager.logOut();
		toast.success('Logged out successfully');
	}
</script>

<div class="container mx-auto max-w-5xl px-4 py-8">
	<h1 class="mb-6 text-3xl font-bold text-foreground md:text-4xl">My Account</h1>
	
	<div class="grid gap-8 md:grid-cols-3">
		<!-- Left sidebar - Profile card -->
		<div class="rounded-xl border bg-card p-6 shadow-md">
			<div class="flex flex-col items-center space-y-4">
				<div class="relative">
					{#if userData.pfp}
						<div class="group relative">
							<img
								src={userData.pfp}
								alt="Profile"
								class="h-32 w-32 rounded-full object-cover shadow-md transition-all duration-300 group-hover:opacity-90"
							/>
							<div
								class="absolute inset-0 flex items-center justify-center rounded-full bg-background/50 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<label
									for="profile-image"
									class="flex cursor-pointer items-center justify-center rounded-full bg-primary p-3 text-primary-foreground shadow-sm hover:bg-primary/90"
								>
									<Camera size={16} />
									<input
										id="profile-image"
										type="file"
										class="hidden"
										accept="image/*"
										on:change={(e) => handleFileChange(e)}
									/>
								</label>
							</div>
						</div>
					{:else}
						<div class="group relative">
							<div class="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
								<UserIcon class="h-16 w-16 text-primary" />
							</div>
							<div
								class="absolute inset-0 flex items-center justify-center rounded-full bg-background/50 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<label
									for="profile-image"
									class="flex cursor-pointer items-center justify-center rounded-full bg-primary p-3 text-primary-foreground shadow-sm hover:bg-primary/90"
								>
									<Camera size={16} />
									<input
										id="profile-image"
										type="file"
										class="hidden"
										accept="image/*"
										on:change={(e) => handleFileChange(e)}
									/>
								</label>
							</div>
						</div>
					{/if}
				</div>
				
				<div class="text-center">
					<h2 class="text-xl font-semibold text-foreground">{userData.username}</h2>
					{#if userData.name}
						<p class="text-muted-foreground">{userData.name}</p>
					{/if}
					<p class="mt-1 text-sm text-muted-foreground">ID: {userData.id}</p>
				</div>
				
				<div class="w-full pt-4">
					<Button 
						variant="outline" 
						class="w-full justify-between" 
						on:click={toggleEditMode}
					>
						<span>Edit Profile</span>
						<Edit2 size={16} />
					</Button>
				</div>
			</div>
		</div>
		
		<!-- Right content area -->
		<div class="md:col-span-2 space-y-6">
			{#if isEditingProfile}
				<!-- Edit Profile Form -->
				<div class="rounded-xl border bg-card p-6 shadow-md">
					<h2 class="mb-6 text-xl font-semibold text-foreground">Edit Profile</h2>
					<div class="space-y-4">
						<div>
							<label for="displayName" class="mb-2 block text-sm font-medium text-foreground">
								Display Name
							</label>
							<Input 
								id="displayName"
								bind:value={displayName} 
								placeholder="Enter your display name" 
								class="w-full"
							/>
						</div>
						
						<div class="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
							<Button 
								class="flex-1" 
								variant="outline" 
								on:click={toggleEditMode}
							>
								Cancel
							</Button>
							<Button 
								class="flex-1" 
								variant="default" 
								on:click={updateUser}
							>
								Save Changes
							</Button>
						</div>
					</div>
				</div>
			{:else}
				<!-- Account settings navigation cards -->
				<div class="space-y-4">
					<a href="/account/preferences" class="block w-full">
						<div class="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-secondary/20">
							<div class="flex items-center space-x-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
									<Settings size={18} class="text-primary" />
								</div>
								<div>
									<h3 class="font-medium text-foreground">Preferences</h3>
									<p class="text-sm text-muted-foreground">Customize your app experience</p>
								</div>
							</div>
							<ChevronRight size={18} class="text-muted-foreground" />
						</div>
					</a>
					
					<a href="/friends" class="block w-full">
						<div class="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-secondary/20">
							<div class="flex items-center space-x-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
									<UserIcon size={18} class="text-primary" />
								</div>
								<div>
									<h3 class="font-medium text-foreground">Friends</h3>
									<p class="text-sm text-muted-foreground">Manage your connections</p>
								</div>
							</div>
							<ChevronRight size={18} class="text-muted-foreground" />
						</div>
					</a>
					
					<a href="/account/security" class="block w-full">
						<div class="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-secondary/20">
							<div class="flex items-center space-x-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
									<Shield size={18} class="text-primary" />
								</div>
								<div>
									<h3 class="font-medium text-foreground">Security</h3>
									<p class="text-sm text-muted-foreground">Manage account security options</p>
								</div>
							</div>
							<ChevronRight size={18} class="text-muted-foreground" />
						</div>
					</a>
				</div>
				
				<div class="pt-4">
					<Button 
						variant="destructive" 
						class="w-full justify-center"
						on:click={logout}
					>
						<LogOut size={16} class="mr-2" />
						<span>Log Out</span>
					</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
