<script lang="ts">
	import { Button } from 'm3-svelte';
	import { activeSong, audioPlayer } from '$lib/store';
	import { next, previous, togglePlay } from '$lib/player';
	import { OPFS } from '$lib/opfs';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import Queue from './Queue.svelte';

	let artwork = $state(null as string | null);
	let paused = $state(true);
	let queueOpen = $state(false);

	let startX = $state(0);
	let currentX = $state(0);
	let swiping = $state(false);
	let swipeOffset = $state(0);
	const SWIPE_THRESHOLD = 50;

	$effect(() => {
		page.url.pathname;
		queueOpen = false;
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
		paused = !$audioPlayer.playing;
	});

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
		}

		swiping = false;
		swipeOffset = 0;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {}
	}

	function toggleQueue() {
		queueOpen = !queueOpen;
	}
</script>

{#if queueOpen}
	<Queue />
{/if}

<div
	class="bg-surface-container-high fixed right-4 bottom-22 left-4 z-40 touch-pan-y rounded-2xl p-2 shadow-lg select-none"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerUp}
	style="transform: translateX({swipeOffset * 0.3}px);"
>
	<div class="flex items-center gap-3">
		<img
			src={artwork ??
				'https://raw.githubusercontent.com/Cattn/Maple/8c1ab06960d3cec36714bf99cd6cee4ebb53913a/static/temp/MapleD.svg'}
			alt={$activeSong.title || 'Song Art'}
			class="h-12 w-12 shrink-0 rounded-lg object-cover"
		/>
		<div class="min-w-0 flex-1 overflow-hidden">
			<p class="text-primary truncate text-sm font-bold">{$activeSong.title || 'Song Name'}</p>
			<p class="text-on-surface-variant truncate text-xs font-medium">
				{$activeSong.artist || 'Artist Name'}
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<div class="queue-btn" onpointerdown={(e) => e.stopPropagation()}>
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
			<div class="play-btn" onpointerdown={(e) => e.stopPropagation()}>
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

<style>
	.play-btn :global(button),
	.queue-btn :global(button) {
		border-radius: 50%;
	}
</style>
