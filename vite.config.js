import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import manifest from './static/manifest.json';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: manifest.name,
				short_name: manifest.short_name,
				description: manifest.description,
				display: 'standalone',
				start_url: manifest.start_url,
				theme_color: manifest.theme_color,
				background_color: manifest.background_color,
				icons: manifest.icons,
				orientation: 'portrait',
				scope: manifest.scope,
				id: manifest.id,
				display_override: ['standalone', 'minimal-ui'],
				prefer_related_applications: manifest.prefer_related_applications
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/maple\.kolf\.pro:3000\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 10,
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
	],
	optimizeDeps: {
		include: ['src/routes/**/+*.{js,ts,svelte}', 'src/hooks*.{js,ts}']
	}
});
