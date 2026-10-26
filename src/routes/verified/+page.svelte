<script lang="ts">
	import { Button } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';
	import { loadSession } from '$lib/api/auth';

	let status = $state<'checking' | 'verified' | 'signin' | 'failed'>('checking');

	onMount(async () => {
		title.set('Email verification');
		if (page.url.searchParams.get('error')) {
			status = 'failed';
			return;
		}
		status = (await loadSession()) ? 'verified' : 'signin';
	});
</script>

<div class="flex h-full w-full items-center justify-center p-4">
	<div
		class="bg-surface-container-high mt-10 flex w-full max-w-md flex-col gap-8 rounded-3xl p-8 shadow-md"
	>
		<div class="flex flex-col gap-2 text-center">
			<h1 class="text-on-surface text-4xl font-medium tracking-tight">
				{status === 'failed' ? 'Link expired' : 'Email verified'}
			</h1>
			<p class="text-on-surface-variant text-base" role="status">
				{#if status === 'checking'}
					Finishing sign in...
				{:else if status === 'verified'}
					Your email is verified and you are signed in.
				{:else if status === 'signin'}
					Your email is verified. Sign in to continue.
				{:else}
					This link is invalid or has expired. Sign in to get a new one.
				{/if}
			</p>
		</div>

		<div class="flex flex-col gap-3">
			{#if status === 'verified'}
				<Button variant="filled" onclick={() => goto(resolve('/'))}>Continue to Maple</Button>
			{:else if status !== 'checking'}
				<Button variant="filled" onclick={() => goto(resolve('/login'))}>Sign in</Button>
			{/if}
		</div>
	</div>
</div>
