<script lang="ts">
	import Button from './ui/button/button.svelte';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { OPFS } from '$lib/opfs';
	import { activeSong, audioPlayer, currentDuration, curTime, setCurTime } from '$lib/store';
	import Controls from './controls.svelte';
	import { onMount } from 'svelte';

	import {
		Play,
		SkipForward,
		SkipBack,
		Shuffle,
		Repeat,
		Repeat1,
		Pause,
		ChevronUp,
		ChevronDown,
		Volume2,
		VolumeX,
		Volume1,
		Heart,
		MoreHorizontal,
		ListPlus
	} from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { extractColors } from 'extract-colors';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	
	const dispatch = createEventDispatcher();

	let currentTime: number[];
	let one = false;
	let paused = true;
	$: volume = [100];
	let controls: Controls;
	$: currentTime = [0];
	$: maxDuration = [0];
	let isLiked = false;

	let isCollapsed = true;
	let volumeVisible = false;
	let gradientBackground = '';

	$: {
		if ($audioPlayer) {
			paused = !$audioPlayer.playing;
		}
	}

	onMount(async () => {
		audioPlayer.subscribe((value) => {
			if (value.audio instanceof HTMLAudioElement && value.currentTime !== undefined) {
				currentTime = [value.audio.currentTime];
			}
		});
	});

	let colors: {
		[x: string]: any;
		hex: any;
	}[];

	currentDuration.subscribe((duration) => {
		if (duration) {
			maxDuration = [duration];
		}
	});
	
	async function getImageUrl(imagePath: string): Promise<string> {
		try {
			const response = await OPFS.get().image(imagePath);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer]);
			colors = await extractColors(URL.createObjectURL(blob));
			
			if (colors && colors.length >= 2) {
				gradientBackground = `linear-gradient(to right, rgba(${colors[0].red},${colors[0].green},${colors[0].blue},0.5), rgba(${colors[1].red},${colors[1].green},${colors[1].blue},0.5))`;
			}
			
			return URL.createObjectURL(blob);
		} catch (error) {
			console.error("Error loading image:", error);
			return '/temp/MapleD.svg';
		}
	}

	function pausePlay() {
		controls.pausePlay();
	}

	function nextSong() {
		controls.nextSong();
	}

	function prevSong() {
		controls.prevSong();
	}

	function changeVolume() {
		controls.volume(volume[0]);
	}

	function handleScrub(value: number) {
		if (value !== $setCurTime[0]) {
			curTime.set([value]);
			audioPlayer.update((state) => {
				if (state.audio instanceof HTMLAudioElement) {
					state.audio.currentTime = value;
					return { ...state, currentTime: value };
				}
				return state;
			});
		}
	}

	function toggleMiniPlayer() {
		dispatch('expand');
		isCollapsed = !isCollapsed;
	}

	function toggleLike() {
		isLiked = !isLiked;
	}
	
	function toggleMute() {
		if (volume[0] === 0) {
			volume = [previousVolume || 50];
		} else {
			previousVolume = volume[0];
			volume = [0];
		}
		changeVolume();
	}
	
	let previousVolume: number;
	
	function formatTime(seconds: number) {
		if (isNaN(seconds)) return '0:00';
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	}
</script>

