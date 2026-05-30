import { TFile, TFolder } from 'obsidian';

import type NabitPlugin from '../main';
import {
	contentTypeToExt,
	extractAssets,
	rewriteAssetLinks,
	vaultRelativePath,
} from './asset-util';
import type { NabitClient } from './client';
import type { ExportArticleSummary } from './types';
import { articleNotePath, highWaterMark, SyncOutcome } from './sync-util';

const PAGE_LIMIT = 100;

export interface SyncResult {
	written: number;
	failed: number;
	errors: string[];
	lastContentUpdatedAt: string;
}

/**
 * One-way incremental sync: pull changed articles from /export and write each
 * as `<targetFolder>/<slug>.md` (overwriting). Optionally downloads images into
 * `<assetFolder>` and rewrites links to be vault-relative. Tracks an id->path
 * index so a slug change (title edit) renames the existing note instead of
 * orphaning a duplicate.
 */
export async function runSync(plugin: NabitPlugin): Promise<SyncResult> {
	const client = plugin.createClient();
	const { targetFolder, includeComments, downloadAssets, assetFolder } =
		plugin.settings;
	const since = plugin.settings.lastContentUpdatedAt || undefined;

	// 1. Drain the incremental index (ascending by contentUpdatedAt).
	const articles: ExportArticleSummary[] = [];
	let cursor: string | undefined;
	do {
		const page = await client.listArticles({
			since,
			cursor,
			order: 'asc',
			limit: PAGE_LIMIT,
		});
		articles.push(...page.articles);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);

	// 2. Ensure folders, and index already-downloaded assets (sha -> path).
	await ensureFolder(plugin, targetFolder);
	const assetMap = new Map<string, string>();
	if (downloadAssets) {
		await ensureFolder(plugin, assetFolder);
		loadExistingAssets(plugin, assetFolder, assetMap);
	}

	// 3. Fetch + write each article, recording outcomes in order.
	const errors: string[] = [];
	const outcomes: SyncOutcome[] = [];
	let written = 0;

	for (const article of articles) {
		try {
			let markdown = await client.getArticleMarkdown(article.id, {
				comments: includeComments,
			});
			const targetPath = articleNotePath(targetFolder, article.slug);

			if (downloadAssets) {
				markdown = await downloadAndRewriteAssets(
					plugin,
					client,
					markdown,
					targetPath,
					assetFolder,
					assetMap
				);
			}

			await handleRename(plugin, article.id, targetPath);
			await writeNote(plugin, targetPath, markdown);
			plugin.settings.notePaths[String(article.id)] = targetPath;

			written += 1;
			outcomes.push({ contentUpdatedAt: article.contentUpdatedAt, ok: true });
		} catch (error) {
			errors.push(
				`#${article.id} ${article.slug}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			outcomes.push({ contentUpdatedAt: article.contentUpdatedAt, ok: false });
		}
	}

	// 4. Advance the cursor only across the leading run of successes.
	const lastContentUpdatedAt = highWaterMark(
		plugin.settings.lastContentUpdatedAt,
		outcomes
	);
	plugin.settings.lastContentUpdatedAt = lastContentUpdatedAt;
	await plugin.saveSettings();

	return { written, failed: errors.length, errors, lastContentUpdatedAt };
}

/** Renames a previously-synced note when its slug (title) has changed. */
async function handleRename(
	plugin: NabitPlugin,
	id: number,
	targetPath: string
): Promise<void> {
	const previous = plugin.settings.notePaths[String(id)];
	if (!previous || previous === targetPath) {
		return;
	}
	const file = plugin.app.vault.getAbstractFileByPath(previous);
	if (file instanceof TFile) {
		try {
			await plugin.app.fileManager.renameFile(file, targetPath);
		} catch {
			// Target may already exist or the move failed; writeNote handles content.
		}
	}
}

async function downloadAndRewriteAssets(
	plugin: NabitPlugin,
	client: NabitClient,
	markdown: string,
	notePath: string,
	assetFolder: string,
	assetMap: Map<string, string>
): Promise<string> {
	const folder = assetFolder.trim().replace(/^\/+|\/+$/g, '');

	for (const { sha, url } of extractAssets(markdown)) {
		if (assetMap.has(sha)) {
			continue;
		}
		const binary = await client.fetchBinary(url);
		if (!binary) {
			continue; // leave the remote URL in place on failure
		}
		const ext = contentTypeToExt(binary.contentType || 'application/octet-stream');
		const path = folder ? `${folder}/${sha}.${ext}` : `${sha}.${ext}`;
		try {
			await plugin.app.vault.createBinary(path, binary.arrayBuffer);
			assetMap.set(sha, path);
		} catch {
			// Created concurrently / already exists — reuse if present.
			if (plugin.app.vault.getAbstractFileByPath(path)) {
				assetMap.set(sha, path);
			}
		}
	}

	return rewriteAssetLinks(markdown, (sha) => {
		const path = assetMap.get(sha);
		return path ? vaultRelativePath(notePath, path) : null;
	});
}

function loadExistingAssets(
	plugin: NabitPlugin,
	assetFolder: string,
	assetMap: Map<string, string>
): void {
	const clean = assetFolder.trim().replace(/^\/+|\/+$/g, '');
	const folder = plugin.app.vault.getAbstractFileByPath(clean);
	if (!(folder instanceof TFolder)) {
		return;
	}
	for (const child of folder.children) {
		if (child instanceof TFile) {
			const sha = child.name.replace(/\.[^.]+$/, '');
			if (/^[0-9a-f]{64}$/.test(sha)) {
				assetMap.set(sha, child.path);
			}
		}
	}
}

async function ensureFolder(plugin: NabitPlugin, folder: string): Promise<void> {
	const clean = folder.trim().replace(/^\/+|\/+$/g, '');
	if (!clean || plugin.app.vault.getAbstractFileByPath(clean)) {
		return;
	}
	try {
		await plugin.app.vault.createFolder(clean);
	} catch {
		// Already exists / created concurrently — fine.
	}
}

async function writeNote(
	plugin: NabitPlugin,
	path: string,
	content: string
): Promise<void> {
	const existing = plugin.app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await plugin.app.vault.modify(existing, content);
	} else {
		await plugin.app.vault.create(path, content);
	}
}
