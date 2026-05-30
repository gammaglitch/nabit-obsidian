import { App, Notice, PluginSettingTab, Setting } from 'obsidian';

import type NabitPlugin from './main';

export interface NabitSettings {
	/** Origin of the nabit API, e.g. `http://127.0.0.1:3001`. */
	apiBaseUrl: string;
	/** Bearer token. Empty when the API runs with AUTH_REQUIRED=false. */
	apiToken: string;
	/** Vault folder where synced articles are written. */
	targetFolder: string;
	/** Append the comment thread to each note. */
	includeComments: boolean;
	/** Download referenced images into the vault and rewrite links locally. */
	downloadAssets: boolean;
	/** Vault folder for downloaded image assets. */
	assetFolder: string;
	/** Run a sync when the vault loads. */
	syncOnStartup: boolean;
	/** Auto-sync interval in minutes (0 disables). */
	syncIntervalMinutes: number;
	/** Incremental sync cursor: max contentUpdatedAt written so far. */
	lastContentUpdatedAt: string;
	/** Index of article id -> vault note path, for rename handling. */
	notePaths: Record<string, string>;
}

export const DEFAULT_SETTINGS: NabitSettings = {
	apiBaseUrl: 'http://127.0.0.1:3001',
	apiToken: '',
	targetFolder: 'nabit',
	includeComments: true,
	downloadAssets: true,
	assetFolder: 'nabit/assets',
	syncOnStartup: true,
	syncIntervalMinutes: 1440,
	lastContentUpdatedAt: '',
	notePaths: {},
};

export class NabitSettingTab extends PluginSettingTab {
	private readonly plugin: NabitPlugin;

	constructor(app: App, plugin: NabitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('API base URL')
			.setDesc('Origin of your nabit API, e.g. http://127.0.0.1:3001')
			.addText((text) =>
				text
					.setPlaceholder('http://127.0.0.1:3001')
					.setValue(this.plugin.settings.apiBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.apiBaseUrl = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('API token')
			.setDesc('Bearer token. Leave empty if the API runs with AUTH_REQUIRED=false.')
			.addText((text) => {
				text
					.setPlaceholder('token')
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Target folder')
			.setDesc('Vault folder where synced articles are written.')
			.addText((text) =>
				text
					.setPlaceholder('nabit')
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async (value) => {
						this.plugin.settings.targetFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Include comments')
			.setDesc('Append the comment thread below each article.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeComments)
					.onChange(async (value) => {
						this.plugin.settings.includeComments = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Download images')
			.setDesc('Download referenced images into the vault for offline use.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.downloadAssets)
					.onChange(async (value) => {
						this.plugin.settings.downloadAssets = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Asset folder')
			.setDesc('Vault folder for downloaded images.')
			.addText((text) =>
				text
					.setPlaceholder('nabit/assets')
					.setValue(this.plugin.settings.assetFolder)
					.onChange(async (value) => {
						this.plugin.settings.assetFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Sync on startup')
			.setDesc('Run a sync when the vault opens.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.syncOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.syncOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Auto-sync interval (minutes)')
			.setDesc('How often to sync automatically. 0 disables. Default 1440 (daily).')
			.addText((text) =>
				text
					.setPlaceholder('1440')
					.setValue(String(this.plugin.settings.syncIntervalMinutes))
					.onChange(async (value) => {
						const minutes = Number.parseInt(value, 10);
						this.plugin.settings.syncIntervalMinutes = Number.isFinite(minutes)
							? Math.max(0, minutes)
							: 0;
						await this.plugin.saveSettings();
						this.plugin.restartAutoSync();
					})
			);

		new Setting(containerEl)
			.setName('Sync state')
			.setDesc('Clear the incremental cursor so the next sync re-pulls everything.')
			.addButton((button) =>
				button.setButtonText('Reset sync state').onClick(async () => {
					this.plugin.settings.lastContentUpdatedAt = '';
					await this.plugin.saveSettings();
					new Notice('nabit: sync state reset');
				})
			);

		new Setting(containerEl)
			.setName('Connection')
			.setDesc('Verify the API URL and token.')
			.addButton((button) =>
				button.setButtonText('Test connection').onClick(async () => {
					button.setDisabled(true);
					try {
						const result = await this.plugin
							.createClient()
							.listArticles({ limit: 1 });
						new Notice(`nabit: connected — ${result.total} article(s) available`);
					} catch (error) {
						new Notice(
							`nabit: connection failed — ${
								error instanceof Error ? error.message : String(error)
							}`
						);
					} finally {
						button.setDisabled(false);
					}
				})
			);
	}
}
