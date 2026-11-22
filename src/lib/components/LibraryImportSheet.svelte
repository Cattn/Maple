<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		createLibrary,
		iosImportOpen,
		IOS_AUDIO_ACCEPT,
		isDirectoryPickerSupported,
		isIOS,
		isWebkitDirectorySupported,
		pickLibraryDirectory,
		pickLibraryFolder
	} from '$lib/library';

	let dragging = $state(false);
	let canDismiss = $state(false);
	let sheetDragY = $state(0);
	let sheetDragging = $state(false);
	let sheetDragStartY = 0;
	const DISMISS_THRESHOLD = 120;

	function isMobileSheetPlatform(): boolean {
		if (isIOS()) return true;
		if (typeof navigator === 'undefined') return false;
		return /Android/i.test(navigator.userAgent);
	}

	let useSheet = $derived($iosImportOpen && isMobileSheetPlatform());
	let directoryPickerAvailable = $derived($iosImportOpen && isDirectoryPickerSupported());
	let webkitDirectoryAvailable = $derived($iosImportOpen && isWebkitDirectorySupported());
	let canPickDirectory = $derived(directoryPickerAvailable || webkitDirectoryAvailable);

	function close() {
		if (useSheet && !canDismiss) return;
		forceClose();
	}

	function forceClose() {
		sheetDragY = 0;
		sheetDragging = false;
		canDismiss = false;
		iosImportOpen.set(false);
	}

	async function handleSelected(files: FileList | File[] | null | undefined) {
		const snapshot = files && files.length > 0 ? Array.from(files) : [];
		if (snapshot.length === 0) return;
		forceClose();
		await createLibrary(snapshot);
	}

	function onInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const snapshot = input.files ? Array.from(input.files) : [];
		input.value = '';
		void handleSelected(snapshot);
	}

	async function onPickDirectory(link: boolean) {
		const selection = link ? await pickLibraryFolder() : await pickLibraryDirectory();
		if (!selection) return;
		forceClose();
		await createLibrary(selection);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function onDragLeave() {
		dragging = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		void handleSelected(e.dataTransfer?.files);
	}

	function onSheetIntroEnd() {
		canDismiss = true;
	}

	function handleSheetDragDown(event: PointerEvent) {
		if (!useSheet || !canDismiss) return;
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
			forceClose();
			return;
		}
		sheetDragY = 0;
	}
</script>

{#if $iosImportOpen}
	<div
		class="fixed inset-0 z-70 bg-black/50"
		style={useSheet && sheetDragY > 0
			? `opacity: ${Math.max(0, 1 - sheetDragY / 300)}`
			: undefined}
		transition:fade={{ duration: 300, easing: cubicOut }}
		onpointerdown={close}
		role="presentation"
	></div>
	<div
		class={[
			'fixed z-70 flex justify-center',
			useSheet
				? 'inset-x-0 bottom-0 px-4 pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0))]'
				: 'inset-0 items-center px-4 py-8',
			useSheet && !canDismiss && 'pointer-events-none',
			useSheet && !sheetDragging && 'transition-transform duration-200 ease-out'
		]}
		style={useSheet && (sheetDragY > 0 || sheetDragging)
			? `transform: translateY(${sheetDragY}px)`
			: undefined}
		transition:fly={{ y: useSheet ? '100%' : 16, duration: 300, easing: cubicOut }}
		onintroend={onSheetIntroEnd}
		onpointerdown={close}
		role="presentation"
	>
		<div
			class={[
				'bg-surface-container-high flex w-full max-w-md flex-col gap-4 rounded-2xl p-5 shadow-xl',
				useSheet && 'pt-1'
			]}
			role="dialog"
			aria-modal="true"
			aria-label="Upload music"
			tabindex="-1"
			onpointerdown={(e) => e.stopPropagation()}
		>
			{#if useSheet}
				<div
					class="flex w-full touch-none cursor-grab items-center justify-center py-3 active:cursor-grabbing"
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
							forceClose();
						}
					}}
				>
					<span class="bg-on-surface/30 block h-1.5 w-12 rounded-full"></span>
				</div>
			{/if}

			<div class="flex flex-col gap-1">
				<h2 class="text-on-surface text-lg font-semibold">Upload music</h2>
				<p class="text-on-surface-variant text-sm">
					{#if directoryPickerAvailable}
						Import a copy, or link a folder to play its music in place.
					{:else if canPickDirectory}
						Select multiple audio files, a folder, or drag them here.
					{:else}
						Select multiple audio files, or drag them here.
					{/if}
				</p>
			</div>

			<div class="flex flex-col gap-3">
				<label
					class="bg-primary text-on-primary relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-4 py-3 text-sm font-semibold"
				>
					<input
						type="file"
						multiple
						accept={IOS_AUDIO_ACCEPT}
						class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
						onchange={onInputChange}
					/>
					Import files
				</label>

				{#if directoryPickerAvailable}
					<button
						type="button"
						class="bg-primary text-on-primary relative flex flex-1 cursor-pointer items-center justify-center rounded-full border-none px-4 py-3 text-sm font-semibold"
						onclick={() => void onPickDirectory(false)}
					>
						Import folder
					</button>
					<button
						type="button"
						class="bg-primary text-on-primary relative flex flex-1 cursor-pointer items-center justify-center rounded-full border-none px-4 py-3 text-sm font-semibold"
						onclick={() => void onPickDirectory(true)}
					>
						Link folder
					</button>
				{:else if webkitDirectoryAvailable}
					<label
						class="bg-primary text-on-primary relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-4 py-3 text-sm font-semibold"
					>
						<input
							type="file"
							multiple
							webkitdirectory
							class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
							onchange={onInputChange}
						/>
						Import folder
					</label>
				{/if}
			</div>

			<div
				class={[
					'text-on-surface-variant flex min-h-28 items-center justify-center rounded-xl border-2 border-dashed px-4 text-center text-sm',
					dragging ? 'border-primary bg-primary/10' : 'border-outline/40'
				]}
				role="group"
				aria-label="Drop audio files here"
				ondragover={onDragOver}
				ondragleave={onDragLeave}
				ondrop={onDrop}
			>
				Drop audio files here
			</div>

			<button
				type="button"
				class="text-on-surface-variant hover:bg-surface-container-highest rounded-xl border-none bg-transparent px-4 py-2 text-sm font-medium"
				onclick={forceClose}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
