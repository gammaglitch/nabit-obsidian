import { atom } from 'jotai';
import { atomWithDefault, loadable, selectAtom } from 'jotai/utils';
import { Plugin } from 'obsidian';

import { StoredFile } from '../../helpers/files/types';
import { getFiles } from '../../helpers/files/util';

export const pluginAtom = atom<Plugin | null>(null);

export const selectPlugin = atom((get) => {
	const plugin = get(pluginAtom);

	if (plugin) {
		return plugin;
	}
	throw new Error('missing reference to plugin');
});

export const filesAtom = atomWithDefault((get) => {
	const plugin = get(pluginAtom);

	if (plugin) {
		return getFiles(plugin);
	}

	throw new Error('missing plugin');
});

export const selectFilesMap = selectAtom(filesAtom, (data) => data);

export const selectFilesList = selectAtom(filesAtom, (data) => [
	...data.values(),
]);

export const loadableFiles = loadable(selectFilesList);

export const activeFileAtom = atom<StoredFile | null>(null);
