import { buildExportUrl } from './url';

describe('buildExportUrl', () => {
	it('builds a bare URL with no params', () => {
		expect(buildExportUrl('http://127.0.0.1:3001', '/export/articles')).toBe(
			'http://127.0.0.1:3001/export/articles',
		);
	});

	it('normalises trailing slashes on the base URL', () => {
		expect(buildExportUrl('http://host//', '/export/articles')).toBe(
			'http://host/export/articles',
		);
	});

	it('appends and encodes query params', () => {
		const url = buildExportUrl('http://host', '/export/articles', {
			since: '2026-05-30T10:00:00.000Z',
			limit: 25,
			order: 'asc',
		});
		expect(url).toBe(
			'http://host/export/articles?since=2026-05-30T10%3A00%3A00.000Z&limit=25&order=asc',
		);
	});

	it('drops undefined, null, and empty params', () => {
		const url = buildExportUrl('http://host', '/export/articles', {
			since: undefined,
			cursor: null,
			sourceType: '',
			limit: 50,
		});
		expect(url).toBe('http://host/export/articles?limit=50');
	});
});
