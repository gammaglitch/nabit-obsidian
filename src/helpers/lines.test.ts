import { appendLine, getLines } from './lines';

describe('appendLine', () => {
	it('appends to empty content', () => {
		expect(appendLine('', 'hello')).toBe('hello\n');
	});

	it('appends to content ending with newline', () => {
		expect(appendLine('first\n', 'second')).toBe('first\nsecond\n');
	});

	it('appends to content without trailing newline', () => {
		expect(appendLine('first', 'second')).toBe('first\nsecond\n');
	});

	it('preserves existing lines', () => {
		const result = appendLine('line1\nline2\n', 'line3');
		expect(result).toBe('line1\nline2\nline3\n');
	});
});

describe('getLines', () => {
	it('returns empty array for empty content', () => {
		expect(getLines('')).toEqual([]);
	});

	it('splits content into lines', () => {
		expect(getLines('one\ntwo\nthree\n')).toEqual(['one', 'two', 'three']);
	});

	it('handles content without trailing newline', () => {
		expect(getLines('one\ntwo')).toEqual(['one', 'two']);
	});

	it('handles single line', () => {
		expect(getLines('hello\n')).toEqual(['hello']);
	});
});
