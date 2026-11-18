<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { DEFAULT_SOURCE_COLOR } from '$lib/theme/theme';

	type Preset = {
		name: string;
		hex: string;
	};

	const PRESETS: Preset[] = [
		{ name: 'Maple Rose', hex: '#8f4a4c' },
		{ name: 'Terracotta', hex: '#b85d3b' },
		{ name: 'Amber Gold', hex: '#a67c2e' },
		{ name: 'Forest Sage', hex: '#3b7a57' },
		{ name: 'Ocean Teal', hex: '#2b7a82' },
		{ name: 'Cobalt Blue', hex: '#3d63a8' },
		{ name: 'Indigo Iris', hex: '#6152a8' },
		{ name: 'Plum Violet', hex: '#8e4a85' },
		{ name: 'Graphite Slate', hex: '#5e6670' }
	];

	let {
		value,
		onchange,
		defaultColor = DEFAULT_SOURCE_COLOR
	}: {
		value: string;
		onchange: (hex: string) => void;
		defaultColor?: string;
	} = $props();

	function clamp(n: number, min: number, max: number) {
		return Math.min(max, Math.max(min, n));
	}

	function normalizeHex(raw: string): string | null {
		const cleaned = raw.trim().replace(/^#/, '');
		if (/^[0-9a-f]{6}$/i.test(cleaned)) {
			return `#${cleaned.toLowerCase()}`;
		}
		if (/^[0-9a-f]{3}$/i.test(cleaned)) {
			const expanded = cleaned
				.split('')
				.map((ch) => ch + ch)
				.join('');
			return `#${expanded.toLowerCase()}`;
		}
		return null;
	}

	function hexToRgb(hex: string) {
		const normalized = normalizeHex(hex) ?? DEFAULT_SOURCE_COLOR;
		const num = parseInt(normalized.slice(1), 16);
		return {
			r: (num >> 16) & 255,
			g: (num >> 8) & 255,
			b: num & 255
		};
	}

	function isLightColor(hex: string) {
		const { r, g, b } = hexToRgb(hex);
		return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
	}

	function hexToHsv(hex: string) {
		const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
		const r = r255 / 255;
		const g = g255 / 255;
		const b = b255 / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;

		let h = 0;
		if (d !== 0) {
			if (max === r) h = ((g - b) / d) % 6;
			else if (max === g) h = (b - r) / d + 2;
			else h = (r - g) / d + 4;
			h = Math.round(h * 60);
			if (h < 0) h += 360;
		}
		const s = max === 0 ? 0 : (d / max) * 100;
		const v = max * 100;
		return { h, s, v };
	}

	function hsvToHex(h: number, s: number, v: number): string {
		const hueDeg = ((h % 360) + 360) % 360;
		const satFrac = clamp(s, 0, 100) / 100;
		const valFrac = clamp(v, 0, 100) / 100;

		const c = valFrac * satFrac;
		const x = c * (1 - Math.abs(((hueDeg / 60) % 2) - 1));
		const m = valFrac - c;

		let r = 0;
		let g = 0;
		let b = 0;
		if (hueDeg < 60) [r, g, b] = [c, x, 0];
		else if (hueDeg < 120) [r, g, b] = [x, c, 0];
		else if (hueDeg < 180) [r, g, b] = [0, c, x];
		else if (hueDeg < 240) [r, g, b] = [0, x, c];
		else if (hueDeg < 300) [r, g, b] = [x, 0, c];
		else [r, g, b] = [c, 0, x];

		const toHex = (channel: number) =>
			Math.round((channel + m) * 255)
				.toString(16)
				.padStart(2, '0');

		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}

	let normalizedValue = $derived(normalizeHex(value) ?? defaultColor.toLowerCase());
	let isDefault = $derived(normalizedValue === defaultColor.toLowerCase());

	let hue = $state(0);
	let sat = $state(48);
	let val = $state(56);
	let hexInput = $state(DEFAULT_SOURCE_COLOR);
	let editingHex = $state(false);
	let draggingSv = $state(false);
	let draggingHue = $state(false);

	let svPad: HTMLDivElement | undefined = $state();
	let hueTrack: HTMLDivElement | undefined = $state();
	let pendingFrame: number | null = null;
	let queuedHex: string | null = null;

	const supportsEyeDropper = browser && 'EyeDropper' in window;

	$effect(() => {
		const target = normalizedValue;
		if (!editingHex) {
			hexInput = target.toUpperCase();
		}
		if (hsvToHex(hue, sat, val) !== target) {
			const parsed = hexToHsv(target);
			if (parsed.s > 0 && parsed.v > 0) {
				hue = parsed.h;
			}
			sat = parsed.s;
			val = parsed.v;
		}
	});

	function cancelPendingEmit() {
		if (pendingFrame !== null) {
			cancelAnimationFrame(pendingFrame);
			pendingFrame = null;
		}
		queuedHex = null;
	}

	function scheduleEmit(nextHex: string) {
		queuedHex = nextHex;
		if (!editingHex) {
			hexInput = nextHex.toUpperCase();
		}
		if (pendingFrame !== null) return;
		pendingFrame = requestAnimationFrame(() => {
			pendingFrame = null;
			if (queuedHex) {
				const emitValue = queuedHex;
				queuedHex = null;
				onchange(emitValue);
			}
		});
	}

	function selectDirect(nextHex: string) {
		cancelPendingEmit();
		const normalized = normalizeHex(nextHex);
		if (!normalized) return;
		const parsed = hexToHsv(normalized);
		if (parsed.s > 0 && parsed.v > 0) {
			hue = parsed.h;
		}
		sat = parsed.s;
		val = parsed.v;
		hexInput = normalized.toUpperCase();
		onchange(normalized);
	}

	function updateSvFromClient(clientX: number, clientY: number) {
		if (!svPad) return;
		const rect = svPad.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const nextSat = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
		const nextVal = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
		sat = nextSat;
		val = nextVal;
		scheduleEmit(hsvToHex(hue, sat, val));
	}

	function handleSvPointerDown(event: PointerEvent) {
		if (!svPad) return;
		draggingSv = true;
		svPad.setPointerCapture(event.pointerId);
		updateSvFromClient(event.clientX, event.clientY);
	}

	function handleSvPointerMove(event: PointerEvent) {
		if (!draggingSv) return;
		updateSvFromClient(event.clientX, event.clientY);
	}

	function handleSvPointerUp(event: PointerEvent) {
		if (!draggingSv) return;
		draggingSv = false;
		try {
			svPad?.releasePointerCapture(event.pointerId);
		} catch {}
		cancelPendingEmit();
		const finalHex = hsvToHex(hue, sat, val);
		onchange(finalHex);
	}

	function handleSvKeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 10 : 2;
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			sat = clamp(sat + step, 0, 100);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			sat = clamp(sat - step, 0, 100);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			val = clamp(val + step, 0, 100);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			val = clamp(val - step, 0, 100);
		} else {
			return;
		}
		const next = hsvToHex(hue, sat, val);
		hexInput = next.toUpperCase();
		onchange(next);
	}

	function updateHueFromClient(clientX: number) {
		if (!hueTrack) return;
		const rect = hueTrack.getBoundingClientRect();
		if (!rect.width) return;
		const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
		hue = ratio * 360;
		scheduleEmit(hsvToHex(hue, sat, val));
	}

	function handleHuePointerDown(event: PointerEvent) {
		if (!hueTrack) return;
		draggingHue = true;
		hueTrack.setPointerCapture(event.pointerId);
		updateHueFromClient(event.clientX);
	}

	function handleHuePointerMove(event: PointerEvent) {
		if (!draggingHue) return;
		updateHueFromClient(event.clientX);
	}

	function handleHuePointerUp(event: PointerEvent) {
		if (!draggingHue) return;
		draggingHue = false;
		try {
			hueTrack?.releasePointerCapture(event.pointerId);
		} catch {}
		cancelPendingEmit();
		onchange(hsvToHex(hue, sat, val));
	}

	function handleHueKeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 15 : 3;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
			event.preventDefault();
			hue = (hue + step) % 360;
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
			event.preventDefault();
			hue = (hue - step + 360) % 360;
		} else {
			return;
		}
		const next = hsvToHex(hue, sat, val);
		hexInput = next.toUpperCase();
		onchange(next);
	}

	function handleHexInput(event: Event) {
		const raw = (event.currentTarget as HTMLInputElement).value;
		hexInput = raw;
		const cleaned = raw.trim().replace(/^#/, '');
		if (/^[0-9a-f]{6}$/i.test(cleaned)) {
			const normalized = `#${cleaned.toLowerCase()}`;
			const parsed = hexToHsv(normalized);
			if (parsed.s > 0 && parsed.v > 0) hue = parsed.h;
			sat = parsed.s;
			val = parsed.v;
			onchange(normalized);
		}
	}

	function commitHexInput() {
		editingHex = false;
		const normalized = normalizeHex(hexInput);
		if (normalized) {
			selectDirect(normalized);
		} else {
			hexInput = normalizedValue.toUpperCase();
		}
	}

	async function pickWithEyeDropper() {
		if (!supportsEyeDropper) return;
		try {
			const EyeDropperCtor = (
				window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }
			).EyeDropper;
			const result = await new EyeDropperCtor().open();
			if (result?.sRGBHex) {
				selectDirect(result.sRGBHex);
			}
		} catch {
			// User cancelled eyedropper
		}
	}

	onDestroy(() => {
		if (pendingFrame !== null) {
			cancelAnimationFrame(pendingFrame);
		}
	});
