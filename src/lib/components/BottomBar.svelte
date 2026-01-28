<script lang="ts">
	import { Button, Slider } from 'm3-svelte';
	import {
		activeSong,
		audioPlayer,
		curTime,
		currentDuration,
		loopEnabled,
		shuffleEnabled
	} from '$lib/store';
	import {
		next,
		previous,
		togglePlay,
		seekTo,
		setVolumeLevel,
		toggleShuffle,
		toggleLoop
	} from '$lib/player';
	import { OPFS } from '$lib/opfs';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import Queue from './Queue.svelte';

	let artwork = $state(null as string | null);
	let progress = $state(0);
	let volume = $state(100);
	let lastVolume = $state(100);
	let duration = $state(0);
	let paused = $state(true);
	let fillPercent = $state(0);
	let trackEl: HTMLDivElement | null = null;
	let dragging = $state(false);
	let queueOpen = $state(false);

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

	$effect(() => {
		volume = $audioPlayer.volume ?? volume;
	});

	$effect(() => {
		if (!browser) return;
		if (volume === lastVolume) return;
		lastVolume = volume;
		setVolumeLevel(volume);
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

	function handlePointerDown(event: PointerEvent) {
		if (!trackEl) return;
		dragging = true;
		trackEl.setPointerCapture(event.pointerId);
		updateFromPointer(event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging) return;
		updateFromPointer(event);
	}

	function handlePointerUp(event: PointerEvent) {
		if (!trackEl) return;
		updateFromPointer(event);
		try {
			trackEl.releasePointerCapture(event.pointerId);
		} catch {}
		dragging = false;
	}

	function openQueue() {
		queueOpen = !queueOpen;
	}
</script>

<div
	class="fixed right-0 bottom-5 left-23 mx-8 flex h-24 items-center justify-between rounded-full bg-[rgb(var(--m3-scheme-surface-container))] px-4"
>
	<div class="relative w-full">
		<div
			class="absolute -top-3 right-0 left-0 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-6"
		>
			<span class="text-[10px] text-[rgb(var(--m3-scheme-on-surface-variant))]"
				>{formatTime(progress)}</span
			>
			<div
				class="relative h-3 w-full overflow-hidden rounded-full bg-[rgb(var(--m3-scheme-surface-variant))] shadow-[inset_0_0_0_1px_rgb(var(--m3-scheme-outline-variant))]"
				bind:this={trackEl}
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
			>
				<div
					class="absolute top-0 left-0 h-full rounded-full bg-[rgb(var(--m3-scheme-primary))]"
					style={`width:${fillPercent}%;`}
				></div>
				<div
					class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[rgb(var(--m3-scheme-surface))] bg-[rgb(var(--m3-scheme-primary))] shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
					style={`left: calc(${fillPercent}% - 8px);`}
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerUp}
				></div>
			</div>
			<span class="text-[10px] text-[rgb(var(--m3-scheme-on-surface-variant))]"
				>{formatTime(duration)}</span
			>
		</div>
		<div class="grid h-full w-full grid-cols-3 items-center pt-4">
			<div class="ml-6 flex items-center justify-start gap-2">
				<img
					src={artwork ??
						'https://raw.githubusercontent.com/Cattn/Maple/8c1ab06960d3cec36714bf99cd6cee4ebb53913a/static/temp/MapleD.svg'}
					alt={$activeSong.title || 'Song Art'}
					class="h-14 w-14 rounded-lg"
				/>
				<div class="flex flex-col">
					<p class="song-title">
						{$activeSong.title || 'Song Name'}
					</p>
					<p class="artist-title">
						{$activeSong.artist || 'Artist Name'}
					</p>
				</div>
			</div>
			<div class="flex justify-center gap-2">
				<div>
					<Button
						iconType="full"
						square
						variant={$shuffleEnabled ? 'filled' : 'outlined'}
						onclick={toggleShuffle}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M14 20v-2h2.6l-3.175-3.175L14.85 13.4L18 16.55V14h2v6zm-8.6 0L4 18.6L16.6 6H14V4h6v6h-2V7.4zm3.775-9.425L4 5.4L5.4 4l5.175 5.175z"
							/></svg
						>
					</Button>
				</div>
				<div class="button-mod-2">
					<Button iconType="full" square variant="tonal" onclick={previous}>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M5.5 18V6h2v12zm13 0l-9-6l9-6zm-2-3.75v-4.5L13.1 12z"
							/></svg
						>
					</Button>
				</div>
				<div class="button-mod">
					<Button iconType="full" square variant="tonal" onclick={togglePlay}>
						{#if paused}
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
								><path fill="currentColor" d="M8 19V5l11 7z" /></svg
							>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
								><path fill="currentColor" d="M8 19V5h3v14zm5 0V5h3v14z" /></svg
							>
						{/if}
					</Button>
				</div>
				<div class="button-mod-2">
					<Button iconType="full" square variant="tonal" onclick={next}>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M16.5 18V6h2v12zm-11 0V6l9 6zm2-3.75L10.9 12L7.5 9.75z"
							/></svg
						>
					</Button>
				</div>
				<div>
					<Button
						iconType="full"
						square
						variant={$loopEnabled ? 'filled' : 'outlined'}
						onclick={toggleLoop}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6c0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8m0 14c-3.31 0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4l-4-4z"
							/></svg
						>
					</Button>
				</div>
			</div>
			<div class="mr-6 flex items-center justify-end">
				<div>
					<Button
						iconType="full"
						square
						variant={queueOpen ? 'filled' : 'tonal'}
						onclick={openQueue}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M16 20q-1.25 0-2.125-.875T13 17t.875-2.125T16 14q.275 0 .525.038T17 14.2V7q0-.425.288-.712T18 6h3q.425 0 .713.288T22 7t-.288.713T21 8h-2v9q0 1.25-.875 2.125T16 20M4 16q-.425 0-.712-.288T3 15t.288-.712T4 14h6q.425 0 .713.288T11 15t-.288.713T10 16zm0-4q-.425 0-.712-.288T3 11t.288-.712T4 10h10q.425 0 .713.288T15 11t-.288.713T14 12zm0-4q-.425 0-.712-.288T3 7t.288-.712T4 6h10q.425 0 .713.288T15 7t-.288.713T14 8z"
							/></svg
						>
					</Button>
				</div>
				<div class="mx-2">
					<svg
						class="fill-icon-color scale-110"
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M7 15V9h4l5-5v16l-5-5zm2-2h2.85L14 15.15v-6.3L11.85 11H9zm2.5-1"
						/></svg
					>
				</div>
				<div class="w-40">
					<Slider
						min={0}
						max={100}
						bind:value={volume}
						step={1}
						showValue
						format={(n) => `${n}%`}
					/>
				</div>
				<div class="mx-2">
					<svg
						class="fill-icon-color scale-110"
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16m-4-7.15L7.85 11H5v2h2.85L10 15.15zM7.5 12"
						/></svg
					>
				</div>
			</div>
		</div>
	</div>
</div>

{#if queueOpen}
	<Queue />
{/if}

<style>
	.song-title {
		color: var(--color-primary);
		font-size: 20px;
		font-family: 'Roboto Flex', sans-serif;
		font-weight: 1000;
		font-style: normal;
		line-height: 20px;
		font-variation-settings:
			'slnt' 0,
			'wdth' 151,
			'GRAD' 82,
			'XOPQ' 100,
			'XTRA' 468,
			'YOPQ' 79,
			'YTAS' 750,
			'YTDE' -203,
			'YTFI' 738,
			'YTLC' 514,
			'YTUC' 712;
	}

	.artist-title {
		color: var(--color-on-surface-variant);
		font-size: 16px;
		font-family: 'Roboto Flex', sans-serif;
		font-weight: 658;
		line-height: 20px;
		font-style: normal;
		font-variation-settings:
			'slnt' -7,
			'wdth' 50,
			'GRAD' 129,
			'XOPQ' 96,
			'XTRA' 468,
			'YOPQ' 79,
			'YTAS' 750,
			'YTDE' -203,
			'YTFI' 738,
			'YTLC' 514,
			'YTUC' 712;
	}

	.button-mod :global(button) {
		padding-left: 30px;
		padding-right: 30px;
		background-color: var(--color-on-secondary) !important;
		scale: 1.3;
	}

	.button-mod :global(svg) {
		scale: 1.2;
	}

	.button-mod-2 :global(button) {
		padding-left: 30px;
		padding-right: 30px;
		margin-left: 8px;
		margin-right: 8px;
		transform: scaleY(1.3);
		transform-origin: center;
	}

	.button-mod-2 :global(svg) {
		transform: scaleX(1.3);
	}

	.fill-icon-color {
		color: rgb(var(--m3-scheme-on-surface-variant));
		scale: 1.2;
	}
</style>
