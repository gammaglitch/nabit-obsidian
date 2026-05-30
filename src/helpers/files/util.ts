import { Plugin, TFile } from 'obsidian';

import { StoredFile, StoredFileMap } from './types';

export function makeFile(file: TFile, content: string): StoredFile {
	return {
		name: file.name,
		path: file.path,
		data: {
			content,
		},
	};
}

export async function getFiles(
	plugin: Plugin
): Promise<StoredFileMap> {
	const files = plugin.app.vault.getMarkdownFiles();
	const fMap: StoredFileMap = new Map();

	const contents = await Promise.all(
		files.map((f) => plugin.app.vault.cachedRead(f))
	);

	for (let i = 0; i < files.length; i++) {
		fMap.set(files[i].path, makeFile(files[i], contents[i]));
	}

	return fMap;
}

export async function appendToFile(
	plugin: Plugin,
	filePath: string,
	line: string
): Promise<void> {
	const fileRef = plugin.app.vault.getAbstractFileByPath(filePath) as TFile;
	const content = await plugin.app.vault.read(fileRef);
	const newContent = content.endsWith('\n')
		? `${content}${line}\n`
		: `${content}\n${line}\n`;
	await plugin.app.vault.modify(fileRef, newContent);
}
