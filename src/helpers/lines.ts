export function appendLine(content: string, line: string): string {
	if (content.length === 0) {
		return `${line}\n`;
	}

	return content.endsWith('\n')
		? `${content}${line}\n`
		: `${content}\n${line}\n`;
}

export function getLines(content: string): string[] {
	if (content.length === 0) {
		return [];
	}

	const lines = content.split('\n');

	if (lines[lines.length - 1] === '') {
		lines.pop();
	}

	return lines;
}
