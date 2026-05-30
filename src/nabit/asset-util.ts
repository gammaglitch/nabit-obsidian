// Pure helpers for downloading and re-linking image assets. No `obsidian`
// import so they unit-test under jest.

// Matches the absolute asset URLs the export API embeds, e.g.
// http://127.0.0.1:3001/assets/<sha256>. Capture group 1 is the sha.
const ASSET_URL_SOURCE = 'https?://[^\\s)]+/assets/([0-9a-f]{64})';

const CONTENT_TYPE_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/bmp': 'bmp',
	'image/svg+xml': 'svg',
};

/** Maps a Content-Type to a file extension for the downloaded asset. */
export function contentTypeToExt(contentType: string): string {
	const ct = contentType.split(';')[0].trim().toLowerCase();
	if (CONTENT_TYPE_EXT[ct]) {
		return CONTENT_TYPE_EXT[ct];
	}
	const sub = ct.split('/')[1] ?? '';
	const cleaned = sub.replace(/\+.*$/, '').replace(/[^a-z0-9]/g, '');
	return cleaned || 'bin';
}

export interface AssetRef {
	sha: string;
	url: string;
}

/** Unique (by sha) asset URLs referenced in the markdown. */
export function extractAssets(markdown: string): AssetRef[] {
	const re = new RegExp(ASSET_URL_SOURCE, 'g');
	const seen = new Map<string, string>();
	for (const match of markdown.matchAll(re)) {
		if (!seen.has(match[1])) {
			seen.set(match[1], match[0]);
		}
	}
	return [...seen].map(([sha, url]) => ({ sha, url }));
}

/**
 * Replaces each asset URL with the value returned by `resolve(sha)`. When the
 * resolver returns null (e.g. download failed) the original URL is kept.
 */
export function rewriteAssetLinks(
	markdown: string,
	resolve: (sha: string) => string | null,
): string {
	const re = new RegExp(ASSET_URL_SOURCE, 'g');
	return markdown.replace(re, (whole, sha) => resolve(sha) ?? whole);
}

/** Path of `toPath` relative to the directory containing `fromNotePath`. */
export function vaultRelativePath(fromNotePath: string, toPath: string): string {
	const fromDir = fromNotePath.split('/').slice(0, -1);
	const to = toPath.split('/');

	let i = 0;
	while (i < fromDir.length && i < to.length - 1 && fromDir[i] === to[i]) {
		i += 1;
	}

	const ups = new Array(fromDir.length - i).fill('..');
	return [...ups, ...to.slice(i)].join('/');
}
