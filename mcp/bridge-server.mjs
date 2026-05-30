/**
 * MCP server that proxies tool calls to the Obsidian dev bridge HTTP API.
 *
 * Usage:
 *   OBSIDIAN_BRIDGE_URL=http://127.0.0.1:27124 node mcp/bridge-server.mjs
 *
 * Configure in Claude Code settings:
 *   "mcpServers": {
 *     "obsidian": {
 *       "command": "node",
 *       "args": ["mcp/bridge-server.mjs"],
 *       "env": { "OBSIDIAN_BRIDGE_URL": "http://127.0.0.1:27124" }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BRIDGE_URL =
	process.env.OBSIDIAN_BRIDGE_URL || 'http://127.0.0.1:27124';
const BRIDGE_TOKEN = process.env.OBSIDIAN_BRIDGE_TOKEN || '';

async function callBridge(method, params = {}) {
	const headers = { 'content-type': 'application/json' };

	if (BRIDGE_TOKEN) {
		headers['authorization'] = `Bearer ${BRIDGE_TOKEN}`;
	}

	const res = await fetch(`${BRIDGE_URL}/call`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ method, params }),
	});

	const data = await res.json();

	if (!data.ok) {
		throw new Error(data.error?.message ?? 'bridge call failed');
	}

	return data.result;
}

function textResult(result) {
	return {
		content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
	};
}

const server = new McpServer({
	name: 'obsidian-bridge',
	version: '0.1.0',
});

// -- Connectivity --

server.tool('obsidian_ping', 'Check if the Obsidian bridge is responsive', async () => {
	return textResult(await callBridge('ping'));
});

server.tool(
	'obsidian_get_plugin_state',
	'Get plugin state: active file, open views, vault name, recent errors',
	async () => {
		return textResult(await callBridge('getPluginState'));
	}
);

// -- File listing & search --

server.tool(
	'obsidian_list_files',
	'List all markdown files in the vault',
	async () => {
		return textResult(await callBridge('listFiles'));
	}
);

server.tool(
	'obsidian_list_folders',
	'List all folders in the vault',
	async () => {
		return textResult(await callBridge('listFolders'));
	}
);

server.tool(
	'obsidian_search',
	'Search vault files by filename or content (case-insensitive)',
	{ query: z.string().describe('Search term to match against filenames and file content') },
	async ({ query }) => {
		return textResult(await callBridge('searchVault', { query }));
	}
);

// -- File read/write --

server.tool(
	'obsidian_read_file',
	'Read the content of a vault file',
	{ path: z.string().describe('Vault-relative file path, e.g. "notes/todo.md"') },
	async ({ path }) => {
		return textResult(await callBridge('readVaultFile', { path }));
	}
);

server.tool(
	'obsidian_create_file',
	'Create a new file in the vault',
	{
		path: z.string().describe('Vault-relative file path for the new file'),
		content: z.string().describe('Initial file content'),
	},
	async ({ path, content }) => {
		return textResult(await callBridge('createFile', { path, content }));
	}
);

server.tool(
	'obsidian_write_file',
	'Overwrite the content of an existing vault file',
	{
		path: z.string().describe('Vault-relative file path'),
		content: z.string().describe('New file content (replaces existing)'),
	},
	async ({ path, content }) => {
		return textResult(await callBridge('writeVaultFile', { path, content }));
	}
);

server.tool(
	'obsidian_append_to_file',
	'Append a line to the end of a vault file',
	{
		path: z.string().describe('Vault-relative file path'),
		line: z.string().describe('Text to append'),
	},
	async ({ path, line }) => {
		return textResult(await callBridge('appendToFile', { path, line }));
	}
);

server.tool(
	'obsidian_delete_file',
	'Move a vault file to the system trash',
	{ path: z.string().describe('Vault-relative file path to delete') },
	async ({ path }) => {
		return textResult(await callBridge('deleteFile', { path }));
	}
);

// -- Metadata --

server.tool(
	'obsidian_get_metadata',
	'Get file metadata: frontmatter, tags, size, and timestamps',
	{ path: z.string().describe('Vault-relative file path') },
	async ({ path }) => {
		return textResult(await callBridge('getFileMetadata', { path }));
	}
);

// -- Workspace --

server.tool(
	'obsidian_get_active_file',
	'Get the currently active file in Obsidian',
	async () => {
		return textResult(await callBridge('getActiveFile'));
	}
);

server.tool(
	'obsidian_get_active_view',
	'Get info about the active view: type, title, and associated file',
	async () => {
		return textResult(await callBridge('getActiveViewInfo'));
	}
);

server.tool(
	'obsidian_open_plugin_view',
	'Open or reveal the plugin sidebar view',
	async () => {
		return textResult(await callBridge('openPluginView'));
	}
);

// -- Diagnostics --

server.tool(
	'obsidian_get_errors',
	'Get recent uncaught errors from the Obsidian renderer',
	async () => {
		return textResult(await callBridge('getRecentErrors'));
	}
);

// -- Start --

const transport = new StdioServerTransport();
await server.connect(transport);
