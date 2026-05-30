import { CachedMetadata, Plugin, TAbstractFile, TFile } from 'obsidian';

export type VaultEventListeners = {
	changed: (file: TFile, data: string, cache: CachedMetadata) => void;
	create: (file: TFile) => void;
	delete: (file: TFile) => void;
	rename: (file: TFile, oldPath: string) => void;
};

export function registerVaultEventHandlers(
	plugin: Plugin,
	listeners: VaultEventListeners
): void {
	plugin.registerEvent(
		plugin.app.metadataCache.on(
			'changed',
			(file: TFile, data: string, cache: CachedMetadata) => {
				if (file instanceof TFile) {
					listeners.changed(file, data, cache);
				}
			}
		)
	);

	plugin.registerEvent(
		plugin.app.vault.on('create', (file: TAbstractFile) => {
			if (file instanceof TFile) {
				listeners.create(file);
			}
		})
	);

	plugin.registerEvent(
		plugin.app.vault.on('delete', (file: TAbstractFile) => {
			if (file instanceof TFile) {
				listeners.delete(file);
			}
		})
	);

	plugin.registerEvent(
		plugin.app.vault.on(
			'rename',
			(file: TAbstractFile, oldPath: string) => {
				if (file instanceof TFile) {
					listeners.rename(file, oldPath);
				}
			}
		)
	);
}
