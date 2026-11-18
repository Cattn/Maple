<script lang="ts">
	import { activeSong, curTime } from '$lib/store';
	import { seekTo } from '$lib/player';
	import { OPFS } from '$lib/opfs';
	let { onClose, embedded = false }: { onClose: () => void; embedded?: boolean } = $props();
	let lines = $derived($activeSong.lyrics ?? []);
	let artwork = $state<string | null>(null);
	let container: HTMLDivElement;
	const index = $derived(
		lines.reduce(
			(last, line, i) => (line.time !== undefined && line.time <= $curTime ? i : last),
			-1
		)
	);
	$effect(() => {
		const image = $activeSong.image;
		let cancelled = false;
		let objectUrl: string | undefined;
		artwork = null;
		if (typeof image === 'string') {
			void OPFS.getImageUrl(image)
				.then((url) => {
					if (!cancelled) artwork = url;
				})
				.catch(() => {});
		} else if (image instanceof Blob) {
			objectUrl = URL.createObjectURL(image);
			artwork = objectUrl;
		}
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});
	$effect(() => {
		const element = container?.querySelector(`[data-line="${index}"]`);
		element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
/>
<section
	aria-label="Lyrics"
	class={[
		'bg-surface-container text-on-surface flex flex-col overflow-hidden',
		embedded
			? 'border-outline-variant min-h-0 min-w-0 rounded-3xl border'
			: 'fixed inset-0 z-[100] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
	]}
>
	<header class="border-outline-variant flex items-start justify-between gap-4 border-b p-6">
		<img
			src={artwork ?? '/placeholder.png'}
			alt="Album art"
			class="h-14 w-14 shrink-0 rounded-xl object-cover"
		/>
		<div class="min-w-0 flex-1">
			<h2 class="truncate text-xl font-bold">{$activeSong.title || 'Nothing playing'}</h2>
			<p class="text-on-surface-variant truncate text-sm">{$activeSong.artist}</p>
		</div>
		<button
			class="hover:bg-surface-container-high rounded-full px-3 py-2"
			onclick={onClose}
			aria-label="Close lyrics">✕</button
		>
	</header>
	<div
		bind:this={container}
		class={[
			'min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-10',
			embedded && 'inset-scrollbar inset-scrollbar-bottom'
		]}
	>
		{#each lines as line, i}
			<div
				data-line={i}
				class="my-5 transition-all duration-300"
				class:opacity-40={index >= 0 && i !== index}
			>
				{#if line.time !== undefined}<button
						class="hover:text-primary text-left text-2xl leading-relaxed font-bold transition-colors"
						class:text-primary={i === index}
						aria-current={i === index ? 'true' : undefined}
						onclick={() => seekTo(line.time!)}>{line.text || '♪'}</button
					>
				{:else}<p class="text-xl leading-relaxed font-medium whitespace-pre-wrap">
						{line.text || '\u00a0'}
					</p>{/if}
			</div>
		{/each}
	</div>
</section>
