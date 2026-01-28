<script lang="ts">
	import { queueState } from '$lib/store';
	import { get } from 'svelte/store';
	import ListTrack from '$lib/components/ListTrack.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import type { Song } from '$lib/types';

	let dragIndex = $state<number | null>(null);
	let dropIndex = $state<number | null>(null);
	let canDrag = $state(true);
	let itemsCache = $state<Song[]>([]);

	$effect(() => {
		const currentItems = $queueState.items;
		const itemsChanged =
			itemsCache.length !== currentItems.length ||
			itemsCache.some((item, i) => item.id !== currentItems[i]?.id);

		if (itemsChanged) {
			itemsCache = [...currentItems];
		}
	});

	function moveQueueItem(fromIndex: number, toIndex: number) {
		const state = get(queueState);
		if (fromIndex === toIndex) return;
		if (
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= state.items.length ||
			toIndex >= state.items.length
		)
			return;

		const next = [...state.items];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);

		let newCurrentIndex = state.currentIndex;
		if (state.currentIndex === fromIndex) {
			newCurrentIndex = toIndex;
		} else if (state.currentIndex > fromIndex && state.currentIndex <= toIndex) {
			newCurrentIndex = state.currentIndex - 1;
		} else if (state.currentIndex < fromIndex && state.currentIndex >= toIndex) {
			newCurrentIndex = state.currentIndex + 1;
		}

		queueState.set({
			items: next,
			currentIndex: newCurrentIndex,
			source: state.source
		});
		itemsCache = [...next];
	}

	function removeQueueItem(index: number) {
		const state = get(queueState);
		if (index < 0 || index >= state.items.length) return;

		const next = state.items.filter((_, i) => i !== index);
		let newCurrentIndex = state.currentIndex;

		if (index < state.currentIndex) {
			newCurrentIndex = state.currentIndex - 1;
		} else if (index === state.currentIndex && next.length > 0) {
			newCurrentIndex = Math.min(state.currentIndex, next.length - 1);
		} else if (next.length === 0) {
			newCurrentIndex = -1;
		}

		queueState.set({
			items: next,
			currentIndex: newCurrentIndex,
			source: state.source
		});
		itemsCache = [...next];
	}

	if (typeof window !== 'undefined') {
		canDrag = !window.matchMedia('(pointer: coarse)').matches;
	}
</script>

<div class="bg-surface fixed inset-0 bottom-24 left-0 overflow-y-auto md:bottom-30 md:left-23">
	<div class="flex h-full flex-col">
		<div class="bg-surface-container-high/80 sticky top-0 z-10 backdrop-blur-md">
			<div class="flex items-center gap-4 p-4 md:p-6">
				<div class="bg-primary-container flex h-10 w-10 items-center justify-center rounded-full">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						class="text-on-primary-container"
					>
						<path
							fill="currentColor"
							d="M14 6H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1m0 4H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1M4 16h6c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1M19 6c-1.1 0-2 .9-2 2v6.18c-.31-.11-.65-.18-1-.18c-1.84 0-3.28 1.64-2.95 3.54c.21 1.21 1.2 2.2 2.41 2.41c1.9.33 3.54-1.11 3.54-2.95V8h2c.55 0 1-.45 1-1s-.45-1-1-1z"
						/>
					</svg>
				</div>
				<div class="flex flex-col">
					<h1 class="queue-title">Queue</h1>
					<p class="text-on-surface-variant text-sm">
						{itemsCache.length}
						{itemsCache.length === 1 ? 'track' : 'tracks'}
					</p>
				</div>
			</div>
		</div>

		<div class="flex-1 p-4 pt-2 md:px-6 md:pb-6">
			<div class="bg-surface-container rounded-2xl shadow-sm">
				<ul class="divide-outline-variant/50 divide-y">
					{#each itemsCache as item, index (item.id)}
						<li
							animate:flip={{ duration: 300, easing: cubicOut }}
							class={$queueState.currentIndex === index ? 'bg-primary-container/30' : ''}
						>
							<ListTrack
								track={item}
								index={index + 1}
								trackNo={item.trackNumber}
								showThumbnail={true}
								showDropIndicator={dropIndex === index + 1}
								onRemove={() => removeQueueItem(index)}
								draggable={canDrag}
								playbackContext={itemsCache}
								playbackSource={$queueState.source}
								onDragStart={(e) => {
									if (!canDrag) return;
									dragIndex = index;
									dropIndex = index + 1;
									e.dataTransfer?.setData('text/plain', String(index));
									e.dataTransfer?.setDragImage(e.currentTarget as Element, 16, 16);
								}}
								onDragOver={(e) => {
									if (!canDrag) return;
									e.preventDefault();
									e.dataTransfer && (e.dataTransfer.dropEffect = 'move');
									dropIndex = index + 1;
								}}
								onDrop={(e) => {
									if (!canDrag) return;
									e.preventDefault();
									const fromIndex = dragIndex ?? Number(e.dataTransfer?.getData('text/plain'));
									const targetIndex = index;
									dragIndex = null;
									dropIndex = null;
									if (Number.isFinite(fromIndex)) {
										const adjustedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
										moveQueueItem(fromIndex, Math.max(0, adjustedTarget));
									}
								}}
								onDragEnd={() => {
									dragIndex = null;
									dropIndex = null;
								}}
							/>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</div>

<style>
	.queue-title {
		color: var(--color-secondary);
		font-size: 20px;
		font-family: 'Roboto Flex', sans-serif;
		font-weight: 700;
		font-style: normal;
		line-height: 24px;
		font-variation-settings:
			'slnt' 0,
			'wdth' 115,
			'GRAD' 50,
			'XOPQ' 96,
			'XTRA' 468,
			'YOPQ' 75,
			'YTAS' 750,
			'YTDE' -203,
			'YTFI' 728,
			'YTLC' 514,
			'YTUC' 712;
	}
</style>
