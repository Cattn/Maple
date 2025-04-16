<script lang="ts">
	import { goto } from '$app/navigation';
	import { UserManager } from '$lib/api/UserManager';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { isLoggedIn, title } from '$lib/store';
	import { onMount } from 'svelte';

	let username = '';
	let password = '';

	onMount(() => {
		title.set('Login');
	});

	async function login() {
		await UserManager.login(username, password);
		goto('/');
	}
</script>

{#if !$isLoggedIn}
	<h1 class="mt-10 text-center text-5xl font-black">Login</h1>

	<div class="mt-16 flex flex-col items-center justify-center">
		<Input bind:value={username} type="username" placeholder="username" class="my-1 max-w-xs" />
		<Input bind:value={password} type="password" placeholder="password" class="my-1 max-w-xs" />
	</div>

	<div class="mt-6 flex items-center justify-center">
		<Button class="mx-2 px-4 py-6" variant="secondary" on:click={login}>Login</Button>
	</div>
{/if}
