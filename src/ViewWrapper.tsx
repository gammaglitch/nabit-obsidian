import { useAtom } from 'jotai';
import { Plugin } from 'obsidian';
import { FunctionalComponent } from 'preact';
import { useEffect } from 'preact/hooks';

import { ExampleView } from './components/ExampleView';
import { VaultSync } from './obsidian/VaultSync';
import { pluginAtom } from './store/atoms/files';

export type ViewWrapperProps = {
	plugin: Plugin;
};

export const ViewWrapper: FunctionalComponent<ViewWrapperProps> = ({
	plugin,
}) => {
	const [currentPlugin, setPlugin] = useAtom(pluginAtom);

	useEffect(() => {
		if (!currentPlugin) {
			setPlugin(plugin);
		}
	}, [currentPlugin, plugin, setPlugin]);

	return (
		<VaultSync>
			{currentPlugin ? <ExampleView /> : <div>loading...</div>}
		</VaultSync>
	);
};
