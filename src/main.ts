import './style/index.css';

import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { createElement, render } from 'preact';

import { NabitClient } from './nabit/client';
import {
	DEFAULT_SETTINGS,
	NabitSettings,
	NabitSettingTab,
} from './settings';
import { ViewWrapper } from './ViewWrapper';
import {
	PLUGIN_VIEW_ICON,
	PLUGIN_VIEW_NAME,
	PLUGIN_VIEW_TYPE,
} from './obsidian/constants';
import { maybeStartTestBridge, TestBridgeServer } from './obsidian/testBridge';
import { openOrRevealPluginView } from './obsidian/view';

class NabitView extends ItemView {
	private plugin: Plugin;

	constructor(leaf: WorkspaceLeaf, plugin: NabitPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PLUGIN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return PLUGIN_VIEW_NAME;
	}

	getIcon(): string {
		return PLUGIN_VIEW_ICON;
	}

	async onOpen(): Promise<void> {
		render(createElement(ViewWrapper, { plugin: this.plugin }), this.contentEl);
	}

	async onClose(): Promise<void> {
		render(null, this.contentEl);
	}
}

export default class NabitPlugin extends Plugin {
	settings: NabitSettings = DEFAULT_SETTINGS;

	private testBridge: TestBridgeServer | null = null;

	onunload(): void {
		if (this.testBridge) {
			void this.testBridge.stop();
			this.testBridge = null;
		}

		this.app.workspace
			.getLeavesOfType(PLUGIN_VIEW_TYPE)
			.forEach((leaf) => leaf.detach());
	}

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new NabitSettingTab(this.app, this));

		this.registerView(
			PLUGIN_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new NabitView(leaf, this)
		);

		this.app.workspace.onLayoutReady(() => {
			void openOrRevealPluginView(this, { reveal: true });
		});

		try {
			this.testBridge = await maybeStartTestBridge(this);
		} catch (error) {
			console.error('[test-bridge] failed to start', error);
		}
	}

	/** Builds an API client from the current settings. */
	createClient(): NabitClient {
		return new NabitClient({
			baseUrl: this.settings.apiBaseUrl,
			token: this.settings.apiToken || undefined,
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
