<script lang="ts">
	import { Button, Slider } from 'm3-svelte';
	
</script>

<div class="fixed bottom-5 rounded-full left-23 mx-8 right-0 flex h-24 items-center justify-between bg-secondary">
    <div class="grid grid-cols-3 w-full h-full items-center">
		<div class="flex items-center gap-2 ml-6 justify-start">
			<img src="https://raw.githubusercontent.com/Cattn/Maple/8c1ab06960d3cec36714bf99cd6cee4ebb53913a/static/temp/MapleD.svg" alt="Song Art" class="w-14 h-14 rounded-lg" />
			<div class="flex flex-col">
				<p class="song-title text-on-secondary-fixed">
					Song Name
				</p>
				<p class="artist-title">
					Artist Name
				</p>
			</div>
		</div>
		<div class="flex justify-center gap-2">
			<div>
				<Button iconType="full" square variant="elevated">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14 20v-2h2.6l-3.175-3.175L14.85 13.4L18 16.55V14h2v6zm-8.6 0L4 18.6L16.6 6H14V4h6v6h-2V7.4zm3.775-9.425L4 5.4L5.4 4l5.175 5.175z"/></svg>
				</Button>
			</div>
			<div class="button-mod-2">
				<Button iconType="full" square variant="tonal">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M5.5 18V6h2v12zm13 0l-9-6l9-6zm-2-3.75v-4.5L13.1 12z"/></svg>
				</Button>
			</div>
			<div class="button-mod">
				<Button iconType="full" square variant="tonal">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M8 19V5l11 7zm2-3.65L15.25 12L10 8.65z"/></svg>
				</Button>
			</div>
			<div class="button-mod-2">
				<Button iconType="full" square variant="tonal">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 18V6h2v12zm-11 0V6l9 6zm2-3.75L10.9 12L7.5 9.75z"/></svg>
				</Button>
			</div>
			<div>
				<Button iconType="full" square variant="elevated">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6c0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8m0 14c-3.31 0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4l-4-4z"/></svg>
				</Button>
			</div>
		</div>
		<div class="flex justify-end mr-6 items-center">
			<div class="ml-2 mr-2">
				<svg class="fill-icon-color" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M7 15V9h4l5-5v16l-5-5zm2-2h2.85L14 15.15v-6.3L11.85 11H9zm2.5-1"/></svg>			
			</div>
			<div class="slider-stuff">
				<Slider
					min={0}
					max={100}
					value={50}
					step={1}
					showValue
					format={(n) => `${n}%`}
				/>
			</div>
			<div class="ml-2 mr-2">
				<svg class="fill-icon-color" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16m-4-7.15L7.85 11H5v2h2.85L10 15.15zM7.5 12"/></svg>
			</div>
		</div>
	</div>
</div>

<style>
	.song-title {
		color: var(--color-on-secondary-fixed);
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
		color: var(--color-on-secondary-fixed-variant);
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

	.slider-stuff :global(div ::before) {
        background-color: rgb(var(--m3-scheme-on-secondary-fixed)) !important;
    }
    .slider-stuff :global(div ::after) {
        background-color: rgb(var(--m3-scheme-on-secondary-fixed-variant)) !important;
    }
	.slider-stuff :global(div:nth-child(3)) {
        background-color: rgb(var(--m3-scheme-on-secondary-fixed-variant)) !important;
    }

	.fill-icon-color {
		color: rgb(var(--m3-scheme-on-secondary-fixed-variant));
		scale: 1.2;
	}
</style>