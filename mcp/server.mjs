/**
 * Unified MCP server that assembles tools from both the official Obsidian CLI
 * and the custom dev bridge, based on what's available at startup.
 *
 * Usage:
 *   node mcp/server.mjs
 *
 * Environment:
 *   OBSIDIAN_MCP_BACKEND  — "auto" (default), "cli", or "bridge"
 *   OBSIDIAN_CLI_BIN      — path to obsidian binary (default: "obsidian")
 *   OBSIDIAN_VAULT        — vault name to target (optional)
 *   OBSIDIAN_BRIDGE_URL   — bridge HTTP URL (default: http://127.0.0.1:27124)
 *   OBSIDIAN_BRIDGE_TOKEN — bearer token for bridge auth (optional)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registerCliTools, probeCli } from './cli-server.mjs';

const BACKEND = process.env.OBSIDIAN_MCP_BACKEND || 'auto';
const BRIDGE_URL =
	process.env.OBSIDIAN_BRIDGE_URL || 'http://127.0.0.1:27124';
const BRIDGE_TOKEN = process.env.OBSIDIAN_BRIDGE_TOKEN || '';

// ---------------------------------------------------------------------------
// Bridge helpers
// ---------------------------------------------------------------------------

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

function bridgeTextResult(result) {
	return {
		content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
	};
}

// ---------------------------------------------------------------------------
// Bridge probe
// ---------------------------------------------------------------------------

async function probeBridge() {
	try {
		const res = await fetch(`${BRIDGE_URL}/call`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(BRIDGE_TOKEN
					? { authorization: `Bearer ${BRIDGE_TOKEN}` }
					: {}),
			},
			body: JSON.stringify({ method: 'ping', params: {} }),
			signal: AbortSignal.timeout(3000),
		});
		const data = await res.json();
		return { available: data.ok === true };
	} catch {
		return { available: false };
	}
}

// ---------------------------------------------------------------------------
// Bridge-only tool registration
//
// These tools cover capabilities the CLI does not expose cleanly.
// See docs/cli-vs-bridge-capability-matrix.md for the full classification.
// ---------------------------------------------------------------------------

function registerBridgeOnlyTools(server) {
	server.tool(
		'obsidian_get_plugin_state',
		'Get plugin state: active file, open views, vault name, recent errors',
		async () => {
			return bridgeTextResult(await callBridge('getPluginState'));
		}
	);

	server.tool(
		'obsidian_get_active_file',
		'Get the currently active file in Obsidian',
		async () => {
			return bridgeTextResult(await callBridge('getActiveFile'));
		}
	);

	server.tool(
		'obsidian_get_active_view',
		'Get info about the active view: type, title, and associated file',
		async () => {
			return bridgeTextResult(await callBridge('getActiveViewInfo'));
		}
	);

	server.tool(
		'obsidian_open_plugin_view',
		'Open or reveal the plugin sidebar view',
		async () => {
			return bridgeTextResult(await callBridge('openPluginView'));
		}
	);

	server.tool(
		'obsidian_get_metadata',
		'Get file metadata: frontmatter, tags, size, and timestamps',
		{
			path: z
				.string()
				.describe('Vault-relative file path'),
		},
		async ({ path }) => {
			return bridgeTextResult(
				await callBridge('getFileMetadata', { path })
			);
		}
	);

	server.tool(
		'obsidian_write_file',
		'Overwrite the content of an existing vault file',
		{
			path: z.string().describe('Vault-relative file path'),
			content: z
				.string()
				.describe('New file content (replaces existing)'),
		},
		async ({ path, content }) => {
			return bridgeTextResult(
				await callBridge('writeVaultFile', { path, content })
			);
		}
	);
}

// ---------------------------------------------------------------------------
// Bridge vault/file tools (registered whenever bridge is available)
//
// The CLI has related commands but we don't have CLI-backed implementations
// for these yet. Bridge-backed for now; CLI migration is a future step.
// ---------------------------------------------------------------------------

function registerBridgeVaultTools(server) {
	server.tool(
		'obsidian_list_files',
		'List all markdown files in the vault',
		async () => {
			return bridgeTextResult(await callBridge('listFiles'));
		}
	);

	server.tool(
		'obsidian_list_folders',
		'List all folders in the vault',
		async () => {
			return bridgeTextResult(await callBridge('listFolders'));
		}
	);

	server.tool(
		'obsidian_search',
		'Search vault files by filename or content (case-insensitive)',
		{
			query: z
				.string()
				.describe(
					'Search term to match against filenames and file content'
				),
		},
		async ({ query }) => {
			return bridgeTextResult(
				await callBridge('searchVault', { query })
			);
		}
	);

	server.tool(
		'obsidian_read_file',
		'Read the content of a vault file',
		{
			path: z
				.string()
				.describe('Vault-relative file path, e.g. "notes/todo.md"'),
		},
		async ({ path }) => {
			return bridgeTextResult(
				await callBridge('readVaultFile', { path })
			);
		}
	);

	server.tool(
		'obsidian_create_file',
		'Create a new file in the vault',
		{
			path: z
				.string()
				.describe('Vault-relative file path for the new file'),
			content: z.string().describe('Initial file content'),
		},
		async ({ path, content }) => {
			return bridgeTextResult(
				await callBridge('createFile', { path, content })
			);
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
			return bridgeTextResult(
				await callBridge('appendToFile', { path, line })
			);
		}
	);

	server.tool(
		'obsidian_delete_file',
		'Move a vault file to the system trash',
		{
			path: z.string().describe('Vault-relative file path to delete'),
		},
		async ({ path }) => {
			return bridgeTextResult(await callBridge('deleteFile', { path }));
		}
	);
}

// ---------------------------------------------------------------------------
// Bridge overlap tools (registered only when CLI is unavailable)
//
// These duplicate capabilities the CLI already covers. Only used as fallback.
// ---------------------------------------------------------------------------

function registerBridgeOverlapTools(server) {
	server.tool(
		'obsidian_ping',
		'Check if the Obsidian bridge is responsive',
		async () => {
			return bridgeTextResult(await callBridge('ping'));
		}
	);

	server.tool(
		'obsidian_get_errors',
		'Get recent uncaught errors from the Obsidian renderer',
		async () => {
			return bridgeTextResult(await callBridge('getRecentErrors'));
		}
	);
}

// ---------------------------------------------------------------------------
// Capability assembly
// ---------------------------------------------------------------------------

const server = new McpServer({
	name: 'obsidian',
	version: '0.2.0',
});

const log = (msg) => process.stderr.write(`[obsidian-mcp] ${msg}\n`);

// Probe backends
let cliAvailable = false;
let bridgeAvailable = false;
let cliProbeResult = null;

if (BACKEND === 'cli' || BACKEND === 'auto') {
	cliProbeResult = await probeCli();
	cliAvailable = cliProbeResult.available;
}

if (BACKEND === 'bridge' || BACKEND === 'auto') {
	const bridgeProbe = await probeBridge();
	bridgeAvailable = bridgeProbe.available;
}

// Fail fast in forced modes
if (BACKEND === 'cli' && !cliAvailable) {
	log(`ERROR: CLI backend requested but unavailable: ${cliProbeResult?.reason}`);
	process.exit(1);
}

if (BACKEND === 'bridge' && !bridgeAvailable) {
	log(`ERROR: Bridge backend requested but unavailable at ${BRIDGE_URL}`);
	process.exit(1);
}

if (!cliAvailable && !bridgeAvailable) {
	log('ERROR: No backends available. Need either the obsidian CLI or the dev bridge.');
	process.exit(1);
}

// Register tools based on availability
const registered = { cli: [], bridge: [] };

if (cliAvailable) {
	registerCliTools(server);
	registered.cli.push(
		'ping', 'version', 'plugins', 'plugin_info', 'reload_plugin',
		'list_commands', 'execute_command', 'get_errors', 'get_console',
		'debug_attach', 'debug_detach', 'query_dom', 'get_css',
		'take_screenshot', 'eval'
	);
	log(`CLI backend: available (${cliProbeResult.version}, vault: ${cliProbeResult.vault})`);
} else {
	log('CLI backend: not available');
}

if (bridgeAvailable) {
	registerBridgeOnlyTools(server);
	registered.bridge.push(
		'get_plugin_state', 'get_active_file', 'get_active_view',
		'open_plugin_view', 'get_metadata', 'write_file'
	);

	// Vault/file tools are always bridge-backed for now (no CLI implementations yet)
	registerBridgeVaultTools(server);
	registered.bridge.push(
		'list_files', 'list_folders', 'search',
		'read_file', 'create_file', 'append_to_file', 'delete_file'
	);

	if (!cliAvailable) {
		// Bridge provides fallback for tools the CLI would normally cover
		registerBridgeOverlapTools(server);
		registered.bridge.push('ping', 'get_errors');
		log('Bridge backend: available (providing all tools — CLI absent)');
	} else {
		log('Bridge backend: available (bridge-only + vault tools)');
	}
} else {
	log('Bridge backend: not available');
}

// -- Capability reporting ---------------------------------------------------

server.tool(
	'obsidian_get_capabilities',
	'Report which backends and tools are available in this MCP session',
	async () => {
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							backend_mode: BACKEND,
							cli: {
								available: cliAvailable,
								version: cliProbeResult?.version ?? null,
								vault: cliProbeResult?.vault ?? null,
								tools: registered.cli,
							},
							bridge: {
								available: bridgeAvailable,
								url: bridgeAvailable ? BRIDGE_URL : null,
								tools: registered.bridge,
							},
						},
						null,
						2
					),
				},
			],
		};
	}
);

log(
	`Ready: ${registered.cli.length + registered.bridge.length + 1} tools registered`
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
