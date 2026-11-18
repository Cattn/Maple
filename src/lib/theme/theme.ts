import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { Settings } from '$lib/preferences/fetch';
import {
	argbFromHex,
	blueFromArgb,
	greenFromArgb,
	redFromArgb,
	themeFromSourceColor
} from '@ktibow/material-color-utilities-nightly';

type ThemeSettings = {
	sourceColor: string;
	isDarkMode: boolean;
};

export const DEFAULT_SOURCE_COLOR = '#8f4a4c';
const themeStorage = new Settings('theme');

const getStoredTheme = () => {
	if (!browser) {
		return { sourceColor: DEFAULT_SOURCE_COLOR, isDarkMode: false };
	}
	const sourceColor = themeStorage.get('sourceColor') ?? DEFAULT_SOURCE_COLOR;
	const storedDarkMode = themeStorage.get('isDarkMode');
	const isDarkMode =
		storedDarkMode !== null
			? storedDarkMode
			: window.matchMedia('(prefers-color-scheme: dark)').matches;
	return { sourceColor, isDarkMode };
};

export const themeSettings = writable<ThemeSettings>(getStoredTheme());

const schemeVars: Record<string, string> = {
	primary: 'primary',
	'surface-tint': 'surfaceTint',
	'on-primary': 'onPrimary',
	'primary-container': 'primaryContainer',
	'on-primary-container': 'onPrimaryContainer',
	secondary: 'secondary',
	'on-secondary': 'onSecondary',
	'secondary-container': 'secondaryContainer',
	'on-secondary-container': 'onSecondaryContainer',
	tertiary: 'tertiary',
	'on-tertiary': 'onTertiary',
	'tertiary-container': 'tertiaryContainer',
	'on-tertiary-container': 'onTertiaryContainer',
	error: 'error',
	'on-error': 'onError',
	'error-container': 'errorContainer',
	'on-error-container': 'onErrorContainer',
	background: 'background',
	'on-background': 'onBackground',
	surface: 'surface',
	'on-surface': 'onSurface',
	'surface-variant': 'surfaceVariant',
	'on-surface-variant': 'onSurfaceVariant',
	outline: 'outline',
	'outline-variant': 'outlineVariant',
	shadow: 'shadow',
	scrim: 'scrim',
	'inverse-surface': 'inverseSurface',
	'inverse-on-surface': 'inverseOnSurface',
	'inverse-primary': 'inversePrimary',
	'primary-fixed': 'primaryFixed',
	'on-primary-fixed': 'onPrimaryFixed',
	'primary-fixed-dim': 'primaryFixedDim',
	'on-primary-fixed-variant': 'onPrimaryFixedVariant',
	'secondary-fixed': 'secondaryFixed',
	'on-secondary-fixed': 'onSecondaryFixed',
	'secondary-fixed-dim': 'secondaryFixedDim',
	'on-secondary-fixed-variant': 'onSecondaryFixedVariant',
	'tertiary-fixed': 'tertiaryFixed',
	'on-tertiary-fixed': 'onTertiaryFixed',
	'tertiary-fixed-dim': 'tertiaryFixedDim',
	'on-tertiary-fixed-variant': 'onTertiaryFixedVariant',
	'surface-dim': 'surfaceDim',
	'surface-bright': 'surfaceBright',
	'surface-container-lowest': 'surfaceContainerLowest',
	'surface-container-low': 'surfaceContainerLow',
	'surface-container': 'surfaceContainer',
	'surface-container-high': 'surfaceContainerHigh',
	'surface-container-highest': 'surfaceContainerHighest'
};

const toRgb = (argb: number) => `${redFromArgb(argb)} ${greenFromArgb(argb)} ${blueFromArgb(argb)}`;

const applyTheme = (settings: ThemeSettings) => {
	if (!browser) return;
	const theme = themeFromSourceColor(argbFromHex(settings.sourceColor));
	const scheme = settings.isDarkMode ? theme.schemes.dark : theme.schemes.light;
	const schemeValues = scheme as unknown as Record<string, number>;
	const neutralPalette = theme.palettes?.neutral;
	const palettes = theme.palettes;
	const target = document.documentElement;
	const setCssVar = (cssVar: string, value?: number) => {
		if (value !== undefined) {
			target.style.setProperty(`--m3-scheme-${cssVar}`, toRgb(value));
		}
	};

	Object.entries(schemeVars).forEach(([cssVar, schemeKey]) => {
		setCssVar(cssVar, schemeValues[schemeKey]);
	});

	const fixedTones: Record<'primary' | 'secondary' | 'tertiary', [string, number][]> = {
		primary: [
			['primary-fixed', 90],
			['on-primary-fixed', 10],
			['primary-fixed-dim', 80],
			['on-primary-fixed-variant', 30]
		],
		secondary: [
			['secondary-fixed', 90],
			['on-secondary-fixed', 10],
			['secondary-fixed-dim', 80],
			['on-secondary-fixed-variant', 30]
		],
		tertiary: [
			['tertiary-fixed', 90],
			['on-tertiary-fixed', 10],
			['tertiary-fixed-dim', 80],
			['on-tertiary-fixed-variant', 30]
		]
	};

	(['primary', 'secondary', 'tertiary'] as const).forEach((paletteKey) => {
		const palette = palettes?.[paletteKey];
		if (!palette?.tone) return;
		fixedTones[paletteKey].forEach(([cssVar, tone]) => {
			const schemeKey = schemeVars[cssVar];
			if (schemeValues[schemeKey] === undefined) {
				setCssVar(cssVar, palette.tone(tone));
			}
		});
	});

	const surfaceFallbacks = settings.isDarkMode
		? {
				'surface-dim': 6,
				'surface-bright': 24,
				'surface-container-lowest': 4,
				'surface-container-low': 10,
				'surface-container': 12,
				'surface-container-high': 17,
				'surface-container-highest': 22
			}
		: {
				'surface-dim': 87,
				'surface-bright': 98,
				'surface-container-lowest': 100,
				'surface-container-low': 96,
				'surface-container': 94,
				'surface-container-high': 92,
				'surface-container-highest': 90
			};

	if (neutralPalette?.tone) {
		Object.entries(surfaceFallbacks).forEach(([cssVar, tone]) => {
			const schemeKey = schemeVars[cssVar];
			if (schemeValues[schemeKey] === undefined) {
				setCssVar(cssVar, neutralPalette.tone(tone));
			}
		});
	}

	target.classList.toggle('dark', settings.isDarkMode);
	target.style.colorScheme = settings.isDarkMode ? 'dark' : 'light';
};

export const persistThemeSettings = (settings?: ThemeSettings) => {
	const value = settings ?? get(themeSettings);
	themeStorage.set('sourceColor', value.sourceColor);
	themeStorage.set('isDarkMode', value.isDarkMode);
};

export const setThemeSettings = (
	next: Partial<ThemeSettings>,
	options: { persist?: boolean } = {}
) => {
	let updated: ThemeSettings | null = null;
	themeSettings.update((current) => {
		const candidate = { ...current, ...next };
		if (
			candidate.sourceColor === current.sourceColor &&
			candidate.isDarkMode === current.isDarkMode
		) {
			return current;
		}
		updated = candidate;
		return candidate;
	});
	if (updated) {
		applyTheme(updated);
		if (options.persist) {
			persistThemeSettings(updated);
		}
	}
};

let initialized = false;

export const initTheme = () => {
	if (!browser || initialized) return;
	initialized = true;
	const settings = getStoredTheme();
	themeSettings.set(settings);
	applyTheme(settings);
};
