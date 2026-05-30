import { requestUrl } from 'obsidian';

import type { ExportListResult } from './types';
import { buildExportUrl } from './url';

export interface NabitClientConfig {
	/** Origin of the nabit API, e.g. `http://127.0.0.1:3001`. */
	baseUrl: string;
	/** Bearer token. Optional when the API runs with AUTH_REQUIRED=false. */
	token?: string;
}

export interface ListArticlesParams {
	since?: string;
	limit?: number;
	cursor?: string;
	sourceType?: string;
	order?: 'asc' | 'desc';
}

/**
 * Thin client for nabit's read-only /export endpoints. Uses Obsidian's
 * `requestUrl` rather than `fetch` so requests aren't subject to the renderer's
 * CORS policy.
 */
export class NabitClient {
	constructor(private readonly config: NabitClientConfig) {}

	/** Index endpoint — for discovery and incremental (`since`/`cursor`) sync. */
	async listArticles(params: ListArticlesParams = {}): Promise<ExportListResult> {
		const url = buildExportUrl(this.config.baseUrl, '/export/articles', {
			since: params.since,
			limit: params.limit,
			cursor: params.cursor,
			sourceType: params.sourceType,
			order: params.order ?? 'asc',
		});
		const res = await this.get(url);
		return res.json as ExportListResult;
	}

	/** Full Markdown document (YAML frontmatter + body + comments) for one article. */
	async getArticleMarkdown(
		id: number,
		options: { comments?: boolean } = {},
	): Promise<string> {
		const url = buildExportUrl(this.config.baseUrl, `/export/articles/${id}`, {
			comments: options.comments === false ? 'false' : undefined,
		});
		const res = await this.get(url);
		return res.text;
	}

	private async get(url: string) {
		const res = await requestUrl({
			url,
			method: 'GET',
			headers: this.headers(),
			throw: false,
		});
		if (res.status === 404) {
			throw new Error(`nabit: not found (${url})`);
		}
		if (res.status >= 400) {
			throw new Error(
				`nabit: request failed ${res.status} — ${(res.text ?? '').slice(0, 200)}`,
			);
		}
		return res;
	}

	private headers(): Record<string, string> {
		return this.config.token
			? { Authorization: `Bearer ${this.config.token}` }
			: {};
	}
}
