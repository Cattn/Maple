<script lang="ts">
	import { onMount } from 'svelte';
	import type { Song, Playlist, Album, Artist } from '$lib/types';
	import { playlists } from '$lib/global.svelte';
	import { OPFS } from '$lib/opfs';
	// @ts-ignore
	import Lazy from 'svelte-lazy';
	import { goto } from '$app/navigation';

	const DEFAULT_PLACEHOLDER = 'https://raw.githubusercontent.com/Cattn/Maple/8c1ab06960d3cec36714bf99cd6cee4ebb53913a/static/temp/MapleD.svg';

    const CONTEXT_MENU_EVENT = 'track-context-menu-open';

	let pos = $state({ x: 0, y: 0 });
	let menu = $state({ h: 0, w: 0 });
	let browser = $state({ h: 0, w: 0 });
	let showMenu = $state(false);
	let showPlaylistSubmenu = $state(false);
	let content: HTMLDivElement | undefined = $state(undefined);
	let hideSubmenuTimeout: number | null = null;
	
	let { track, playlist, album, artist, type = 'track' }: { track?: Song; playlist?: Playlist; album?: Album; artist?: Artist; type?: string } = $props();

    const USE_ARTIST_SVG = true;

	function portalToBody(node: HTMLElement) {
		if (typeof document !== 'undefined' && node.parentNode !== document.body) {
			document.body.appendChild(node);
		}
		return {
			destroy() {
				if (typeof document !== 'undefined' && node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	onMount(() => {
		const handleOtherMenuOpen = (e: CustomEvent) => {
			if (e.detail !== content) {
				showMenu = false;
				showPlaylistSubmenu = false;
				if (hideSubmenuTimeout) {
					clearTimeout(hideSubmenuTimeout);
					hideSubmenuTimeout = null;
				}
			}
		};

		window.addEventListener(CONTEXT_MENU_EVENT, handleOtherMenuOpen as EventListener);
		
		return () => {
			window.removeEventListener(CONTEXT_MENU_EVENT, handleOtherMenuOpen as EventListener);
			if (hideSubmenuTimeout) {
				clearTimeout(hideSubmenuTimeout);
				hideSubmenuTimeout = null;
			}
		};
	});

	function rightClickContextMenu(e: MouseEvent): void {
		e.preventDefault();
		e.stopPropagation();

		window.dispatchEvent(new CustomEvent(CONTEXT_MENU_EVENT, { 
			detail: content 
		}));

		browser = {
			w: window.innerWidth,
			h: window.innerHeight
		};

		pos = {
			x: e.clientX,
			y: e.clientY
		};

		if (browser.h - pos.y < menu.h) pos.y -= menu.h;
		if (browser.w - pos.x < menu.w) pos.x -= menu.w;

		showMenu = false;
		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
		setTimeout(() => {
			showMenu = true;
		}, 0);
	}

	function onPageClick(e: MouseEvent): void {
		if (!content) return;

		const rect = content.getBoundingClientRect();
		const isOutside =
			e.clientX < rect.left ||
			e.clientX > rect.right ||
			e.clientY < rect.top ||
			e.clientY > rect.bottom;

		if (isOutside) {
			showMenu = false;
			showPlaylistSubmenu = false;
			if (hideSubmenuTimeout) {
				clearTimeout(hideSubmenuTimeout);
				hideSubmenuTimeout = null;
			}
		}
	}

	function getContextMenuDimension(node: HTMLDivElement): void {
		menu = {
			h: node.offsetHeight,
			w: node.offsetWidth
		};
		content = node;
	}

	function handleDelete() {
		console.log('Delete clicked');
		showMenu = false;
		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
	}

	function handleRemove() {
		console.log('Remove clicked');
		showMenu = false;
		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
	}

	function handleAddToPlaylist(playlist?: any) {
		console.log('Add to playlist clicked', playlist);
		showMenu = false;
		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
	}

	function handlePlaylistHover() {
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
		showPlaylistSubmenu = true;
	}

	function handlePlaylistLeave() {
		hideSubmenuTimeout = setTimeout(() => {
			showPlaylistSubmenu = false;
			hideSubmenuTimeout = null;
		}, 300);
	}

	function handleTrackClick() {
		if (type === 'track') {
			// play later
		} else if (type === 'playlist') {
			goto(`/playlists/playlist/${playlist?.id}`);
		} else if (type === 'album') {
			goto(`/albums/album/${album?.id}`);
		} else if (type === 'artist') {
			goto(`/artists/artist/${artist?.id}`);
		}
	}
</script>

{#if showMenu}
	<div
		bind:this={content}
		use:getContextMenuDimension
		use:portalToBody
		style="position: fixed; top: {pos.y}px; left: {pos.x}px; z-index: 1000;"
		class="opacity-100 transform scale-100 transition-all duration-100"
	>
		<div class="bg-surface-container border border-outline rounded-xl shadow-lg py-2 min-w-48">
			<button
				onclick={handleDelete}
				class="w-full flex items-center px-4 py-3 text-on-surface hover:bg-surface-container-high transition-colors duration-150 text-left"
			>
				<svg class="mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
					<path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z"/>
				</svg>
				<span class="text-sm font-medium">Delete</span>
			</button>

			{#if type === 'track'}
			<div class="relative">
				<button
					onmouseenter={handlePlaylistHover}
					onmouseleave={handlePlaylistLeave}
					class="w-full flex items-center justify-between px-4 py-3 text-on-surface hover:bg-surface-container-high transition-colors duration-150 text-left"
				>
					<div class="flex items-center">
						<svg class="mr-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
							<path fill="currentColor" d="M11 17h2v-4h4v-2h-4V7h-2v4H7v2h4zm1 5q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"/>
						</svg>
						<span class="text-sm font-medium">Add to Playlist</span>
					</div>
					<svg class="w-4 h-4 transform transition-transform duration-200 {showPlaylistSubmenu ? 'rotate-90' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"/>
					</svg>
				</button>

				{#if showPlaylistSubmenu}
					<div
						role="menu"
						tabindex="-1"
						onmouseenter={handlePlaylistHover}
						onmouseleave={handlePlaylistLeave}
						class="absolute left-full top-0 ml-1 bg-surface-container border border-outline rounded-xl shadow-lg py-2 min-w-40 z-50"
					>
						{#each playlists() as playlist}
							<button
								onclick={() => handleAddToPlaylist(playlist)}
								class="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors duration-150"
							>
								{playlist.name}
							</button>
						{/each}
						<hr class="my-2 border-outline-variant">
						<button
							onclick={() => handleAddToPlaylist('new')}
							class="w-full flex items-center px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high transition-colors duration-150"
						>
							<svg class="mr-2 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
								<path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/>
							</svg>
							Create New Playlist
						</button>
					</div>
				{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<svelte:window on:click={onPageClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="flex flex-col w-full mt-5 ml-10" oncontextmenu={rightClickContextMenu}>
    {#if track?.image || playlist?.image || album?.image || artist?.image}
        {#await OPFS.getImageUrl(track?.image || playlist?.image || album?.image || artist?.image)}
            <Lazy height={200} keep={true}>
                {#if type === 'artist' && USE_ARTIST_SVG}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<svg 
					onclick={handleTrackClick}
					xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none text-primary bg-primary-container"><path fill="currentColor" d="M17.5 20q-1.05 0-1.775-.725T15 17.5t.725-1.775T17.5 15q.2 0 .45.038t.55.162V11q0-.425.288-.712T19.5 10H21q.425 0 .713.288T22 11t-.288.713T21 12h-1v5.5q0 1.05-.725 1.775T17.5 20M11 12q-1.65 0-2.825-1.175T7 8t1.175-2.825T11 4t2.825 1.175T15 8t-1.175 2.825T11 12m-7 8q-.425 0-.712-.288T3 19v-1.8q0-.875.438-1.575T4.6 14.55q1.55-.775 3.15-1.162T11 13q.7 0 1.388.075t1.387.225q.425.1.537.525t-.237.775q-.525.625-.788 1.363t-.262 1.537q0 .325.038.638t.137.637q.125.45-.112.838t-.663.387z"/></svg>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                {:else}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <img 
						onclick={handleTrackClick}
                        src={DEFAULT_PLACEHOLDER}
                        class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none"
                        alt="{track?.title || playlist?.name || album?.name || artist?.name} - {track?.artist || "" || album?.artist || ""}"
                        draggable="false"
                    />
                {/if}
            </Lazy>
        {:then imageUrl}
			<Lazy height={200} keep={true}>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<img 
					onclick={handleTrackClick}
					src={imageUrl} 
					class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none"
					alt="{track?.title || playlist?.name || album?.name || artist?.name} - {track?.artist || "" || album?.artist || ""}"
					draggable="false"
				/>
			</Lazy>
        {:catch}
            <Lazy height={200} keep={true}>
                {#if type === 'artist' && USE_ARTIST_SVG}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<svg
					 onclick={handleTrackClick}
					 xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none text-primary bg-primary-container"><path fill="currentColor" d="M17.5 20q-1.05 0-1.775-.725T15 17.5t.725-1.775T17.5 15q.2 0 .45.038t.55.162V11q0-.425.288-.712T19.5 10H21q.425 0 .713.288T22 11t-.288.713T21 12h-1v5.5q0 1.05-.725 1.775T17.5 20M11 12q-1.65 0-2.825-1.175T7 8t1.175-2.825T11 4t2.825 1.175T15 8t-1.175 2.825T11 12m-7 8q-.425 0-.712-.288T3 19v-1.8q0-.875.438-1.575T4.6 14.55q1.55-.775 3.15-1.162T11 13q.7 0 1.388.075t1.387.225q.425.1.537.525t-.237.775q-.525.625-.788 1.363t-.262 1.537q0 .325.038.638t.137.637q.125.45-.112.838t-.663.387z"/></svg>
                {:else}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<img 
						onclick={handleTrackClick}
                        src={DEFAULT_PLACEHOLDER}
                        class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none"
                        alt="{track?.title || playlist?.name || album?.name || artist?.name} - {track?.artist || "" || album?.artist || ""}"
                        draggable="false"
                    />
                {/if}
            </Lazy>
        {/await}
    {:else}
        {#if type === 'artist' && USE_ARTIST_SVG}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<svg 
			onclick={handleTrackClick}
			xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none text-primary bg-primary-container"><path fill="currentColor" d="M17.5 20q-1.05 0-1.775-.725T15 17.5t.725-1.775T17.5 15q.2 0 .45.038t.55.162V11q0-.425.288-.712T19.5 10H21q.425 0 .713.288T22 11t-.288.713T21 12h-1v5.5q0 1.05-.725 1.775T17.5 20M11 12q-1.65 0-2.825-1.175T7 8t1.175-2.825T11 4t2.825 1.175T15 8t-1.175 2.825T11 12m-7 8q-.425 0-.712-.288T3 19v-1.8q0-.875.438-1.575T4.6 14.55q1.55-.775 3.15-1.162T11 13q.7 0 1.388.075t1.387.225q.425.1.537.525t-.237.775q-.525.625-.788 1.363t-.262 1.537q0 .325.038.638t.137.637q.125.45-.112.838t-.663.387z"/></svg>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<img 
				onclick={handleTrackClick}
                src={DEFAULT_PLACEHOLDER}
                class="h-44 w-44 object-cover rounded-lg md:h-52 md:w-52 cursor-pointer transition-all duration-300 ease-in-out hover:scale-102 hover:shadow-lg active:scale-98 select-none"
                alt="{track?.title || playlist?.name || album?.name || artist?.name} - {track?.artist || "" || album?.artist || ""}"
                draggable="false"
            />
        {/if}
    {/if}
    <div class="flex flex-col">
        <p class="song-titles mt-2">{track?.title || playlist?.name || album?.name || artist?.name}</p>
        <p class="song-artists">{track?.artist || "" || album?.artist || ""}</p>
    </div>
</div>

<style>
    .song-titles {
		color: var(--color-secondary);
		font-size: 20px;
		font-family: 'Roboto Flex', sans-serif;
		font-weight: 800;
		font-style: normal;
		line-height: 20px;
		font-variation-settings:
			'slnt' 0,
			'wdth' 120,
			'GRAD' 77,
			'XOPQ' 96,
			'XTRA' 468,
			'YOPQ' 75,
			'YTAS' 750,
			'YTDE' -203,
			'YTFI' 728,
			'YTLC' 514,
			'YTUC' 712;
	}

    .song-artists {
		color: var(--color-secondary-fixed);
		font-size: 16px;
		font-family: 'Roboto Flex', sans-serif;
		font-weight: 300;
		font-style: normal;
		line-height: 20px;
		font-variation-settings:
			'slnt' 0,
			'wdth' 100,
			'GRAD' -125,
			'XOPQ' 90,
			'XTRA' 468,
			'YOPQ' 88,
			'YTAS' 750,
			'YTDE' -203,
			'YTFI' 728,
			'YTLC' 514,
			'YTUC' 712;
	}
</style>