</script>

<div class="flex flex-col gap-5">
	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="text-on-surface-variant text-xs font-semibold tracking-wide uppercase"
				>Presets</span
			>
			<div class="flex items-center gap-1.5" title="Generated Material palette preview">
				<span class="text-on-surface-variant mr-1 text-[11px] font-medium">Palette</span>
				<span class="bg-primary ring-outline-variant/60 h-4 w-4 rounded-full ring-1" title="Primary"
				></span>
				<span
					class="bg-primary-container ring-outline-variant/60 h-4 w-4 rounded-full ring-1"
					title="Primary container"
				></span>
				<span
					class="bg-secondary ring-outline-variant/60 h-4 w-4 rounded-full ring-1"
					title="Secondary"
				></span>
				<span
					class="bg-tertiary ring-outline-variant/60 h-4 w-4 rounded-full ring-1"
					title="Tertiary"
				></span>
			</div>
		</div>

		<div class="flex flex-wrap gap-2.5" role="group" aria-label="Theme color presets">
			{#each PRESETS as preset (preset.hex)}
				{@const selected = normalizedValue === preset.hex}
				<button
					type="button"
					onclick={() => selectDirect(preset.hex)}
					aria-label={`Select ${preset.name} theme color`}
					aria-pressed={selected}
					title={preset.name}
					class={[
						'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--m3-scheme-primary))] sm:h-10 sm:w-10',
						selected
							? 'ring-on-surface ring-offset-surface-container-low scale-105 ring-2 ring-offset-2'
							: 'ring-1 ring-black/15 hover:scale-105'
					]}
					style={`background-color: ${preset.hex};`}
				>
					{#if selected}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							class={isLightColor(preset.hex) ? 'text-neutral-900' : 'text-white'}
						>
							<path
								fill="currentColor"
								d="m9.55 18l-5.7-5.7l1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z"
							/>
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div
		class="bg-surface-container ring-outline-variant/60 flex flex-col gap-4 rounded-2xl p-3.5 ring-1 sm:p-4"
	>
		<!-- 2D Saturation / Brightness canvas -->
		<div
			bind:this={svPad}
			role="slider"
			tabindex="0"
			aria-label="Color saturation and brightness"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(val)}
			aria-valuetext={`Saturation ${Math.round(sat)}%, brightness ${Math.round(val)}%`}
			class="relative h-40 w-full cursor-crosshair touch-none rounded-xl select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--m3-scheme-primary))] sm:h-44"
			onpointerdown={handleSvPointerDown}
			onpointermove={handleSvPointerMove}
			onpointerup={handleSvPointerUp}
			onpointercancel={handleSvPointerUp}
			onkeydown={handleSvKeydown}
		>
			<div
				class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl ring-1 ring-black/15"
				style={`background-color: hsl(${hue}, 100%, 50%);`}
			>
				<div
					class="absolute inset-0"
					style="background: linear-gradient(to right, #ffffff, transparent);"
				></div>
				<div
					class="absolute inset-0"
					style="background: linear-gradient(to top, #000000, transparent);"
				></div>
			</div>
			<div
				class={[
					'pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-75',
					draggingSv && 'scale-125'
				]}
				style={`left: ${sat}%; top: ${100 - val}%; background-color: ${normalizedValue};`}
			></div>
		</div>

		<!-- Hue slider -->
		<div class="flex flex-col gap-1.5">
			<div
				bind:this={hueTrack}
				role="slider"
				tabindex="0"
				aria-label="Color hue"
				aria-valuemin={0}
				aria-valuemax={360}
				aria-valuenow={Math.round(hue)}
				class="relative -my-2 flex cursor-pointer touch-none items-center py-2 select-none focus-visible:outline-none"
				onpointerdown={handleHuePointerDown}
				onpointermove={handleHuePointerMove}
				onpointerup={handleHuePointerUp}
				onpointercancel={handleHuePointerUp}
				onkeydown={handleHueKeydown}
			>
				<div
					class="h-4 w-full rounded-full ring-1 ring-black/15"
					style="background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);"
				></div>
				<div
					class={[
						'pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.35)] transition-transform duration-75',
						draggingHue && 'scale-115'
					]}
					style={`left: ${(hue / 360) * 100}%; background-color: hsl(${hue}, 100%, 50%);`}
				></div>
			</div>
		</div>

		<!-- Hex input + utility actions -->
		<div class="flex flex-wrap items-center gap-2.5">
			<div
				class="bg-surface ring-outline-variant focus-within:ring-primary flex min-w-36 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 ring-1 transition focus-within:ring-2"
			>
				<span
					class="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/20"
					style={`background-color: ${normalizedValue};`}
				></span>
				<input
					type="text"
					value={hexInput}
					maxlength={7}
					spellcheck="false"
					aria-label="Hex color code"
					placeholder="#8F4A4C"
					onfocus={() => (editingHex = true)}
					oninput={handleHexInput}
					onblur={commitHexInput}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							commitHexInput();
						}
					}}
					class="text-on-surface placeholder:text-on-surface-variant/60 w-full bg-transparent font-mono text-sm font-medium tracking-wider uppercase outline-none"
				/>
			</div>

			{#if supportsEyeDropper}
				<button
					type="button"
					onclick={pickWithEyeDropper}
					aria-label="Pick color from screen"
					title="Pick color from screen"
					class="bg-surface text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface ring-outline-variant flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-none ring-1 transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M3 21v-3.75L12.075 8.2L10.3 6.425l1.4-1.4l1.425 1.4l3.55-3.55q.575-.575 1.413-.575t1.412.575l1.625 1.625q.575.575.575 1.413t-.575 1.412l-3.55 3.55l1.4 1.425l-1.4 1.4l-1.775-1.775L6.75 21zm2-2h.925l8.45-8.45l-.925-.925L5 18.075z"
						/>
					</svg>
				</button>
			{/if}

			{#if !isDefault}
				<button
					type="button"
					onclick={() => selectDirect(defaultColor)}
					class="bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-none px-3.5 text-xs font-semibold transition-colors"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20"
						/>
					</svg>
					Reset
				</button>
			{/if}
		</div>
	</div>
</div>
