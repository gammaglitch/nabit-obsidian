import {
	contentTypeToExt,
	extractAssets,
	rewriteAssetLinks,
	vaultRelativePath,
} from './asset-util';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

describe('contentTypeToExt', () => {
	it('maps common image types', () => {
		expect(contentTypeToExt('image/png')).toBe('png');
		expect(contentTypeToExt('image/jpeg; charset=binary')).toBe('jpg');
		expect(contentTypeToExt('image/svg+xml')).toBe('svg');
		expect(contentTypeToExt('image/webp')).toBe('webp');
	});

	it('falls back to the subtype for unknown types', () => {
		expect(contentTypeToExt('image/x-icon')).toBe('xicon');
		expect(contentTypeToExt('')).toBe('bin');
	});
});

describe('extractAssets', () => {
	it('returns unique sha/url pairs', () => {
		const md =
			`![a](http://127.0.0.1:3001/assets/${SHA_A}) ` +
			`![b](http://127.0.0.1:3001/assets/${SHA_B}) ` +
			`![a again](http://127.0.0.1:3001/assets/${SHA_A})`;
		const refs = extractAssets(md);
		expect(refs).toEqual([
			{ sha: SHA_A, url: `http://127.0.0.1:3001/assets/${SHA_A}` },
			{ sha: SHA_B, url: `http://127.0.0.1:3001/assets/${SHA_B}` },
		]);
	});

	it('ignores non-asset URLs', () => {
		expect(extractAssets('![x](https://example.com/y.png)')).toEqual([]);
	});
});

describe('rewriteAssetLinks', () => {
	it('replaces resolved shas and keeps unresolved ones', () => {
		const md =
			`![a](http://h/assets/${SHA_A}) ![b](http://h/assets/${SHA_B})`;
		const out = rewriteAssetLinks(md, (sha) =>
			sha === SHA_A ? 'assets/local.png' : null,
		);
		expect(out).toBe(
			`![a](assets/local.png) ![b](http://h/assets/${SHA_B})`,
		);
	});
});

describe('vaultRelativePath', () => {
	it('resolves a sibling assets folder', () => {
		expect(vaultRelativePath('nabit/5-x.md', 'nabit/assets/z.png')).toBe(
			'assets/z.png',
		);
	});

	it('resolves from the vault root', () => {
		expect(vaultRelativePath('5-x.md', 'nabit/assets/z.png')).toBe(
			'nabit/assets/z.png',
		);
	});

	it('walks up when the note is in an unrelated folder', () => {
		expect(vaultRelativePath('foo/5-x.md', 'nabit/assets/z.png')).toBe(
			'../nabit/assets/z.png',
		);
	});
});
