import { useAtom, useAtomValue } from 'jotai';
import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';

import { appendToFile } from '../helpers/files/util';
import { getLines } from '../helpers/lines';
import {
	activeFileAtom,
	loadableFiles,
	selectPlugin,
} from '../store/atoms/files';
import { StoredFile } from '../helpers/files/types';

const FileRow: FunctionalComponent<{
	file: StoredFile;
	active: boolean;
	onSelect: (file: StoredFile) => void;
}> = ({ file, active, onSelect }) => (
	<div
		className={`px-2 py-1 cursor-pointer rounded text-sm ${
			active
				? 'bg-obsidian-bg-active text-obsidian-text'
				: 'text-obsidian-text-muted hover:bg-obsidian-bg-hover'
		}`}
		onClick={() => onSelect(file)}
	>
		{file.name}
	</div>
);

const FileDetail: FunctionalComponent<{ file: StoredFile }> = ({ file }) => {
	const plugin = useAtomValue(selectPlugin);
	const [input, setInput] = useState('');
	const [saving, setSaving] = useState(false);
	const lines = getLines(file.data.content);

	const handleAppend = async () => {
		const trimmed = input.trim();

		if (!trimmed) {
			return;
		}

		setSaving(true);
		await appendToFile(plugin, file.path, trimmed);
		setInput('');
		setSaving(false);
	};

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-lg font-semibold text-obsidian-text">{file.name}</h2>

			<div className="flex gap-2">
				<input
					type="text"
					className="flex-1 px-2 py-1 rounded bg-obsidian-bg-secondary text-obsidian-text text-sm border border-obsidian-border"
					placeholder="Type a line to append..."
					value={input}
					onInput={(e) => setInput((e.target as HTMLInputElement).value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') void handleAppend();
					}}
					disabled={saving}
				/>
				<button
					className="px-3 py-1 rounded bg-obsidian-interactive text-obsidian-text text-sm hover:bg-obsidian-interactive-hover"
					onClick={() => void handleAppend()}
					disabled={saving || !input.trim()}
				>
					Append
				</button>
			</div>

			<div className="text-sm text-obsidian-text-muted">
				{lines.length === 0 ? (
					<p className="italic">Empty file</p>
				) : (
					<pre className="whitespace-pre-wrap">{lines.join('\n')}</pre>
				)}
			</div>
		</div>
	);
};

export const ExampleView: FunctionalComponent = () => {
	const data = useAtomValue(loadableFiles);
	const [activeFile, setActiveFile] = useAtom(activeFileAtom);

	return (
		<div data-testid="plugin-root" className="flex w-full h-full">
			<div data-testid="plugin-sidebar" className="flex-shrink-0 w-1/3 px-4 pt-4 overflow-auto bg-obsidian-bg-secondary">
				<h3 className="text-xs font-bold text-obsidian-text-faint uppercase mb-2">
					Files
				</h3>
				{data.state === 'hasData' &&
					data.data.map((file) => (
						<FileRow
							key={file.path}
							file={file}
							active={activeFile?.path === file.path}
							onSelect={setActiveFile}
						/>
					))}
			</div>

			<div className="flex-1 w-2/3 px-4 pt-4 bg-obsidian-bg">
				{activeFile ? (
					<FileDetail file={activeFile} />
				) : (
					<p className="text-sm text-obsidian-text-muted italic">
						Select a file to view its contents and append lines.
					</p>
				)}
			</div>
		</div>
	);
};

export default ExampleView;
