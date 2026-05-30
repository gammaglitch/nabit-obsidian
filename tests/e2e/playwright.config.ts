import path from 'node:path';

import { defineConfig } from '@playwright/test';

const artifactsDir = process.env.PLAYWRIGHT_ARTIFACTS_DIR
	? path.resolve(process.env.PLAYWRIGHT_ARTIFACTS_DIR)
	: path.resolve('.e2e/artifacts');

const reportDir = process.env.PLAYWRIGHT_HTML_REPORT
	? path.resolve(process.env.PLAYWRIGHT_HTML_REPORT)
	: path.resolve('.e2e/report');

export default defineConfig({
	testDir: path.resolve(__dirname),
	timeout: 120_000,
	fullyParallel: false,
	retries: 0,
	outputDir: artifactsDir,
	reporter: [['list'], ['html', { outputFolder: reportDir, open: 'never' }]],
	use: {
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
	},
});
