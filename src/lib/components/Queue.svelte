<script lang="ts">
	import { queueState } from '$lib/store';
	import { get } from 'svelte/store';
	import ListTrack from '$lib/components/ListTrack.svelte';
	import { visibleFlip } from '$lib/animate';
	import { cubicOut } from 'svelte/easing';

	let { onClose, embedded = false }: { onClose?: () => void; embedded?: boolean } = $props();

	let dragIndex = $state<number | null>(null);
	let dropIndex = $state<number | null>(null);
	let canDrag = $state(true);
	const firstVisibleIndex = $derived(Math.max(0, $queueState.currentIndex));
	const visibleItems = $derived($queueState.items.slice(firstVisibleIndex));

	function moveQueueItem(fromIndex: number, toIndex: number) {
		const state = get(queueState);
		if (fromIndex === toIndex) return;
		const firstVisibleIndex = Math.max(0, state.currentIndex);
		if (
			fromIndex < firstVisibleIndex ||
			toIndex < firstVisibleIndex ||
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
	}

	if (typeof window !== 'undefined') {
		canDrag = !window.matchMedia('(pointer: coarse)').matches;
	}
</script>

<section
	aria-label="Queue"
	class={[
		'bg-surface',
		embedded
			? 'border-outline-variant min-h-0 min-w-0 overflow-clip rounded-3xl border'
			: 'fixed inset-0 bottom-24 z-40 overflow-y-auto'
	]}
>
	<div class="flex h-full flex-col">
		<header
			class="bg-surface-container border-outline-variant sticky top-0 z-10 max-md:shadow-[inset_0_-1px_rgb(var(--m3-scheme-outline-variant))] md:shrink-0 md:border-b"
		>
			<div class="flex items-center gap-4 p-4 md:items-start md:p-6">
				<div
					class="bg-primary-container flex size-10 shrink-0 items-center justify-center rounded-xl md:size-14"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						class="text-on-primary-container md:size-6"
					>
						<path
							fill="currentColor"
							d="M14 6H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1m0 4H4c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1M4 16h6c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1M19 6c-1.1 0-2 .9-2 2v6.18c-.31-.11-.65-.18-1-.18c-1.84 0-3.28 1.64-2.95 3.54c.21 1.21 1.2 2.2 2.41 2.41c1.9.33 3.54-1.11 3.54-2.95V8h2c.55 0 1-.45 1-1s-.45-1-1-1z"
						/>
					</svg>
				</div>
				<div class="flex min-w-0 flex-1 flex-col">
					<h2 class="text-on-surface truncate text-xl leading-6 font-bold md:leading-7">Queue</h2>
					<p class="text-on-surface-variant text-sm">
						{visibleItems.length}
						{visibleItems.length === 1 ? 'track' : 'tracks'}
					</p>
				</div>
				{#if onClose}
					<button
						type="button"
						class="hover:bg-surface-container-high flex size-10 shrink-0 items-center justify-center rounded-full md:block md:size-auto md:px-3 md:py-2"
						onclick={onClose}
						aria-label="Close queue">✕</button
					>
				{/if}
			</div>
		</header>

		<div
			class={[
				'flex-1 p-4 pt-2 md:min-h-0 md:overflow-y-auto md:overscroll-y-contain md:px-6 md:pb-6',
				embedded && 'inset-scrollbar inset-scrollbar-bottom'
			]}
		>
			<div class="bg-surface-container rounded-2xl shadow-sm">
				<ul class="divide-outline-variant/50 divide-y">
					{#each visibleItems as item, visibleIndex (item.id)}
						{@const index = firstVisibleIndex + visibleIndex}
						<li
							animate:visibleFlip={{ duration: 300, easing: cubicOut }}
							class={$queueState.currentIndex === index ? 'bg-primary-container/30' : ''}
						>
							<ListTrack
								track={item}
								index={visibleIndex + 1}
								trackNo={item.trackNumber}
								showThumbnail={true}
								showDropIndicator={dropIndex === index + 1}
								onRemove={() => removeQueueItem(index)}
								draggable={canDrag}
								playbackContext={$queueState.items}
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
</section>
