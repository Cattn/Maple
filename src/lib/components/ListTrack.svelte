<script lang="ts">
	import type { Song } from '$lib/types';
	import { playlists } from '$lib/global.svelte';
	import { OPFS } from '$lib/opfs';
	import { refreshLibrary } from '$lib/global.svelte';
	import { goto } from '$app/navigation';
	import Lazy from 'svelte-lazy';
	import { startPlayback } from '$lib/player';
	import type { QueueSource } from '$lib/store';

	const CONTEXT_MENU_EVENT = 'track-context-menu-open';

	let {
		track,
		index,
		trackNo,
		showThumbnail = false,
		onRemove,
		draggable = false,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
		showDropIndicator = false,
		playbackContext = [],
		playbackSource
	}: {
		track: Song;
		index: number;
		trackNo?: number;
		showThumbnail?: boolean;
		onRemove?: () => void;
		draggable?: boolean;
		onDragStart?: (e: DragEvent) => void;
		onDragOver?: (e: DragEvent) => void;
		onDrop?: (e: DragEvent) => void;
		onDragEnd?: (e: DragEvent) => void;
		showDropIndicator?: boolean;
		playbackContext?: Song[];
		playbackSource?: { type?: QueueSource; id?: string; label?: string };
	} = $props();

	let showMenu = $state(false);
	let showPlaylistSubmenu = $state(false);
	let content: HTMLDivElement | undefined = $state(undefined);
	let menuPosition = $state<{ top: number; left: number } | null>(null);
	let hideSubmenuTimeout: number | null = null;
	let longPressTimeout: number | null = null;

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

	function onRowClick() {
		if (!track) return;
		const queue = playbackContext.length ? playbackContext : [track];
		startPlayback(queue.slice(), track.id, playbackSource);
	}

	function openMenuFromTarget(target: HTMLElement) {
		const rect = target.getBoundingClientRect();
		const menuMinWidth = 192;
		const horizontalPadding = 8;
		const verticalOffset = 4;
		let left = rect.right - menuMinWidth;
		left = Math.max(
			horizontalPadding,
			Math.min(left, window.innerWidth - menuMinWidth - horizontalPadding)
		);
		const top = rect.bottom + verticalOffset;
		menuPosition = { top, left };

		window.dispatchEvent(new CustomEvent(CONTEXT_MENU_EVENT, { detail: content }));

		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
		showMenu = true;
	}

	function onOpenMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		openMenuFromTarget(e.currentTarget as HTMLElement);
	}

	function onTouchStart(e: TouchEvent) {
		if (longPressTimeout) {
			clearTimeout(longPressTimeout);
		}
		const target = e.currentTarget as HTMLElement;
		longPressTimeout = window.setTimeout(() => {
			openMenuFromTarget(target);
		}, 450);
	}

	function onTouchEnd() {
		if (longPressTimeout) {
			clearTimeout(longPressTimeout);
			longPressTimeout = null;
		}
	}

	function onPageClick(e: MouseEvent) {
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

	function handleDelete() {
		showMenu = false;
		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}
	}

	function handleRemove() {
		if (onRemove) {
			onRemove();
		}
		handleDelete();
	}

	function handleAddToPlaylist(playlist?: any) {
		showMenu = false;
		showPlaylistSubmenu = false;
		if (hideSubmenuTimeout) {
			clearTimeout(hideSubmenuTimeout);
			hideSubmenuTimeout = null;
		}

		if (!track) return;
		if (playlist === 'new') {
			goto(`/playlists/create?addTrack=${track.id}`);
			return;
		}
		if (playlist && typeof playlist === 'object') {
			OPFS.track()
				.addToPlaylist(track, playlist)
				.then(() => refreshLibrary());
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

	function handleOtherMenuOpen(e: CustomEvent) {
		if (e.detail !== content) {
			showMenu = false;
			showPlaylistSubmenu = false;
			if (hideSubmenuTimeout) {
				clearTimeout(hideSubmenuTimeout);
				hideSubmenuTimeout = null;
			}
		}
	}

	if (typeof window !== 'undefined') {
		window.addEventListener(CONTEXT_MENU_EVENT, handleOtherMenuOpen as EventListener);
	}

	$effect(() => {
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener(CONTEXT_MENU_EVENT, handleOtherMenuOpen as EventListener);
			}
			if (hideSubmenuTimeout) {
				clearTimeout(hideSubmenuTimeout);
				hideSubmenuTimeout = null;
			}
		};
	});

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<svelte:window onclick={onPageClick} />

