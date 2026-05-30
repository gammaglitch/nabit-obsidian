// Pure helpers for the sync loop. No `obsidian` import so they unit-test under
// jest without the plugin runtime.

/** Vault-relative path for an article note: `<folder>/<slug>.md`. */
export function articleNotePath(folder: string, slug: string): string {
	const clean = folder
		.trim()
		.replace(/^\/+|\/+$/g, '')
		.replace(/\/{2,}/g, '/');
	const name = `${slug}.md`;
	return clean ? `${clean}/${name}` : name;
}

export interface SyncOutcome {
	contentUpdatedAt: string;
	ok: boolean;
}

/**
 * New incremental high-water mark. Articles arrive in ascending
 * `contentUpdatedAt` order, so we advance only across the leading run of
 * successes — stopping at the first failure guarantees a failed article is
 * re-pulled on the next sync (re-writing later successes is idempotent).
 */
export function highWaterMark(since: string, outcomes: SyncOutcome[]): string {
	let mark = since;
	for (const outcome of outcomes) {
		if (!outcome.ok) {
			break;
		}
		if (outcome.contentUpdatedAt > mark) {
			mark = outcome.contentUpdatedAt;
		}
	}
	return mark;
}
