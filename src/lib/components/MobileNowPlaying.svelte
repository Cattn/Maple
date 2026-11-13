<script lang="ts">
	import Lyrics from './Lyrics.svelte';
	let lyricsOpen = $state(false);
	import { Button } from 'm3-svelte';
	import {
		activeSong,
		audioPlayer,
		curTime,
		currentDuration,
		loopEnabled,
		shuffleEnabled
	} from '$lib/store';
	import { next, previous, togglePlay, seekTo, toggleShuffle, toggleLoop } from '$lib/player';
	import { OPFS } from '$lib/opfs';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Queue from './Queue.svelte';

	let artwork = $state(null as string | null);
	let progress = $state(0);
	let duration = $state(0);
	let paused = $state(true);
	let fillPercent = $state(0);
	let trackEl = $state(null as HTMLDivElement | null);
	let dragging = $state(false);
	let queueOpen = $state(false);
	let expanded = $state(false);
	let canDismiss = $state(false);
	let sheetDragY = $state(0);
	let sheetDragging = $state(false);
	let sheetDragStartY = 0;

	let startX = $state(0);
	let currentX = $state(0);
	let swiping = $state(false);
	let swipeOffset = $state(0);
	const SWIPE_THRESHOLD = 50;
	const DISMISS_THRESHOLD = 120;

	const fallbackArt =
		'https://raw.githubusercontent.com/Cattn/Maple/8c1ab06960d3cec36714bf99cd6cee4ebb53913a/static/temp/MapleD.svg';

	let lastPathname = page.url.pathname;

	$effect(() => {
		const path = page.url.pathname;
		if (path === lastPathname) return;
		lastPathname = path;
		queueOpen = false;
		lyricsOpen = false;
		expanded = false;
		canDismiss = false;
		sheetDragY = 0;
		sheetDragging = false;
	});

	$effect(() => {
		if (!browser) return;
		if ($activeSong?.image) {
			OPFS.getImageUrl($activeSong.image as string)
				.then((url) => {
					artwork = url;
				})
				.catch(() => {
					artwork = null;
				});
		} else {
			artwork = null;
		}
	});

	$effect(() => {
		progress = $curTime ?? 0;
	});

	$effect(() => {
		duration = $currentDuration ?? 0;
	});

	$effect(() => {
		paused = !$audioPlayer.playing;
	});

	$effect(() => {
		fillPercent = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
	});

	function formatTime(seconds: number) {
		if (!Number.isFinite(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60)
			.toString()
			.padStart(2, '0');
		return `${mins}:${secs}`;
	}

	function updateFromPointer(event: PointerEvent) {
		if (!trackEl || duration <= 0) return;
		const rect = trackEl.getBoundingClientRect();
		const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
		const pct = rect.width ? x / rect.width : 0;
		const newTime = pct * duration;
		progress = newTime;
		seekTo(newTime);
	}

	function handleSeekPointerDown(event: PointerEvent) {
		event.stopPropagation();
		if (!trackEl) return;
		dragging = true;
		trackEl.setPointerCapture(event.pointerId);
		updateFromPointer(event);
	}

	function handleSeekPointerMove(event: PointerEvent) {
		if (!dragging) return;
		event.stopPropagation();
		updateFromPointer(event);
	}

	function handleSeekPointerUp(event: PointerEvent) {
		event.stopPropagation();
		if (!trackEl) return;
		updateFromPointer(event);
		try {
			trackEl.releasePointerCapture(event.pointerId);
		} catch {}
		dragging = false;
	}

	function handlePointerDown(event: PointerEvent) {
		startX = event.clientX;
		currentX = event.clientX;
		swiping = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!swiping) return;
		currentX = event.clientX;
		swipeOffset = currentX - startX;
	}

	function handlePointerUp(event: PointerEvent) {
		if (!swiping) return;

		const delta = currentX - startX;

		if (delta < -SWIPE_THRESHOLD) {
			next();
		} else if (delta > SWIPE_THRESHOLD) {
			previous();
		} else {
			queueOpen = false;
			canDismiss = false;
			expanded = true;
		}

		swiping = false;
		swipeOffset = 0;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {}
	}

	function toggleLyrics() {
		lyricsOpen = !lyricsOpen;
		queueOpen = false;
	}

	function toggleQueue() {
		lyricsOpen = false;
		if (!queueOpen) {
			expanded = false;
			sheetDragY = 0;
			sheetDragging = false;
			canDismiss = false;
			queueOpen = true;
		} else {
			queueOpen = false;
		}
	}

	function collapse() {
		if (!canDismiss) return;
		sheetDragY = 0;
		sheetDragging = false;
		expanded = false;
	}

	function onSheetIntroEnd() {
		canDismiss = true;
	}

	function handleSheetDragDown(event: PointerEvent) {
		if (!canDismiss) return;
		sheetDragging = true;
		sheetDragStartY = event.clientY;
		sheetDragY = 0;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handleSheetDragMove(event: PointerEvent) {
		if (!sheetDragging) return;
		sheetDragY = Math.max(0, event.clientY - sheetDragStartY);
	}

	function handleSheetDragUp(event: PointerEvent) {
		if (!sheetDragging) return;
		sheetDragging = false;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {}

		if (sheetDragY >= DISMISS_THRESHOLD || sheetDragY < 8) {
			collapse();
			return;
		}
		sheetDragY = 0;
	}
</script>

{#if expanded}
	<div
		class="fixed inset-0 z-60 bg-black/40"
		style={sheetDragY > 0 ? `opacity: ${Math.max(0, 1 - sheetDragY / 300)}` : undefined}
		transition:fade={{ duration: 300, easing: cubicOut }}
		onpointerdown={collapse}
		role="presentation"
	></div>
	<div
		class={[
			'bg-surface fixed inset-x-0 top-8 bottom-0 z-60 flex flex-col rounded-t-3xl px-6 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl select-none',
			!canDismiss && 'pointer-events-none',
			!sheetDragging && 'transition-transform duration-200 ease-out'
		]}
		style={sheetDragY > 0 || sheetDragging ? `transform: translateY(${sheetDragY}px)` : undefined}
		transition:fly={{ y: '100%', duration: 300, easing: cubicOut }}
		onintroend={onSheetIntroEnd}
		role="dialog"
		aria-modal="true"
		aria-label="Now playing"
	>
		<div
			class="flex w-full cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
			role="button"
			tabindex="0"
			aria-label="Drag down to close"
			onpointerdown={handleSheetDragDown}
			onpointermove={handleSheetDragMove}
			onpointerup={handleSheetDragUp}
			onpointercancel={handleSheetDragUp}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					collapse();
				}
			}}
		>
			<span class="block h-1.5 w-12 rounded-full bg-white shadow ring-1 ring-black/10"></span>
		</div>

		<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
			<img
				src={artwork ?? fallbackArt}
				alt={$activeSong.title || 'Song Art'}
				class="aspect-square w-full max-w-sm rounded-2xl object-cover shadow-lg"
			/>
			<div class="w-full max-w-sm text-center">
				<p class="text-primary truncate text-2xl font-bold">{$activeSong.title || 'Song Name'}</p>
				<p class="text-on-surface-variant truncate text-base font-medium">
					{$activeSong.artist || 'Artist Name'}
				</p>
			</div>
		</div>

		<div class="mx-auto w-full max-w-sm pb-4">
			<div class="grid grid-cols-[auto_1fr_auto] items-center gap-2">
				<span class="text-on-surface-variant text-[10px]">{formatTime(progress)}</span>
				<div
					class="relative h-3 w-full touch-none overflow-hidden rounded-full bg-[rgb(var(--m3-scheme-surface-variant))] shadow-[inset_0_0_0_1px_rgb(var(--m3-scheme-outline-variant))]"
					role="slider"
					aria-label="Seek"
					aria-valuemin={0}
					aria-valuemax={duration}
					aria-valuenow={progress}
					tabindex="0"
					bind:this={trackEl}
					onpointerdown={handleSeekPointerDown}
					onpointermove={handleSeekPointerMove}
					onpointerup={handleSeekPointerUp}
					onpointercancel={handleSeekPointerUp}
				>
					<div
						class="absolute top-0 left-0 h-full rounded-full bg-[rgb(var(--m3-scheme-primary))]"
						style={`width:${fillPercent}%;`}
					></div>
					<div
						class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[rgb(var(--m3-scheme-surface))] bg-[rgb(var(--m3-scheme-primary))] shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
						style={`left: calc(${fillPercent}% - 8px);`}
						role="presentation"
						onpointerdown={handleSeekPointerDown}
						onpointermove={handleSeekPointerMove}
						onpointerup={handleSeekPointerUp}
					></div>
				</div>
				<span class="text-on-surface-variant text-[10px]">{formatTime(duration)}</span>
			</div>

			<div class="mt-6 flex items-center justify-center gap-3">
				<Button
					iconType="full"
					square
					variant={$shuffleEnabled ? 'filled' : 'outlined'}
					onclick={toggleShuffle}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M14 20v-2h2.6l-3.175-3.175L14.85 13.4L18 16.55V14h2v6zm-8.6 0L4 18.6L16.6 6H14V4h6v6h-2V7.4zm3.775-9.425L4 5.4L5.4 4l5.175 5.175z"
						/>
					</svg>
				</Button>
				<Button iconType="full" square variant="tonal" onclick={previous}>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
						<path fill="currentColor" d="M5.5 18V6h2v12zm13 0l-9-6l9-6zm-2-3.75v-4.5L13.1 12z" />
					</svg>
				</Button>
				<div class="play-btn">
					<Button iconType="full" square variant="filled" onclick={togglePlay}>
						{#if paused}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
								<path fill="currentColor" d="M8 19V5l11 7z" />
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
								<path fill="currentColor" d="M8 19V5h3v14zm5 0V5h3v14z" />
							</svg>
						{/if}
					</Button>
				</div>
				<Button iconType="full" square variant="tonal" onclick={next}>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
						<path fill="currentColor" d="M16.5 18V6h2v12zm-11 0V6l9 6zm2-3.75L10.9 12L7.5 9.75z" />
					</svg>
				</Button>
				<Button
					iconType="full"
					square
					variant={$loopEnabled ? 'filled' : 'outlined'}
					onclick={toggleLoop}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6c0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8m0 14c-3.31 0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4l-4-4z"
						/>
					</svg>
				</Button>
			</div>

			<div class="mt-4 flex items-center justify-center gap-3">
				<Button variant={lyricsOpen ? 'filled' : 'tonal'} onclick={toggleLyrics}>Lyrics</Button>
				<div class="queue-btn">
					<Button
						iconType="full"
						square
						variant={queueOpen ? 'filled' : 'tonal'}
						onclick={toggleQueue}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M16 20q-1.25 0-2.125-.875T13 17t.875-2.125T16 14q.275 0 .525.038T17 14.2V7q0-.425.288-.712T18 6h3q.425 0 .713.288T22 7t-.288.713T21 8h-2v9q0 1.25-.875 2.125T16 20M4 16q-.425 0-.712-.288T3 15t.288-.712T4 14h6q.425 0 .713.288T11 15t-.288.713T10 16zm0-4q-.425 0-.712-.288T3 11t.288-.712T4 10h10q.425 0 .713.288T15 11t-.288.713T14 12zm0-4q-.425 0-.712-.288T3 7t.288-.712T4 6h10q.425 0 .713.288T15 7t-.288.713T14 8z"
							/>
						</svg>
					</Button>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div
		class="bg-surface-container-high fixed right-4 bottom-22 left-4 z-40 touch-pan-y rounded-2xl p-2 shadow-lg select-none"
		role="group"
		aria-label="Now playing"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		style="transform: translateX({swipeOffset * 0.3}px);"
	>
		<div class="flex items-center gap-3">
			<img
				src={artwork ?? fallbackArt}
				alt={$activeSong.title || 'Song Art'}
				class="h-12 w-12 shrink-0 rounded-lg object-cover"
			/>
			<div class="min-w-0 flex-1 overflow-hidden">
				<p class="text-primary truncate text-sm font-bold">{$activeSong.title || 'Song Name'}</p>
				<p class="text-on-surface-variant truncate text-xs font-medium">
					{$activeSong.artist || 'Artist Name'}
				</p>
			</div>
			<div
				class="flex shrink-0 items-center gap-1"
				role="presentation"
				onpointerdown={(e) => e.stopPropagation()}
			>
				<Button variant={lyricsOpen ? 'filled' : 'tonal'} onclick={toggleLyrics}>Lyrics</Button>
				<div class="queue-btn" role="presentation" onpointerdown={(e) => e.stopPropagation()}>
					<Button
						iconType="full"
						square
						variant={queueOpen ? 'filled' : 'tonal'}
						onclick={toggleQueue}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M16 20q-1.25 0-2.125-.875T13 17t.875-2.125T16 14q.275 0 .525.038T17 14.2V7q0-.425.288-.712T18 6h3q.425 0 .713.288T22 7t-.288.713T21 8h-2v9q0 1.25-.875 2.125T16 20M4 16q-.425 0-.712-.288T3 15t.288-.712T4 14h6q.425 0 .713.288T11 15t-.288.713T10 16zm0-4q-.425 0-.712-.288T3 11t.288-.712T4 10h10q.425 0 .713.288T15 11t-.288.713T14 12zm0-4q-.425 0-.712-.288T3 7t.288-.712T4 6h10q.425 0 .713.288T15 7t-.288.713T14 8z"
							/>
						</svg>
					</Button>
				</div>
				<div class="play-btn" role="presentation" onpointerdown={(e) => e.stopPropagation()}>
					<Button iconType="full" square variant="filled" onclick={togglePlay}>
						{#if paused}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
								<path fill="currentColor" d="M8 19V5l11 7z" />
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
								<path fill="currentColor" d="M8 19V5h3v14zm5 0V5h3v14z" />
							</svg>
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if lyricsOpen}<Lyrics onClose={() => (lyricsOpen = false)} />{/if}
{#if queueOpen}
	<Queue onClose={() => (queueOpen = false)} />
{/if}

<style>
	.play-btn :global(button),
	.queue-btn :global(button) {
		border-radius: 50%;
	}
</style>
