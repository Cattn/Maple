<script lang="ts">
	import { activeSong, curTime } from '$lib/store';
	import { seekTo } from '$lib/player';
	import { OPFS } from '$lib/opfs';
	import { parseBlob } from 'music-metadata';
	import { embeddedLyrics } from '$lib/lyrics';
	import type { LyricLine } from '$lib/types';
	let { onClose }: { onClose: () => void } = $props();
	let lines = $state<LyricLine[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let container: HTMLDivElement;
	const index = $derived(
		lines.reduce(
			(last, line, i) => (line.time !== undefined && line.time <= $curTime ? i : last),
			-1
		)
	);
	$effect(() => {
		const song = $activeSong;
		let cancelled = false;
		lines = song.lyrics ?? [];
		failed = false;
		loading = !song.lyrics && !!song.id;
		if (loading)
			(async () => {
				try {
					const result = await OPFS.downloadFile(`/tracks/${song.id}.${song.ext}`);
					const blob = await (result[1] as Response).blob();
					const metadata = await parseBlob(blob, { skipCovers: true });
					const lyrics = embeddedLyrics(metadata.common.lyrics);
					if (!cancelled) lines = lyrics ?? [];
				} catch {
					if (!cancelled) failed = true;
				} finally {
					if (!cancelled) loading = false;
				}
			})();
		return () => {
			cancelled = true;
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
	class="bg-surface-container text-on-surface border-outline-variant fixed inset-0 z-[100] flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:top-6 md:right-8 md:bottom-36 md:w-[min(440px,45vw)] md:rounded-3xl md:border md:py-0 md:shadow-2xl"
>
	<header class="border-outline-variant flex items-start justify-between gap-4 border-b p-6">
		<div class="min-w-0">
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
		class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-10 [scrollbar-width:thin]"
	>
		{#if loading}<p class="text-on-surface-variant">Loading lyrics…</p>
		{:else if !lines.length}<p class="text-on-surface-variant">
				{failed
					? 'Could not load lyrics. Close and reopen to retry.'
					: 'No embedded lyrics found. Add an LRC or text file using the track menu when external lyrics are enabled in Settings.'}
			</p>
		{:else}
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
		{/if}
	</div>
</section>