<div class="relative" oncontextmenu={(e) => e.preventDefault()} role="presentation">
	{#if showDropIndicator}
		<div class="bg-primary/70 absolute top-0 right-0 left-0 h-0.5"></div>
	{/if}
	<div
		class="group hover:bg-surface-container-high/50 flex cursor-pointer items-center justify-between px-4 py-3 transition-colors duration-150 select-none"
		class:pointer-events-none={showMenu}
		onclick={onRowClick}
		role="button"
		tabindex="0"
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onRowClick()}
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
		ontouchcancel={onTouchEnd}
		{draggable}
		ondragstart={onDragStart}
		ondragover={onDragOver}
		ondrop={onDrop}
		ondragend={onDragEnd}
	>
		<div class="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
			<span class="text-on-surface-variant w-8 shrink-0 text-right text-sm tabular-nums"
				>{index}</span
			>
			{#if showThumbnail}
				{#if track.image}
					{#await OPFS.getImageUrl(track.image as string) then imageUrl}
						<Lazy height={40} keep={true}>
							<div class="h-10 w-10 shrink-0">
								<img
									src={imageUrl}
									alt="{track.title} - {track.artist}"
									class="h-full w-full rounded-md object-cover"
									draggable="false"
								/>
							</div>
						</Lazy>
					{:catch}
						<Lazy height={40} keep={true}>
							<div class="bg-surface-container-high h-10 w-10 shrink-0 rounded-md"></div>
						</Lazy>
					{/await}
				{:else}
					<Lazy height={40} keep={true}>
						<div class="bg-surface-container-high h-10 w-10 shrink-0 rounded-md"></div>
					</Lazy>
				{/if}
			{/if}
			<div class="min-w-0 flex-1 overflow-hidden">
				<p class="text-on-surface truncate" title={track.title}>{track.title}</p>
				<p class="text-on-surface-variant truncate text-sm" title={track.artist}>{track.artist}</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if trackNo != null}
				<span
					class="border-outline-variant bg-surface-container-high text-on-surface-variant inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100"
					>{trackNo}</span
				>
			{/if}
			<span class="text-on-surface-variant hidden text-sm sm:inline"
				>{formatDuration(track.duration)}</span
			>
			<button
				class="text-on-surface hover:bg-surface-container-high hidden rounded-full p-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:inline-flex"
				aria-label="Open menu"
				onclick={onOpenMenu}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M12 8q-.825 0-1.413-.588T10 6t.588-1.412T12 4t1.413.588T14 6t-.587 1.412T12 8m0 6q-.825 0-1.413-.588T10 12t.588-1.412T12 10t1.413.588T14 12t-.587 1.412T12 14m0 6q-.825 0-1.413-.588T10 18t.588-1.412T12 16t1.413.588T14 18t-.587 1.412T12 20"
					/></svg
				>
			</button>
		</div>
	</div>

	{#if showMenu}
		<div
			bind:this={content}
			use:portalToBody
			class="fixed opacity-100"
			style="z-index: 3000;"
			style:top={`${menuPosition?.top ?? 0}px`}
			style:left={`${menuPosition?.left ?? 0}px`}
		>
			<div class="bg-surface border-outline min-w-48 rounded-xl border py-2 shadow-2xl">
				<button
					onclick={onRemove ? handleRemove : handleDelete}
					class="text-on-surface hover:bg-surface-container-high flex w-full items-center px-4 py-3 text-left transition-colors duration-150"
				>
					<svg
						class="mr-3 flex-shrink-0"
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z"
						/></svg
					>
					<span class="text-sm font-medium">{onRemove ? 'Remove' : 'Delete'}</span>
				</button>

				<div class="relative">
					<button
						onmouseenter={handlePlaylistHover}
						onmouseleave={handlePlaylistLeave}
						class="text-on-surface hover:bg-surface-container-high flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150"
					>
						<div class="flex items-center">
							<svg
								class="mr-3 flex-shrink-0"
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M11 17h2v-4h4v-2h-4V7h-2v4H7v2h4zm1 5q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"
								/></svg
							>
							<span class="text-sm font-medium">Add to Playlist</span>
						</div>
						<svg
							class="h-4 w-4 transform transition-transform duration-200 {showPlaylistSubmenu
								? 'rotate-90'
								: ''}"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							><path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z" /></svg
						>
					</button>

					{#if showPlaylistSubmenu}
						<div
							role="menu"
							tabindex="-1"
							onmouseenter={handlePlaylistHover}
							onmouseleave={handlePlaylistLeave}
							class="bg-surface border-outline absolute top-0 mr-1 min-w-40 rounded-xl border py-2 shadow-2xl"
							style:right={'100%'}
							style="z-index: 2100;"
						>
							{#each playlists() as p}
								<button
									onclick={() => handleAddToPlaylist(p)}
									class="text-on-surface hover:bg-surface-container-high w-full px-4 py-2 text-left text-sm transition-colors duration-150"
								>
									{p.name}
								</button>
							{/each}
							<hr class="border-outline-variant my-2" />
							<button
								onclick={() => handleAddToPlaylist('new')}
								class="text-on-surface hover:bg-surface-container-high flex w-full items-center px-4 py-2 text-left text-sm transition-colors duration-150"
							>
								<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
									><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg
								>
								Create New Playlist
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.text-on-surface.truncate,
	.text-on-surface-variant.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
		display: block;
	}
</style>
