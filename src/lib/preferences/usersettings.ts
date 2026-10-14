import { Settings } from './fetch';
import { browser } from '$app/environment';
let webhookEnabled = false;
let webhookURL = '';

let webhookSettings = new Settings('webhook');

webhookEnabled =
	webhookSettings.get('enabled') !== null ? webhookSettings.get('enabled') : webhookEnabled;
webhookURL = webhookSettings.get('url') !== null ? webhookSettings.get('url') : webhookURL;

let discord = false;

let discordSettings = new Settings('discord');
discord = discordSettings.get('enabled') !== null ? discordSettings.get('enabled') : discord;

let p2p = true;
let devMode = false;
let showLogging = false;
let socket = true;
let jellyfinMode = false;

let preferences = new Settings('preferences');
p2p = preferences.get('p2p') !== null ? preferences.get('p2p') : p2p;
devMode = preferences.get('devMode') !== null ? preferences.get('devMode') : devMode;
showLogging =
	preferences.get('showLogging') !== null ? preferences.get('showLogging') : showLogging;
socket = preferences.get('socket') !== null ? preferences.get('socket') : socket;
jellyfinMode =
	preferences.get('jellyfinMode') !== null ? preferences.get('jellyfinMode') : jellyfinMode;

let sourceColor = '#8f4a4c';
let isDarkMode = false;
let themeSettings = new Settings('theme');
sourceColor =
	themeSettings.get('sourceColor') !== null ? themeSettings.get('sourceColor') : sourceColor;
isDarkMode =
	themeSettings.get('isDarkMode') !== null ? themeSettings.get('isDarkMode') : isDarkMode;

const UserSettings = {
	webhook: {
		enabled: webhookEnabled,
		url: webhookURL
	},
	preferences: {
		p2p,
		devMode,
		showLogging,
		socket,
		jellyfinMode
	},
	theme: {
		sourceColor,
		isDarkMode
	},
	discord: {
		get enabled(): boolean {
			return discord;
		},
		set enabled(value: boolean) {
			discord = value;
			if (browser) window.dispatchEvent(new Event('discordSettingsChanged'));
		}
	}
};

export default UserSettings;