<!-- Main Player Container -->
<div class="player-container backdrop-blur-md bg-card/95 border-t border-border/50 shadow-lg transition-all duration-300">
	{#if isCollapsed}
		<!-- Compact player (bottom bar) -->
		<div class="player-compact">
			<!-- Progress bar at the top of player -->
			<div class="progress-bar-container">
				<Slider
					color="bg-primary"
					bind:value={$curTime}
					bind:max={maxDuration[0]}
					step={0.1}
					class="progress-slider"
					on:change={() => handleScrub($curTime[0])}
				/>
				<div class="progress-time-display">
					<span class="text-xs text-muted-foreground">{formatTime($curTime[0])}</span>
					<span class="text-xs text-muted-foreground">{formatTime(maxDuration[0])}</span>
				</div>
			</div>
			
			<div class="player-content">
				<!-- Album art and track info -->
				<div class="track-info">
					{#if $activeSong.title}
						{#await getImageUrl($activeSong.image)}
							<div class="album-art-placeholder"></div>
						{:then image}
							<img src={image} alt={$activeSong.title} class="album-art" />
						{:catch error}
							<img src="/temp/MapleD.svg" alt="Default" class="album-art" />
						{/await}
						<div class="track-details">
							<p class="track-title">{$activeSong.title || 'Unknown Title'}</p>
							<p class="track-artist">{$activeSong.artist || 'Unknown Artist'}</p>
						</div>
					{:else}
						<img src="/temp/MapleD.svg" alt="Default" class="album-art" />
						<div class="track-details">
							<p class="track-title">Nothing Playing</p>
							<p class="track-artist">Select a track to play</p>
						</div>
					{/if}
				</div>
				
				<!-- Playback controls -->
				<div class="playback-controls">
					<Button variant="ghost" size="icon" class="control-button" disabled>
						<Shuffle size={16} class="text-muted-foreground" />
					</Button>
					<Button variant="ghost" size="icon" class="control-button" on:click={prevSong}>
						<SkipBack size={20} />
					</Button>
					<Button variant="default" size="icon" class="play-button" on:click={pausePlay}>
						{#if paused}
							<Play size={20} />
						{:else}
							<Pause size={20} />
						{/if}
					</Button>
					<Button variant="ghost" size="icon" class="control-button" on:click={nextSong}>
						<SkipForward size={20} />
					</Button>
					<Button variant="ghost" size="icon" class="control-button" disabled>
						{#if one}
							<Repeat1 size={16} class="text-muted-foreground" />
						{:else}
							<Repeat size={16} class="text-muted-foreground" />
						{/if}
					</Button>
				</div>
				
				<!-- Volume and expand controls -->
				<div class="player-actions">
					<div class="volume-container">
						<Button variant="ghost" size="icon" class="volume-button" on:click={toggleMute}>
							{#if volume[0] === 0}
								<VolumeX size={18} />
							{:else if volume[0] < 50}
								<Volume1 size={18} />
							{:else}
								<Volume2 size={18} />
							{/if}
						</Button>
						
						<div class="volume-slider-container">
							<Slider bind:value={volume} max={100} step={1} class="volume-slider" on:change={changeVolume} />
						</div>
					</div>
					
					<div class="action-buttons">
						<Button variant="ghost" size="icon" class="action-button" on:click={toggleLike}>
							<Heart size={18} class={isLiked ? 'fill-destructive text-destructive' : 'text-muted-foreground'} />
						</Button>
						<Button variant="ghost" size="icon" class="action-button" on:click={toggleMiniPlayer}>
							<ChevronUp size={18} />
						</Button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Expanded player (full screen) -->
		<div class="player-expanded" in:fly={{ y: 500, duration: 400 }} out:fly={{ y: 500, duration: 300 }}>
			<!-- Close button -->
			<div class="expanded-header">
				<Button variant="ghost" size="icon" class="close-button" on:click={toggleMiniPlayer}>
					<ChevronDown size={20} />
				</Button>
			</div>
			
			<!-- Album art -->
			<div class="expanded-album-container" style={gradientBackground ? `background: ${gradientBackground}` : ''}>
				{#if $activeSong.title}
					{#await getImageUrl($activeSong.image)}
						<div class="expanded-album-placeholder"></div>
					{:then image}
						<img src={image} alt={$activeSong.title} class="expanded-album-art" />
					{:catch error}
						<img src="/temp/MapleD.svg" alt="Default" class="expanded-album-art" />
					{/await}
				{:else}
					<img src="/temp/MapleD.svg" alt="Default" class="expanded-album-art" />
				{/if}
			</div>
			
			<!-- Track info -->
			<div class="expanded-track-info">
				<h2 class="expanded-track-title">{$activeSong.title || 'Nothing Playing'}</h2>
				<p class="expanded-track-artist">{$activeSong.artist || 'Select a track to play'}</p>
			</div>
			
			<!-- Progress bar -->
			<div class="expanded-progress-container">
				<Slider
					color="bg-primary"
					bind:value={$curTime}
					bind:max={maxDuration[0]}
					step={0.1}
					class="expanded-progress-slider"
					on:change={() => handleScrub($curTime[0])}
				/>
				<div class="expanded-progress-time">
					<span class="text-sm text-foreground">{formatTime($curTime[0])}</span>
					<span class="text-sm text-foreground">{formatTime(maxDuration[0])}</span>
				</div>
			</div>
			
			<!-- Playback controls -->
			<div class="expanded-controls">
				<Button variant="ghost" size="icon" class="expanded-control-button" disabled>
					<Shuffle size={20} class="text-muted-foreground" />
				</Button>
				<Button variant="ghost" size="icon" class="expanded-control-button" on:click={prevSong}>
					<SkipBack size={24} />
				</Button>
				<Button variant="default" size="icon" class="expanded-play-button" on:click={pausePlay}>
					{#if paused}
						<Play size={28} />
					{:else}
						<Pause size={28} />
					{/if}
				</Button>
				<Button variant="ghost" size="icon" class="expanded-control-button" on:click={nextSong}>
					<SkipForward size={24} />
				</Button>
				<Button variant="ghost" size="icon" class="expanded-control-button" disabled>
					{#if one}
						<Repeat1 size={20} class="text-muted-foreground" />
					{:else}
						<Repeat size={20} class="text-muted-foreground" />
					{/if}
				</Button>
			</div>
			
			<!-- Action buttons -->
			<div class="expanded-actions">
				<Button variant="ghost" size="icon" class="expanded-action-button" on:click={toggleLike}>
					<Heart size={20} class={isLiked ? 'fill-destructive text-destructive' : 'text-muted-foreground'} />
				</Button>
				<Button variant="ghost" size="icon" class="expanded-action-button">
					<ListPlus size={20} class="text-muted-foreground" />
				</Button>
				<Button variant="ghost" size="icon" class="expanded-action-button">
					<MoreHorizontal size={20} class="text-muted-foreground" />
				</Button>
			</div>
			
			<!-- Volume control -->
			<div class="expanded-volume">
				<Button variant="ghost" size="icon" class="expanded-volume-button" on:click={toggleMute}>
					{#if volume[0] === 0}
						<VolumeX size={20} />
					{:else if volume[0] < 50}
						<Volume1 size={20} />
					{:else}
						<Volume2 size={20} />
					{/if}
				</Button>
				<Slider bind:value={volume} max={100} step={1} class="expanded-volume-slider" on:change={changeVolume} />
			</div>
		</div>
	{/if}
</div>

<Controls bind:this={controls} />

<style>
	/* Base Player Container */
	.player-container {
		width: 100%;
		position: relative;
		z-index: 50;
	}
	
	/* Compact Player (Bottom Bar) */
	.player-compact {
		display: flex;
		flex-direction: column;
		width: 100%;
	}
	
	.progress-bar-container {
		padding: 0;
		position: relative;
	}
	
	.progress-slider {
		height: 4px;
		border-radius: 0;
	}
	
	.progress-time-display {
		display: none;
		justify-content: space-between;
		padding: 0 1rem;
		margin-top: 0.25rem;
	}
	
	.player-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		height: 4.5rem;
	}
	
	.track-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 30%;
	}
	
	.album-art {
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		object-fit: cover;
	}
	
	.album-art-placeholder {
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		background-color: hsl(var(--muted));
		animation: pulse 2s infinite;
	}
	
	.track-details {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	
	.track-title {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.875rem;
	}
	
	.track-artist {
		color: hsl(var(--muted-foreground));
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.playback-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
	}
	
	.control-button {
		width: 2.25rem;
		height: 2.25rem;
	}
	
	.play-button {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 9999px;
	}
	
	.player-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 30%;
		justify-content: flex-end;
	}
	
	.volume-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	
	.volume-button {
		width: 2.25rem;
		height: 2.25rem;
	}
	
	.volume-slider-container {
		width: 6rem;
		display: none;
	}
	
	.volume-slider {
		height: 0.25rem;
	}
	
	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}
	
	.action-button {
		width: 2.25rem;
		height: 2.25rem;
	}
	
	/* Expanded Player */
	.player-expanded {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		background-color: hsl(var(--background));
		display: flex;
		flex-direction: column;
		padding: 2rem;
		z-index: 100;
	}
	
	.expanded-header {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 1rem;
	}
	
	.close-button {
		width: 2.5rem;
		height: 2.5rem;
	}
	
	.expanded-album-container {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 2rem;
		margin: 1rem 0;
		border-radius: 1rem;
		background-color: hsl(var(--muted));
	}
	
	.expanded-album-art {
		width: min(100%, 20rem);
		height: min(100%, 20rem);
		border-radius: 0.5rem;
		object-fit: cover;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
	}
	
	.expanded-album-placeholder {
		width: min(100%, 20rem);
		height: min(100%, 20rem);
		border-radius: 0.5rem;
		background-color: hsl(var(--muted));
		animation: pulse 2s infinite;
	}
	
	.expanded-track-info {
		text-align: center;
		margin: 1.5rem 0;
	}
	
	.expanded-track-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}
	
	.expanded-track-artist {
		font-size: 1rem;
		color: hsl(var(--muted-foreground));
	}
	
	.expanded-progress-container {
		margin: 1rem 0;
	}
	
	.expanded-progress-slider {
		margin-bottom: 0.5rem;
	}
	
	.expanded-progress-time {
		display: flex;
		justify-content: space-between;
	}
	
	.expanded-controls {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem 0;
	}
	
	.expanded-control-button {
		width: 3rem;
		height: 3rem;
	}
	
	.expanded-play-button {
		width: 4rem;
		height: 4rem;
		border-radius: 9999px;
	}
	
	.expanded-actions {
		display: flex;
		justify-content: center;
		gap: 2rem;
		margin: 1.5rem 0;
	}
	
	.expanded-action-button {
		width: 3rem;
		height: 3rem;
	}
	
	.expanded-volume {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem 0;
		padding: 0 2rem;
	}
	
	.expanded-volume-button {
		width: 2.5rem;
		height: 2.5rem;
	}
	
	.expanded-volume-slider {
		flex: 1;
	}
	
	/* Responsive Adjustments */
	@media (min-width: 768px) {
		.progress-time-display {
			display: flex;
		}
		
		.volume-slider-container {
			display: block;
		}
		
		.player-content {
			padding: 0.75rem 2rem;
		}
	}
	
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
