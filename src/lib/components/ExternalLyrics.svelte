<script lang="ts">
	import type { Song } from '$lib/types';
	import { parseLyrics } from '$lib/lyrics';
	import { OPFS } from '$lib/opfs';
	import { refreshLibrary } from '$lib/global.svelte';
	import { activeSong } from '$lib/store';
	import { toast } from 'svelte-sonner';
	let { track, onDone }: { track: Song; onDone: () => void } = $props();
	let input: HTMLInputElement;
	async function upload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			if (!/\.(lrc|txt)$/i.test(file.name) || file.size > 1024 * 1024)
				throw new Error('Choose an LRC or TXT file under 1 MB.');
			const lyrics = parseLyrics(await file.text());
			if (!lyrics.some((line) => line.text.trim())) throw new Error('The lyrics file is empty.');
			await OPFS.setLyrics(track.id, lyrics);
			if ($activeSong.id === track.id) activeSong.set({ ...$activeSong, lyrics });
			await refreshLibrary();
			toast.success('Lyrics added');
			onDone();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Could not add lyrics');
		} finally {
			input.value = '';
		}
	}
</script>

<input bind:this={input} type="file" accept=".lrc,.txt" class="hidden" onchange={upload} />
<button
	class="text-on-surface hover:bg-surface-container-high w-full px-4 py-3 text-left text-sm font-medium"
	onclick={() => input.click()}>Add external lyrics</button
>
