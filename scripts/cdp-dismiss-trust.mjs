/**
 * Connects to a running Obsidian instance via CDP and dismisses
 * the community-plugin trust dialog so plugins load without
 * interactive Playwright tests.
 */
import { chromium } from '@playwright/test';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const CDP_WAIT_MS = 30_000;
const DIALOG_WAIT_MS = 15_000;

async function waitForCDP(url, timeout) {
	const start = Date.now();

	while (Date.now() - start < timeout) {
		try {
			const res = await fetch(`${url}/json/version`);
			if (res.ok) return;
		} catch {
			// not ready yet
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`CDP not available at ${url} after ${timeout}ms`);
}

async function main() {
	console.log('[cdp] waiting for CDP endpoint…');
	await waitForCDP(CDP_URL, CDP_WAIT_MS);

	console.log('[cdp] connecting…');
	const browser = await chromium.connectOverCDP(CDP_URL);
	const contexts = browser.contexts();
	const page = contexts[0]?.pages()[0];

	if (!page) {
		console.log('[cdp] no page found, exiting');
		await browser.close();
		return;
	}

	console.log('[cdp] page title:', await page.title());

	const trustButton = page.getByText('Trust author and enable plugins');

	try {
		await trustButton.waitFor({ timeout: DIALOG_WAIT_MS });
		console.log('[cdp] trust dialog detected, clicking…');
		await trustButton.click();
		await page.keyboard.press('Escape');
		console.log('[cdp] trust dialog dismissed');
	} catch (error) {
		if (error?.name === 'TimeoutError') {
			console.log('[cdp] no trust dialog appeared, continuing');
		} else {
			throw error;
		}
	}

	await browser.close();
}

main().catch((error) => {
	console.error('[cdp]', error.message);
	process.exit(1);
});
