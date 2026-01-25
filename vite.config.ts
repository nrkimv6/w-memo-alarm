import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
