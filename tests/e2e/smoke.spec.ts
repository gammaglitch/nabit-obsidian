import { expect, test } from '@playwright/test';

import {
	dismissTrustDialog,
	launchObsidian,
	waitForPluginView,
} from './helpers/obsidian';

test('loads the plugin view inside Obsidian', async () => {
	const { app, page, consoleErrors, pageErrors } = await launchObsidian();

	try {
		await dismissTrustDialog(page);
		await waitForPluginView(page);

		await expect(page.getByTestId('plugin-root')).toBeVisible();
		await expect(page.getByTestId('plugin-sidebar')).toBeVisible();
		await expect(page.getByText('Files')).toBeVisible();

		expect(consoleErrors).toEqual([]);
		expect(pageErrors).toEqual([]);
	} finally {
		await app.close();
	}
});
