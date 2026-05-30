import { TFile } from 'obsidian';

import type NabitPlugin from '../main';
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
 * One-way incremental sync: pull changed articles from nabit's /export API and
 * write each as `<targetFolder>/<slug>.md`, overwriting any existing note.
 */
export async function runSync(plugin: NabitPlugin): Promise<SyncResult> {
	const client = plugin.createClient();
	const { targetFolder, includeComments } = plugin.settings;
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

	// 2. Ensure the target folder exists.
	await ensureFolder(plugin, targetFolder);

	// 3. Fetch + write each article, recording per-article outcomes in order.
	const errors: string[] = [];
	const outcomes: SyncOutcome[] = [];
	let written = 0;

	for (const article of articles) {
		try {
			const markdown = await client.getArticleMarkdown(article.id, {
				comments: includeComments,
			});
			await writeNote(plugin, articleNotePath(targetFolder, article.slug), markdown);
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
