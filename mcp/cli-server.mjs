/**
 * CLI-backed MCP tools for the official Obsidian CLI.
 *
 * Can be used standalone:
 *   node mcp/cli-server.mjs
 *
 * Or imported by the unified server:
 *   import { registerCliTools, probeCli } from './cli-server.mjs';
 *
 * Environment:
 *   OBSIDIAN_CLI_BIN  — path to obsidian binary (default: "obsidian")
 *   OBSIDIAN_VAULT    — vault name to target (optional, uses active vault if omitted)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI_BIN = process.env.OBSIDIAN_CLI_BIN || 'obsidian';
const VAULT = process.env.OBSIDIAN_VAULT || '';

// ---------------------------------------------------------------------------
// CLI execution helper
// ---------------------------------------------------------------------------

function runCli(args, { timeout = 15000 } = {}) {
	if (VAULT) {
		args = [`vault=${VAULT}`, ...args];
	}

	return new Promise((resolve, reject) => {
		execFile(CLI_BIN, args, { timeout }, (err, stdout, stderr) => {
			if (err) {
				// Exit code errors still carry useful stdout/stderr
				if (err.killed) {
					reject(new Error(`CLI timed out after ${timeout}ms`));
					return;
				}
				reject(new Error(stderr?.trim() || err.message));
				return;
			}
			resolve({ stdout: stdout.trim(), stderr: stderr?.trim() || '' });
		});
	});
}

function tryParseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * The CLI reports errors as stdout text with exit code 0.
 * Detect the "Error: ..." prefix so we can set isError on the MCP response.
 */
function isCliError(stdout) {
	return stdout.startsWith('Error:');
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function textResult(data, meta) {
	let payload;
	if (!meta) {
		payload = data;
	} else if (Array.isArray(data)) {
		payload = { data, _meta: meta };
	} else {
		payload = { ...data, _meta: meta };
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
	};
}

function textResultRaw(text, meta) {
	if (meta) {
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({ output: text, _meta: meta }, null, 2),
				},
			],
		};
	}
	return { content: [{ type: 'text', text }] };
}

