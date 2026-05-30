// Response shapes for nabit's read-only /export REST API. Duplicated here by
// design — the plugin is a separate repo and consumes the API over HTTP, so we
// keep a tiny local copy of the contract rather than sharing a package.

export interface ExportArticleSummary {
	id: number;
	sourceType: string;
	title: string | null;
	sourceUrl: string | null;
	ingestedAt: string;
	sourceCreatedAt: string | null;
	contentUpdatedAt: string;
	commentCount: number;
	contentHash: string;
	slug: string;
}

export interface ExportListResult {
	articles: ExportArticleSummary[];
	nextCursor: string | null;
	total: number;
}
