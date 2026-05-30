import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import preact from '@preact/preset-vite';

import manifest from './public/manifest.json';

export default ({ mode }) => {
	process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

	return defineConfig({
		plugins: [preact()],
		resolve: {
			alias: {
				react: 'preact/compat',
				'react-dom/test-utils': 'preact/test-utils',
				'react-dom': 'preact/compat',
				'react/jsx-runtime': 'preact/jsx-runtime',
				'@': path.resolve(__dirname, './src'),
			},
		},
		build: {
			cssCodeSplit: true,
			minify: false,
			sourcemap: true,
			lib: {
				entry: path.resolve(__dirname, 'src/main.ts'),
				name: manifest.name,
				fileName: () => 'main.js',
				formats: ['umd'],
			},
			rollupOptions: {
				external: ['obsidian'],
			},
			outDir: `${process.env.OBSIDIAN_PATH}/.obsidian/plugins/${manifest.id}`,
		},
	});
};
