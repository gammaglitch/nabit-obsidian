// Pure URL helpers for the nabit export API. Kept free of any `obsidian`
// import so they can be unit-tested under jest without the plugin runtime.

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Joins a base URL, path, and query params into a request URL. Empty/undefined
 * params are dropped; the base URL's trailing slashes are normalised.
 */
export function buildExportUrl(
	baseUrl: string,
	path: string,
	params: Record<string, QueryValue> = {},
): string {
	const base = baseUrl.replace(/\/+$/, '');
	const search = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') {
			continue;
		}
		search.set(key, String(value));
	}

	const qs = search.toString();
	return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}
