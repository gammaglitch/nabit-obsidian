import { useAtomValue } from 'jotai';
import { useUpdateAtom } from 'jotai/utils';
import { TFile } from 'obsidian';
import { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

import { makeFile } from '../helpers/files/util';
import { filesAtom, pluginAtom } from '../store/atoms/files';
import { registerVaultEventHandlers, VaultEventListeners } from './events';

type VaultSyncProps = {
	children: ComponentChildren;
};

export function VaultSync({ children }: VaultSyncProps): JSX.Element {
	const hasRegisteredListeners = useRef(false);
	const plugin = useAtomValue(pluginAtom);
	const setFiles = useUpdateAtom(filesAtom);

	useEffect(() => {
		if (!plugin || hasRegisteredListeners.current) {
			return;
		}

		const updateFile = async (file: TFile, data: string) => {
			setFiles((current) => {
				const currentFile = current.get(file.path);

				if (!currentFile) {
					return new Map(current);
				}

				const updated = new Map(current);
				updated.set(file.path, { ...currentFile, data: { content: data } });
				return updated;
			});
		};

		const addFile = async (file: TFile) => {
			const content = await plugin.app.vault.cachedRead(file);

			setFiles((current) => {
				const updated = new Map(current);
				updated.set(file.path, makeFile(file, content));
				return updated;
			});
		};

		const deleteFile = (file: TFile) => {
			setFiles((current) => {
				const updated = new Map(current);
				updated.delete(file.path);
				return updated;
			});
		};

		const renameFile = async (file: TFile, oldPath: string) => {
			const content = await plugin.app.vault.cachedRead(file);

			setFiles((current) => {
				const updated = new Map(current);
				updated.delete(oldPath);
				updated.set(file.path, makeFile(file, content));
				return updated;
			});
		};

		const listeners: VaultEventListeners = {
			changed: (file, data) => void updateFile(file, data),
			create: (file) => void addFile(file),
			delete: (file) => deleteFile(file),
			rename: (file, oldPath) => void renameFile(file, oldPath),
		};

		registerVaultEventHandlers(plugin, listeners);
		hasRegisteredListeners.current = true;
	}, [plugin, setFiles]);

	return <>{children}</>;
}
