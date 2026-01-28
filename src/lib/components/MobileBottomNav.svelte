<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isLoggedIn } from '$lib/store';

	let extraMenuOpen = $state(false);

	const isActive = (path: string) => page.url.pathname === path;

	const mainRoutes = [
		{ path: '/', label: 'Home', icon: 'home' },
		{ path: '/tracks', label: 'Library', icon: 'library' },
		{ path: '/playlists', label: 'Playlists', icon: 'playlists' }
	];

	const extraRoutes = [
		{ path: '/albums', label: 'Albums', icon: 'albums' },
		{ path: '/artists', label: 'Artists', icon: 'artists' },
		{ path: '/friends', label: 'Friends', icon: 'friends' },
		{ path: '/settings', label: 'Settings', icon: 'settings' }
	];

	function navigate(path: string) {
		goto(path);
		extraMenuOpen = false;
	}

	function toggleExtraMenu() {
		extraMenuOpen = !extraMenuOpen;
	}

	function handleBackdropClick(event: MouseEvent) {
		if ((event.target as HTMLElement).classList.contains('extra-backdrop')) {
			extraMenuOpen = false;
		}
	}
</script>

{#if extraMenuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="extra-backdrop fixed inset-0 z-45 flex items-end justify-center bg-black/50 pb-20"
		onclick={handleBackdropClick}
	>
		<div
			class="bg-surface-container-high flex max-w-[90vw] min-w-50 flex-col gap-1 rounded-2xl p-2 shadow-xl"
		>
			{#each extraRoutes as route}
				<button
					type="button"
					class="text-on-surface hover:bg-surface-container-highest flex cursor-pointer items-center gap-4 rounded-xl border-none bg-transparent px-5 py-4 text-left text-sm font-medium transition-colors {isActive(
						route.path
					)
						? 'bg-primary-container text-on-primary-container'
						: ''}"
					onclick={() => navigate(route.path)}
				>
					{#if route.icon === 'albums'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-3 5h-2v5.37c0 1.27-.9 2.44-2.16 2.6a2.505 2.505 0 0 1-2.8-2.95c.2-1.1 1.18-1.95 2.3-2.02c.63-.04 1.2.16 1.66.51V6c0-.55.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1M3 6c-.55 0-1 .45-1 1v13c0 1.1.9 2 2 2h13c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1-.45-1-1V7c0-.55-.45-1-1-1"
							/>
						</svg>
					{:else if route.icon === 'artists'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M17.5 20q-1.05 0-1.775-.725T15 17.5t.725-1.775T17.5 15q.2 0 .45.038T18.5 15.2V11q0-.425.288-.712T19.5 10H21q.425 0 .713.288T22 11t-.288.713T21 12h-1v5.5q0 1.05-.725 1.775T17.5 20M11 12q-1.65 0-2.825-1.175T7 8t1.175-2.825T11 4t2.825 1.175T15 8t-1.175 2.825T11 12m-7 8q-.425 0-.712-.288T3 19v-1.8q0-.875.438-1.575T4.6 14.55q1.55-.775 3.15-1.162T11 13q.7 0 1.388.075t1.387.225q.425.1.537.525t-.237.775q-.525.625-.788 1.363t-.262 1.537q0 .325.038.638t.137.637q.125.45-.112.838t-.663.387z"
							/>
						</svg>
					{:else if route.icon === 'friends'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" viewBox="0 0 640 512">
							<path
								fill="currentColor"
								d="M192 256c61.9 0 112-50.1 112-112S253.9 32 192 32S80 82.1 80 144s50.1 112 112 112m76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C51.6 288 0 339.6 0 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2M480 256c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96s43 96 96 96m48 32h-3.8c-13.9 4.8-28.6 8-44.2 8s-30.3-3.2-44.2-8H432c-20.4 0-39.2 5.9-55.7 15.4c24.4 26.3 39.7 61.2 39.7 99.8v38.4c0 2.2-.5 4.3-.6 6.4H592c26.5 0 48-21.5 48-48c0-61.9-50.1-112-112-112"
							/>
						</svg>
					{:else if route.icon === 'settings'}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M10.825 22q-.675 0-1.162-.45t-.588-1.1L8.85 18.8q-.325-.125-.612-.3t-.563-.375l-1.55.65q-.625.275-1.25.05t-.975-.8l-1.175-2.05q-.35-.575-.2-1.225t.675-1.075l1.325-1Q4.5 12.5 4.5 12.337v-.675q0-.162.025-.337l-1.325-1Q2.675 9.9 2.525 9.25t.2-1.225L3.9 5.975q.35-.575.975-.8t1.25.05l1.55.65q.275-.2.575-.375t.6-.3l.225-1.65q.1-.65.588-1.1T10.825 2h2.35q.675 0 1.163.45t.587 1.1l.225 1.65q.325.125.613.3t.562.375l1.55-.65q.625-.275 1.25-.05t.975.8l1.175 2.05q.35.575.2 1.225t-.675 1.075l-1.325 1q.025.175.025.338v.674q0 .163-.05.338l1.325 1q.525.425.675 1.075t-.2 1.225l-1.2 2.05q-.35.575-.975.8t-1.25-.05l-1.5-.65q-.275.2-.575.375t-.6.3l-.225 1.65q-.1.65-.587 1.1t-1.163.45zm1.225-6.5q1.45 0 2.475-1.025T15.55 12t-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12t1.013 2.475T12.05 15.5"
							/>
						</svg>
					{/if}
					<span>{route.label}</span>
				</button>
			{/each}
			{#if !$isLoggedIn}
				<button
					type="button"
					class="text-on-surface hover:bg-surface-container-highest flex cursor-pointer items-center gap-4 rounded-xl border-none bg-transparent px-5 py-4 text-left text-sm font-medium transition-colors {isActive(
						'/login'
					)
						? 'bg-primary-container text-on-primary-container'
						: ''}"
					onclick={() => navigate('/login')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 21v-2h7V5h-7V3h7q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21zm-2-4l-1.375-1.45l2.55-2.55H3v-2h8.175l-2.55-2.55L10 7l5 5z"
						/>
					</svg>
					<span>Login</span>
				</button>
			{/if}
		</div>
	</div>
{/if}

<nav
	class="border-outline-variant bg-surface-container fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0))]"
>
	{#each mainRoutes as route}
		<button
			type="button"
			class="flex cursor-pointer flex-col items-center justify-center gap-1 border-none bg-transparent px-4 py-2 transition-colors {isActive(
				route.path
			)
				? 'text-primary'
				: 'text-on-surface-variant'}"
			onclick={() => navigate(route.path)}
		>
			{#if route.icon === 'home'}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M4 19v-9q0-.475.213-.9t.587-.7l6-4.5q.525-.4 1.2-.4t1.2.4l6 4.5q.375.275.588.7T20 10v9q0 .825-.588 1.413T18 21h-3q-.425 0-.712-.288T14 20v-5q0-.425-.288-.712T13 14h-2q-.425 0-.712.288T10 15v5q0 .425-.288.713T9 21H6q-.825 0-1.412-.587T4 19"
					/>
				</svg>
			{:else if route.icon === 'library'}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M12 5v8.55c-.94-.54-2.1-.75-3.33-.32c-1.34.48-2.37 1.67-2.61 3.07a4.007 4.007 0 0 0 4.59 4.65c1.96-.31 3.35-2.11 3.35-4.1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2 .9-2 2"
					/>
				</svg>
			{:else if route.icon === 'playlists'}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24">
					<path
						fill="currentColor"
						d="M14 6H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1m0 4H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1M4 16h6c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1M19 6c-1.1 0-2 .9-2 2v6.18c-.31-.11-.65-.18-1-.18c-1.84 0-3.28 1.64-2.95 3.54c.21 1.21 1.2 2.2 2.41 2.41c1.9.33 3.54-1.11 3.54-2.95V8h2c.55 0 1-.45 1-1s-.45-1-1-1z"
					/>
				</svg>
			{/if}
			<span class="text-[11px] font-medium">{route.label}</span>
		</button>
	{/each}

	<button
		type="button"
		class="flex cursor-pointer flex-col items-center justify-center gap-1 border-none bg-transparent px-4 py-2 transition-colors {extraMenuOpen
			? 'text-primary'
			: 'text-on-surface-variant'}"
		onclick={toggleExtraMenu}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24">
			<path
				fill="currentColor"
				d="M6 14q-.825 0-1.412-.587T4 12t.588-1.412T6 10t1.413.588T8 12t-.587 1.413T6 14m6 0q-.825 0-1.412-.587T10 12t.588-1.412T12 10t1.413.588T14 12t-.587 1.413T12 14m6 0q-.825 0-1.412-.587T16 12t.588-1.412T18 10t1.413.588T20 12t-.587 1.413T18 14"
			/>
		</svg>
		<span class="text-[11px] font-medium">Extra</span>
	</button>
</nav>
