<script lang="ts">
	import { tick } from 'svelte';
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

	type ImportMode = 'link' | 'copy';

	let mode = $state<ImportMode>('link');
	let fileDragDepth = $state(0);
	let canDismiss = $state(false);
	let sheetDragY = $state(0);
	let sheetDragging = $state(false);
	let busyAction = $state<'link' | 'copy-folder' | null>(null);
	let dialogEl = $state<HTMLDivElement | undefined>(undefined);
	let copyTabEl = $state<HTMLButtonElement | undefined>(undefined);
	let linkTabEl = $state<HTMLButtonElement | undefined>(undefined);
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
	let activeMode = $derived<ImportMode>(directoryPickerAvailable ? mode : 'copy');

	$effect(() => {
		if (!$iosImportOpen) return;
		const previousFocus =
			typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
		let cancelled = false;
		void tick().then(() => {
			if (!cancelled) dialogEl?.focus({ preventScroll: true });
		});
		return () => {
			cancelled = true;
			if (previousFocus?.isConnected) {
				previousFocus.focus({ preventScroll: true });
			}
		};
	});

	function close() {
		if (useSheet && !canDismiss) return;
		forceClose();
	}

	function forceClose() {
		mode = 'link';
		fileDragDepth = 0;
		sheetDragY = 0;
		sheetDragging = false;
		canDismiss = false;
		busyAction = null;
		iosImportOpen.set(false);
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (!$iosImportOpen) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			forceClose();
		}
	}

	function onTabKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const next: ImportMode = mode === 'link' ? 'copy' : 'link';
		mode = next;
		(next === 'link' ? linkTabEl : copyTabEl)?.focus();
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
		if (busyAction) return;
		busyAction = link ? 'link' : 'copy-folder';
		try {
			const selection = link ? await pickLibraryFolder() : await pickLibraryDirectory();
			if (!selection) return;
			forceClose();
			await createLibrary(selection);
		} finally {
			busyAction = null;
		}
	}

	function onDragEnter(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		fileDragDepth++;
	}

	function onDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave() {
		fileDragDepth = Math.max(0, fileDragDepth - 1);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		fileDragDepth = 0;
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

<svelte:window onkeydown={onWindowKeydown} />

{#if $iosImportOpen}
	<div
		class="fixed inset-0 z-70 bg-black/50"
		style={useSheet && sheetDragY > 0 ? `opacity: ${Math.max(0, 1 - sheetDragY / 300)}` : undefined}
		transition:fade={{ duration: 220, easing: cubicOut }}
		onpointerdown={close}
		role="presentation"
	></div>
	<div
		class={[
			'fixed z-70 flex justify-center',
			useSheet ? 'inset-x-0 bottom-0 pt-10' : 'inset-0 items-center px-4 py-8',
			useSheet && !canDismiss && 'pointer-events-none',
			useSheet && !sheetDragging && 'transition-transform duration-200 ease-out'
		]}
		style={useSheet && (sheetDragY > 0 || sheetDragging)
			? `transform: translateY(${sheetDragY}px)`
			: undefined}
		transition:fly={{ y: useSheet ? '100%' : 16, duration: useSheet ? 280 : 200, easing: cubicOut }}
		onintroend={onSheetIntroEnd}
		onpointerdown={close}
		role="presentation"
	>
		<div
			bind:this={dialogEl}
			class={[
				'bg-surface-container-high ring-outline-variant/35 relative flex w-full max-w-md flex-col gap-5 overflow-hidden shadow-xl ring-1 outline-none',
				useSheet
					? 'max-h-[calc(100dvh-2.5rem)] rounded-t-3xl px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom,0))]'
					: 'max-h-[calc(100dvh-3rem)] rounded-3xl p-6'
			]}
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-music-title"
			tabindex="-1"
			onpointerdown={(e) => e.stopPropagation()}
			ondragenter={onDragEnter}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
			ondrop={onDrop}
		>
			{#if useSheet}
				<div
					class="flex w-full shrink-0 cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
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

			<div class="flex items-center justify-between gap-3">
				<h2 id="add-music-title" class="text-on-surface text-xl font-bold tracking-tight">
					Add music
				</h2>
				<button
					type="button"
					aria-label="Close"
					class="text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-primary -mr-1.5 grid size-9 cursor-pointer place-items-center rounded-full border-none bg-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
					onclick={forceClose}
				>
					<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
						/>
					</svg>
				</button>
			</div>

			{#if directoryPickerAvailable}
				<div
					role="tablist"
					aria-label="Import method"
					class="bg-surface-container-highest grid w-full grid-cols-2 gap-1 rounded-full p-1"
				>
					<button
						bind:this={linkTabEl}
						type="button"
						role="tab"
						id="add-music-tab-link"
						aria-selected={activeMode === 'link'}
						aria-controls="add-music-panel-link"
						tabindex={activeMode === 'link' ? 0 : -1}
						onclick={() => (mode = 'link')}
						onkeydown={onTabKeydown}
						class={[
							'focus-visible:outline-primary flex cursor-pointer items-center justify-center gap-2 rounded-full border-none px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2',
							activeMode === 'link'
								? 'bg-primary text-on-primary shadow-sm'
								: 'text-on-surface-variant hover:text-on-surface bg-transparent'
						]}
					>
						<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M11 17H7q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h4v2H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h4zm-3-4v-2h8v2zm5 4v-2h4q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-4V7h4q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"
							/>
						</svg>
						Link library
					</button>

					<button
						bind:this={copyTabEl}
						type="button"
						role="tab"
						id="add-music-tab-copy"
						aria-selected={activeMode === 'copy'}
						aria-controls="add-music-panel-copy"
						tabindex={activeMode === 'copy' ? 0 : -1}
						onclick={() => (mode = 'copy')}
						onkeydown={onTabKeydown}
						class={[
							'focus-visible:outline-primary flex cursor-pointer items-center justify-center gap-2 rounded-full border-none px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2',
							activeMode === 'copy'
								? 'bg-primary text-on-primary shadow-sm'
								: 'text-on-surface-variant hover:text-on-surface bg-transparent'
						]}
					>
						<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
							<path
								fill="currentColor"
								d="M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20zm5-12.15L9.125 9.725q-.3.3-.712.288T7.7 9.7q-.275-.3-.288-.7t.288-.7l3.6-3.6q.15-.15.325-.212T12 4.425t.375.063t.325.212l3.6 3.6q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L13 7.85V15q0 .425-.288.713T12 16t-.712-.288T11 15z"
							/>
						</svg>
						Add a copy
					</button>
				</div>
			{/if}

			<div class={directoryPickerAvailable ? 'grid' : undefined}>
				{#if directoryPickerAvailable}
					<div
						id="add-music-panel-link"
						role="tabpanel"
						aria-labelledby="add-music-tab-link"
						aria-hidden={activeMode !== 'link'}
						inert={activeMode !== 'link'}
						class={[
							'col-start-1 row-start-1 flex flex-col justify-between gap-4',
							activeMode !== 'link' && 'pointer-events-none invisible select-none'
						]}
					>
						<p class="text-on-surface-variant text-sm leading-relaxed">
							Play music directly from a folder and its subfolders without copying files. You can
							refresh or relink folders anytime in Settings.
						</p>

						<button
							type="button"
							disabled={busyAction !== null}
							class={[
								'bg-primary text-on-primary hover:bg-primary/90 focus-visible:outline-primary mt-auto w-full cursor-pointer rounded-full border-none px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
								useSheet ? 'min-h-11' : 'min-h-10'
							]}
							onclick={() => void onPickDirectory(true)}
						>
							{busyAction === 'link' ? 'Opening…' : 'Link folder'}
						</button>
					</div>
				{/if}

				<div
					id="add-music-panel-copy"
					role={directoryPickerAvailable ? 'tabpanel' : undefined}
					aria-labelledby={directoryPickerAvailable ? 'add-music-tab-copy' : undefined}
					aria-hidden={directoryPickerAvailable ? activeMode !== 'copy' : undefined}
					inert={directoryPickerAvailable && activeMode !== 'copy'}
					class={[
						'flex flex-col gap-4',
						directoryPickerAvailable && 'col-start-1 row-start-1',
						directoryPickerAvailable &&
							activeMode !== 'copy' &&
							'pointer-events-none invisible select-none'
					]}
				>
					<p class="text-on-surface-variant text-sm leading-relaxed">
						Store copies of your music inside Maple on this device.
					</p>

					{#if !useSheet}
						<div
							class="border-outline-variant/75 text-on-surface-variant flex min-h-20 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm"
						>
							Drop audio files here
						</div>
					{/if}

					<div class={['mt-auto flex gap-2.5', useSheet ? 'flex-col' : 'flex-row']}>
						{#if directoryPickerAvailable}
							<button
								type="button"
								disabled={busyAction !== null}
								class={[
									'bg-primary text-on-primary hover:bg-primary/90 focus-visible:outline-primary flex-1 cursor-pointer rounded-full border-none px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
									useSheet ? 'min-h-11' : 'min-h-10'
								]}
								onclick={() => void onPickDirectory(false)}
							>
								{busyAction === 'copy-folder' ? 'Reading…' : 'Choose folder'}
							</button>
						{:else if webkitDirectoryAvailable}
							<label
								class={[
									'bg-primary text-on-primary hover:bg-primary/90 focus-within:outline-primary relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors focus-within:outline-2 focus-within:outline-offset-2',
									useSheet ? 'min-h-11' : 'min-h-10'
								]}
							>
								<input
									type="file"
									multiple
									webkitdirectory
									class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
									onchange={onInputChange}
								/>
								Choose folder
							</label>
						{/if}

						<label
							class={[
								canPickDirectory
									? 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80'
									: 'bg-primary text-on-primary hover:bg-primary/90',
								'focus-within:outline-primary relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors focus-within:outline-2 focus-within:outline-offset-2',
								useSheet ? 'min-h-11' : 'min-h-10',
								busyAction !== null && 'pointer-events-none opacity-60'
							]}
						>
							<input
								type="file"
								multiple
								accept={IOS_AUDIO_ACCEPT}
								disabled={busyAction !== null}
								class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
								onchange={onInputChange}
							/>
							Choose files
						</label>
					</div>
				</div>
			</div>

			{#if fileDragDepth > 0}
				<div
					transition:fade={{ duration: 120 }}
					class="bg-surface-container-high/95 border-primary text-primary pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center"
					role="status"
				>
					<span class="text-sm font-semibold">Drop to add a copy</span>
					<span class="text-on-surface-variant text-xs">Stored in Maple on this device</span>
				</div>
			{/if}
		</div>
	</div>
{/if}
