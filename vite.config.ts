import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		port: 5179
	},
	preview: {
		port: 5179
	},
	ssr: {
		noExternal: [],
		external: ['@capacitor/app', '@capacitor/browser', '@capacitor/core', '@capacitor/local-notifications']
	},
	build: {
		rollupOptions: {
			external: ['@capacitor/app', '@capacitor/browser', '@capacitor/core', '@capacitor/local-notifications']
		}
	}
});
