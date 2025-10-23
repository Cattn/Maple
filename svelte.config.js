import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
//import adapter from '@sveltejs/adapter-auto';
//import adapter from '@sveltejs/adapter-node';
import adapter from '@sveltejs/adapter-cloudflare';


/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		/* adapter: adapter({
			// See below for an explanation of these options
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
		}) */
			adapter: adapter({
				// See below for an explanation of these options
				config: undefined,
				platformProxy: {
					configPath: undefined,
					environment: undefined,
					persist: undefined
				},
				fallback: 'plaintext',
				routes: {
					include: ['/*'],
					exclude: ['<all>']
				}
			})
	},
	preprocess: [vitePreprocess({})],
	compilerOptions: {
		experimental: {
			async: true
		}
	}
}; 

export default config;
