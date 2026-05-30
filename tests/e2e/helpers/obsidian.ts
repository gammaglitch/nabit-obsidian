import path from 'node:path';

import {
	_electron as electron,
	type ElectronApplication,
	type Page,
} from '@playwright/test';

type ObsidianSession = {
	app: ElectronApplication;
	page: Page;
	consoleErrors: string[];
	pageErrors: string[];
};

function getRequiredEnv(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

export async function launchObsidian(): Promise<ObsidianSession> {
	const executablePath = getRequiredEnv('OBSIDIAN_E2E_BINARY');
	const vaultDir = getRequiredEnv('E2E_VAULT_DIR');
	const appDir = process.env.OBSIDIAN_E2E_APPDIR;
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];

	const appDirEnv = appDir
		? {
				APPDIR: appDir,
				GSETTINGS_SCHEMA_DIR: [
					path.join(appDir, 'usr/share/glib-2.0/schemas'),
					process.env.GSETTINGS_SCHEMA_DIR,
				]
					.filter(Boolean)
					.join(':'),
				LD_LIBRARY_PATH: [
					path.join(appDir, 'usr/lib'),
					appDir,
					process.env.LD_LIBRARY_PATH,
				]
					.filter(Boolean)
					.join(':'),
				PATH: [appDir, path.join(appDir, 'usr/sbin'), process.env.PATH]
					.filter(Boolean)
					.join(':'),
				XDG_DATA_DIRS: [
					path.join(appDir, 'usr/share'),
					process.env.XDG_DATA_DIRS,
					'/usr/share/gnome',
					'/usr/local/share',
					'/usr/share',
				]
					.filter(Boolean)
					.join(':'),
			}
		: {};

	const args = [vaultDir];

	if (process.env.CI) {
		args.unshift(
			'--no-sandbox',
			'--disable-gpu',
			'--disable-dev-shm-usage',
			'--disable-software-rasterizer',
		);
	}

	console.log('[e2e] launching', executablePath, args.join(' '));

	const app = await electron.launch({
		executablePath,
		args,
		env: {
			...process.env,
			ELECTRON_ENABLE_LOGGING: '1',
			...appDirEnv,
		},
		timeout: 60_000,
	});

	console.log('[e2e] electron launched, waiting for first window…');

	app.on('window', (page) => {
		page.on('console', (message) => {
			if (message.type() === 'error') {
				consoleErrors.push(message.text());
			}
		});
		page.on('pageerror', (error) => {
			pageErrors.push(String(error));
		});
	});

	const page = await app.firstWindow();
	console.log('[e2e] got first window:', await page.title());

	return { app, page, consoleErrors, pageErrors };
}

export async function dismissTrustDialog(page: Page) {
	const trustButton = page.getByText('Trust author and enable plugins');
	try {
		await trustButton.waitFor({ timeout: 10_000 });
	} catch (error: unknown) {
		if (error instanceof Error && error.name === 'TimeoutError') {
			console.log('[e2e] no trust dialog, continuing');
			return;
		}
		throw error;
	}
	console.log('[e2e] trust dialog detected, clicking…');
	await trustButton.click();
	await page.keyboard.press('Escape');
}

export async function waitForPluginView(page: Page) {
	await page.getByTestId('plugin-root').waitFor({ timeout: 60_000 });
}
