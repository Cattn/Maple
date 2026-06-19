<script lang="ts">
	import { Button } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createLibrary } from '$lib/library';
	import { SavedUser, isLoggedIn } from '$lib/store';

	const isActive = (path: string) => page.url.pathname === path;
</script>

<div class="hidden items-center justify-center md:flex">
	<div
		class="bg-surface-container-high fixed top-0 left-0 flex h-[100%] flex-col items-center justify-between rounded-br-4xl p-4"
	>
		<div class="mt-3 mb-3 flex flex-col items-center justify-center gap-2">
			<button
				type="button"
				onclick={() => goto($isLoggedIn ? '/settings' : '/login')}
				class="bg-primary text-on-primary hover:bg-primary/90 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full transition-colors"
			>
				{#if $SavedUser?.pfp}
					<img src={$SavedUser.pfp} alt="Profile" class="h-12 w-12 rounded-full object-cover" />
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"
						/>
					</svg>
				{/if}
			</button>

			<div class="button-mod mt-5 flex flex-col items-center justify-center gap-2">
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M4 19v-9q0-.475.213-.9t.587-.7l6-4.5q.525-.4 1.2-.4t1.2.4l6 4.5q.375.275.588.7T20 10v9q0 .825-.588 1.413T18 21h-3q-.425 0-.712-.288T14 20v-5q0-.425-.288-.712T13 14h-2q-.425 0-.712.288T10 15v5q0 .425-.288.713T9 21H6q-.825 0-1.412-.587T4 19"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Home</h1>
				</div>
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/tracks') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/tracks');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Library</h1>
				</div>
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/playlists') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/playlists');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M14 6H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1m0 4H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1M4 16h6c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1M19 6c-1.1 0-2 .9-2 2v6.18c-.31-.11-.65-.18-1-.18c-1.84 0-3.28 1.64-2.95 3.54c.21 1.21 1.2 2.2 2.41 2.41c1.9.33 3.54-1.11 3.54-2.95V8h2c.55 0 1-.45 1-1s-.45-1-1-1z"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Playlists</h1>
				</div>
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/albums') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/albums');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-3 5h-2v5.37c0 1.27-.9 2.44-2.16 2.6a2.505 2.505 0 0 1-2.8-2.95c.2-1.1 1.18-1.95 2.3-2.02c.63-.04 1.2.16 1.66.51V6c0-.55.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1M3 6c-.55 0-1 .45-1 1v13c0 1.1.9 2 2 2h13c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1-.45-1-1V7c0-.55-.45-1-1-1"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Albums</h1>
				</div>
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/artists') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/artists');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M17.5 20q-1.05 0-1.775-.725T15 17.5t.725-1.775T17.5 15q.2 0 .45.038t.55.162V11q0-.425.288-.712T19.5 10H21q.425 0 .713.288T22 11t-.288.713T21 12h-1v5.5q0 1.05-.725 1.775T17.5 20M11 12q-1.65 0-2.825-1.175T7 8t1.175-2.825T11 4t2.825 1.175T15 8t-1.175 2.825T11 12m-7 8q-.425 0-.712-.288T3 19v-1.8q0-.875.438-1.575T4.6 14.55q1.55-.775 3.15-1.162T11 13q.7 0 1.388.075t1.387.225q.425.1.537.525t-.237.775q-.525.625-.788 1.363t-.262 1.537q0 .325.038.638t.137.637q.125.45-.112.838t-.663.387z"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Artists</h1>
				</div>
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/friends') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/friends');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="120" height="96" viewBox="0 0 640 512"
							><path
								fill="currentColor"
								d="M192 256c61.9 0 112-50.1 112-112S253.9 32 192 32S80 82.1 80 144s50.1 112 112 112m76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C51.6 288 0 339.6 0 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2M480 256c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96s43 96 96 96m48 32h-3.8c-13.9 4.8-28.6 8-44.2 8s-30.3-3.2-44.2-8H432c-20.4 0-39.2 5.9-55.7 15.4c24.4 26.3 39.7 61.2 39.7 99.8v38.4c0 2.2-.5 4.3-.6 6.4H592c26.5 0 48-21.5 48-48c0-61.9-50.1-112-112-112"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Friends</h1>
				</div>
				<div class="flex flex-col items-center justify-center">
					<Button
						variant={isActive('/settings') ? 'filled' : 'outlined'}
						iconType="full"
						onclick={() => {
							goto('/settings');
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M10.825 22q-.675 0-1.162-.45t-.588-1.1L8.85 18.8q-.325-.125-.612-.3t-.563-.375l-1.55.65q-.625.275-1.25.05t-.975-.8l-1.175-2.05q-.35-.575-.2-1.225t.675-1.075l1.325-1Q4.5 12.5 4.5 12.337v-.675q0-.162.025-.337l-1.325-1Q2.675 9.9 2.525 9.25t.2-1.225L3.9 5.975q.35-.575.975-.8t1.25.05l1.55.65q.275-.2.575-.375t.6-.3l.225-1.65q.1-.65.588-1.1T10.825 2h2.35q.675 0 1.163.45t.587 1.1l.225 1.65q.325.125.613.3t.562.375l1.55-.65q.625-.275 1.25-.05t.975.8l1.175 2.05q.35.575.2 1.225t-.675 1.075l-1.325 1q.025.175.025.338v.674q0 .163-.05.338l1.325 1q.525.425.675 1.075t-.2 1.225l-1.2 2.05q-.35.575-.975.8t-1.25-.05l-1.5-.65q-.275.2-.575.375t-.6.3l-.225 1.65q-.1.65-.587 1.1t-1.163.45zm1.225-6.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5"
							/></svg
						>
					</Button>
					<h1 class="text-on-secondary roboto-flex-home-link">Settings</h1>
				</div>
			</div>
		</div>
		<div></div>
		<div class="mb-3 flex justify-center">
			<Button
				onclick={() => {
					createLibrary();
				}}
				variant="filled"
				iconType="full"
				square
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20zm5-12.15L9.125 9.725q-.3.3-.712.288T7.7 9.7q-.275-.3-.288-.7t.288-.7l3.6-3.6q.15-.15.325-.212T12 4.425t.375.063t.325.212l3.6 3.6q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L13 7.85V15q0 .425-.288.713T12 16t-.712-.288T11 15z"
					/>
				</svg>
			</Button>
		</div>
	</div>
</div>

<style>
	.button-mod :global(button) {
		padding-left: 30px;
		padding-right: 30px;
	}

	.button-mod :global(svg) {
		scale: 0.8;
	}

	.button-mod h1 {
		font-size: 10px;
		font-weight: 500;
		color: var(--color-secondary);
	}
</style>
