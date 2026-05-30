import { Plugin } from 'obsidian';

import { PLUGIN_VIEW_TYPE } from './constants';

type OpenPluginViewOptions = {
	reveal?: boolean;
};

export async function openOrRevealPluginView(
	plugin: Plugin,
	options: OpenPluginViewOptions = {}
): Promise<void> {
	const { reveal = true } = options;
	const leaves = plugin.app.workspace.getLeavesOfType(PLUGIN_VIEW_TYPE);

	if (leaves.length === 0) {
		const leaf = plugin.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: PLUGIN_VIEW_TYPE, active: reveal });

		if (reveal) {
			plugin.app.workspace.revealLeaf(leaf);
		}

		return;
	}

	if (reveal) {
		leaves.forEach((leaf) => plugin.app.workspace.revealLeaf(leaf));
	}
}