function errorResult(message, meta) {
	const payload = meta
		? JSON.stringify({ message, _meta: meta }, null, 2)
		: message;
	return { content: [{ type: 'text', text: payload }], isError: true };
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/**
 * Check if the CLI is available and Obsidian is running with an active vault.
 * Probes both `version` and `vault info=name` — matching obsidian_ping semantics.
 * Returns { available: true, version, vault } or { available: false, reason }.
 */
export async function probeCli() {
	try {
		const [version, vault] = await Promise.all([
			runCli(['version'], { timeout: 5000 }),
			runCli(['vault', 'info=name'], { timeout: 5000 }),
		]);
		if (isCliError(version.stdout) || isCliError(vault.stdout)) {
			return {
				available: false,
				reason: `${version.stdout} / ${vault.stdout}`,
			};
		}
		return {
			available: true,
			version: version.stdout,
			vault: vault.stdout,
		};
	} catch (e) {
		return { available: false, reason: e.message };
	}
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerCliTools(server) {
	// -- Connectivity -----------------------------------------------------------

	server.tool(
		'obsidian_ping',
		'Check if Obsidian is running with an active vault (not just CLI installed)',
		async () => {
			try {
				const [version, vault] = await Promise.all([
					runCli(['version'], { timeout: 5000 }),
					runCli(['vault', 'info=name'], { timeout: 5000 }),
				]);
				if (isCliError(version.stdout) || isCliError(vault.stdout)) {
					return errorResult(
						`Obsidian not reachable: ${version.stdout} / ${vault.stdout}`
					);
				}
				return textResult({
					status: 'ok',
					version: version.stdout,
					vault: vault.stdout,
				});
			} catch (e) {
				return errorResult(`Obsidian not reachable: ${e.message}`);
			}
		}
	);

	server.tool(
		'obsidian_version',
		'Get the Obsidian app version',
		async () => {
			const { stdout } = await runCli(['version']);
			if (isCliError(stdout)) {
				return errorResult(stdout);
			}
			return textResult({ version: stdout });
		}
	);

	// -- Plugins ----------------------------------------------------------------

	server.tool(
		'obsidian_plugins',
		'List installed plugins with optional version info',
		{
			filter: z
				.enum(['core', 'community'])
				.optional()
				.describe('Filter by plugin type'),
			versions: z
				.boolean()
				.optional()
				.describe('Include version numbers'),
		},
		async ({ filter, versions }) => {
			const args = ['plugins', 'format=json'];
			if (filter) args.push(`filter=${filter}`);
			if (versions) args.push('versions');
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			const parsed = tryParseJson(stdout);
			return textResult(parsed ?? { output: stdout }, meta);
		}
	);

	server.tool(
		'obsidian_plugin_info',
		'Get detailed info about a specific plugin',
		{
			id: z.string().describe('Plugin ID'),
		},
		async ({ id }) => {
			const args = ['plugin', `id=${id}`];
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			const parsed = tryParseJson(stdout);
			return textResult(parsed ?? { output: stdout }, meta);
		}
	);

	server.tool(
		'obsidian_reload_plugin',
		'Reload a plugin (hot-reload for development)',
		{
			id: z.string().describe('Plugin ID to reload'),
		},
		async ({ id }) => {
			const args = ['plugin:reload', `id=${id}`];
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResult({ reloaded: id, output: stdout || 'ok' }, meta);
		}
	);

	// -- Commands ---------------------------------------------------------------

	server.tool(
		'obsidian_list_commands',
		'List available Obsidian commands',
		{
			filter: z
				.string()
				.optional()
				.describe('Filter commands by ID prefix'),
		},
		async ({ filter }) => {
			const args = ['commands'];
			if (filter) args.push(`filter=${filter}`);
			const { stdout } = await runCli(args);
			if (isCliError(stdout)) {
				return errorResult(stdout, {
					command: [CLI_BIN, ...args].join(' '),
				});
			}
			const commands = stdout
				.split('\n')
				.map((l) => l.trim())
				.filter(Boolean);
			return textResult({ commands, count: commands.length });
		}
	);

	server.tool(
		'obsidian_execute_command',
		'Execute an Obsidian command by ID',
		{
			id: z
				.string()
				.describe('Command ID to execute (e.g. "app:reload")'),
		},
		async ({ id }) => {
			const args = ['command', `id=${id}`];
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResult({ executed: id, output: stdout || 'ok' }, meta);
		}
	);

	// -- Diagnostics ------------------------------------------------------------

	server.tool(
		'obsidian_get_errors',
		'Get captured runtime errors from Obsidian',
		{
			clear: z
				.boolean()
				.optional()
				.describe('Clear the error buffer after reading'),
		},
		async ({ clear }) => {
			const args = ['dev:errors'];
			if (clear) args.push('clear');
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResultRaw(stdout, meta);
		}
	);

	server.tool(
		'obsidian_get_console',
		'Get captured console messages (requires dev:debug to be attached)',
		{
			limit: z
				.number()
				.optional()
				.describe('Max messages to return (default 50)'),
			level: z
				.enum(['log', 'warn', 'error', 'info', 'debug'])
				.optional()
				.describe('Filter by log level'),
			clear: z
				.boolean()
				.optional()
				.describe('Clear the console buffer after reading'),
		},
		async ({ limit, level, clear }) => {
			const args = ['dev:console'];
			if (limit !== undefined) args.push(`limit=${limit}`);
			if (level) args.push(`level=${level}`);
			if (clear) args.push('clear');

			try {
				const { stdout } = await runCli(args);
				const meta = { command: [CLI_BIN, ...args].join(' ') };
				if (isCliError(stdout)) {
					return errorResult(stdout, meta);
				}
				return textResultRaw(stdout, meta);
			} catch (e) {
				if (e.message.includes('Debugger not attached')) {
					return errorResult(
						'Debugger not attached. Use obsidian_debug_attach to start capturing console messages.',
						{ command: [CLI_BIN, ...args].join(' ') }
					);
				}
				throw e;
			}
		}
	);

	server.tool(
		'obsidian_debug_attach',
		'Attach the debugger to start capturing console messages',
		async () => {
			const args = ['dev:debug', 'on'];
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResult(
				{ attached: true, output: stdout || 'ok' },
				meta
			);
		}
	);

	server.tool(
		'obsidian_debug_detach',
		'Detach the debugger and stop capturing console messages',
		async () => {
			const args = ['dev:debug', 'off'];
			const { stdout } = await runCli(args);
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResult(
				{ attached: false, output: stdout || 'ok' },
				meta
			);
		}
	);

	// -- DOM & CSS inspection ---------------------------------------------------

	server.tool(
		'obsidian_query_dom',
		'Query DOM elements by CSS selector',
		{
			selector: z.string().describe('CSS selector to query'),
			total: z
				.boolean()
				.optional()
				.describe('Return only the element count'),
			text: z
				.boolean()
				.optional()
				.describe('Return text content instead of HTML'),
			inner: z
				.boolean()
				.optional()
				.describe('Return innerHTML instead of outerHTML'),
			all: z
				.boolean()
				.optional()
				.describe('Return all matches instead of first'),
			attr: z
				.string()
				.optional()
				.describe('Get a specific attribute value'),
			css: z
				.string()
				.optional()
				.describe('Get a specific CSS property value'),
		},
		async ({ selector, total, text, inner, all, attr, css }) => {
			const args = ['dev:dom', `selector=${selector}`];
			if (total) args.push('total');
			if (text) args.push('text');
			if (inner) args.push('inner');
			if (all) args.push('all');
			if (attr) args.push(`attr=${attr}`);
			if (css) args.push(`css=${css}`);
			const { stdout } = await runCli(args, { timeout: 10000 });
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResultRaw(stdout, meta);
		}
	);

	server.tool(
		'obsidian_get_css',
		'Inspect computed CSS rules for a selector',
		{
			selector: z.string().describe('CSS selector to inspect'),
			prop: z
				.string()
				.optional()
				.describe('Filter by CSS property name'),
		},
		async ({ selector, prop }) => {
			const args = ['dev:css', `selector=${selector}`];
			if (prop) args.push(`prop=${prop}`);
			const { stdout } = await runCli(args, { timeout: 10000 });
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResultRaw(stdout, meta);
		}
	);

	// -- Screenshots ------------------------------------------------------------

	server.tool(
		'obsidian_take_screenshot',
		'Take a screenshot of the Obsidian window',
		{
			path: z
				.string()
				.optional()
				.describe('Output file path (default: auto-generated)'),
		},
		async ({ path: filepath }) => {
			const args = ['dev:screenshot'];
			if (filepath) args.push(`path=${filepath}`);
			const { stdout } = await runCli(args, { timeout: 30000 });
			const meta = { command: [CLI_BIN, ...args].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			return textResult(
				{ output: stdout || 'screenshot saved' },
				meta
			);
		}
	);

	// -- Eval -------------------------------------------------------------------

	server.tool(
		'obsidian_eval',
		'Execute JavaScript in the Obsidian app context and return the result',
		{
			code: z.string().describe('JavaScript code to execute'),
		},
		async ({ code }) => {
			const args = ['eval', `code=${code}`];
			const { stdout } = await runCli(args, { timeout: 30000 });
			const meta = { command: [CLI_BIN, 'eval', 'code=...'].join(' ') };
			if (isCliError(stdout)) {
				return errorResult(stdout, meta);
			}
			// CLI returns "=> result", strip the prefix
			const result = stdout.startsWith('=>')
				? stdout.slice(2).trim()
				: stdout;
			// "=> Error: ..." is a runtime eval error, not a CLI error
			if (isCliError(result)) {
				return errorResult(result, meta);
			}
			const parsed = tryParseJson(result);
			return textResult({ result: parsed ?? result }, meta);
		}
	);
}

// ---------------------------------------------------------------------------
// Standalone mode
// ---------------------------------------------------------------------------

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
	const server = new McpServer({
		name: 'obsidian-cli',
		version: '0.1.0',
	});
	registerCliTools(server);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
