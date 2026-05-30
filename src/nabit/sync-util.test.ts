import { articleNotePath, highWaterMark } from './sync-util';

describe('articleNotePath', () => {
	it('joins folder and slug with a .md extension', () => {
		expect(articleNotePath('nabit', '5-show-hn')).toBe('nabit/5-show-hn.md');
	});

	it('normalises slashes on the folder', () => {
		expect(articleNotePath('/nabit//sub/', '7-foo')).toBe('nabit/sub/7-foo.md');
	});

	it('writes to the vault root when folder is empty', () => {
		expect(articleNotePath('  ', '7-foo')).toBe('7-foo.md');
	});
});

describe('highWaterMark', () => {
	it('advances to the max timestamp when all succeed', () => {
		const mark = highWaterMark('', [
			{ contentUpdatedAt: '2026-05-30T10:00:00.000Z', ok: true },
			{ contentUpdatedAt: '2026-05-30T11:00:00.000Z', ok: true },
		]);
		expect(mark).toBe('2026-05-30T11:00:00.000Z');
	});

	it('stops at the first failure so it is retried next sync', () => {
		const mark = highWaterMark('2026-05-30T09:00:00.000Z', [
			{ contentUpdatedAt: '2026-05-30T10:00:00.000Z', ok: true },
			{ contentUpdatedAt: '2026-05-30T11:00:00.000Z', ok: false },
			{ contentUpdatedAt: '2026-05-30T12:00:00.000Z', ok: true },
		]);
		expect(mark).toBe('2026-05-30T10:00:00.000Z');
	});

	it('keeps the prior mark when the first article fails', () => {
		const mark = highWaterMark('2026-05-30T09:00:00.000Z', [
			{ contentUpdatedAt: '2026-05-30T10:00:00.000Z', ok: false },
		]);
		expect(mark).toBe('2026-05-30T09:00:00.000Z');
	});
});
