import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { ItemView, Plugin, TFile, TFolder } from 'obsidian';

import { appendToFile } from '../helpers/files/util';
import { PLUGIN_VIEW_TYPE } from './constants';
import { openOrRevealPluginView } from './view';

declare const require: NodeRequire | undefined;

const DEFAULT_BRIDGE_HOST = '127.0.0.1';
const DEFAULT_BRIDGE_PORT = 27124;
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_RECENT_ERRORS = 25;

type GlobalWithRequire = typeof globalThis & {
	require?: NodeRequire;
};

type TestBridgeConfig = {
	enabled: boolean;
	host: string;
	port: number;
	token: string | null;
};

type TestBridgeRequest = {
	method: string;
	params?: Record<string, unknown>;
};

type JsonResponse =
	| { ok: true; result: unknown }
	| { ok: false; error: { message: string } };

type BridgeMethod =
	| 'appendToFile'
	| 'createFile'
	| 'deleteFile'
	| 'describe'
	| 'getActiveFile'
	| 'getActiveViewInfo'
	| 'getFileMetadata'
	| 'getPluginState'
	| 'getRecentErrors'
	| 'listFiles'
	| 'listFolders'
	| 'openPluginView'
	| 'ping'
	| 'readVaultFile'
	| 'searchVault'
	| 'writeVaultFile';

const BRIDGE_METHODS: BridgeMethod[] = [
	'ping',
	'describe',
	'getPluginState',
	'openPluginView',
	'listFiles',
	'listFolders',
	'readVaultFile',
	'writeVaultFile',
	'createFile',
	'deleteFile',
	'appendToFile',
	'searchVault',
	'getFileMetadata',
	'getActiveFile',
	'getActiveViewInfo',
	'getRecentErrors',
];

function getBooleanEnv(value?: string): boolean {
	return value === '1' || value === 'true';
}

function getPortEnv(value?: string): number {
	if (!value) {
		return DEFAULT_BRIDGE_PORT;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
		throw new Error(`invalid bridge port: ${value}`);
	}

	return parsed;
}

function getTestBridgeConfig(): TestBridgeConfig {
	const token = import.meta.env.VITE_OBSIDIAN_DEBUG_BRIDGE_TOKEN?.trim();

	return {
		enabled: getBooleanEnv(import.meta.env.VITE_OBSIDIAN_DEBUG_BRIDGE),
		host:
			import.meta.env.VITE_OBSIDIAN_DEBUG_BRIDGE_HOST?.trim() ||
			DEFAULT_BRIDGE_HOST,
		port: getPortEnv(import.meta.env.VITE_OBSIDIAN_DEBUG_BRIDGE_PORT),
		token: token ? token : null,
	};
}

function getNodeRequire(): NodeRequire {
	const globalRequire = (globalThis as GlobalWithRequire).require;

	if (typeof globalRequire === 'function') {
		return globalRequire;
	}

	if (typeof require === 'function') {
		return require;
	}

	throw new Error('Node require is unavailable in this Obsidian runtime');
}

function getNodeHttp() {
	return getNodeRequire()('node:http') as typeof import('node:http');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRequiredString(
	params: Record<string, unknown> | undefined,
	key: string,
	options: { allowEmpty?: boolean } = {}
): string {
	const value = params?.[key];

	if (typeof value !== 'string') {
		throw new Error(`missing string parameter: ${key}`);
	}

	if (!options.allowEmpty && value.trim().length === 0) {
		throw new Error(`missing string parameter: ${key}`);
	}

	return value;
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	return String(error);
}

function normalizeToken(value: string | undefined): string | null {
	if (!value) {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function serializeFile(file: TFile | null) {
	if (!file) {
		return null;
	}

	return {
		name: file.name,
		path: file.path,
	};
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	let size = 0;

	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;

		if (size > MAX_REQUEST_BYTES) {
			throw new Error('request body exceeds 1 MiB limit');
		}

		chunks.push(buffer);
	}

	if (chunks.length === 0) {
		return {};
	}

	return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export class TestBridgeServer {
	private server: Server | null = null;
	private readonly recentErrors: string[] = [];
	private readonly onWindowError = (event: ErrorEvent) => {
		this.recordError(event.error ?? event.message);
	};
	private readonly onUnhandledRejection = (event: PromiseRejectionEvent) => {
		this.recordError(event.reason);
	};

	constructor(
		private readonly plugin: Plugin,
		private readonly config: TestBridgeConfig
	) {}

	async start(): Promise<void> {
		if (typeof window !== 'undefined') {
			window.addEventListener('error', this.onWindowError);
			window.addEventListener(
				'unhandledrejection',
				this.onUnhandledRejection
			);
			this.plugin.register(() => {
				window.removeEventListener('error', this.onWindowError);
				window.removeEventListener(
					'unhandledrejection',
					this.onUnhandledRejection
				);
			});
		}

		const http = getNodeHttp();
		const server = http.createServer((request, response) => {
			void this.handleRequest(request, response);
		});

		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error) => {
				server.off('listening', onListening);
				reject(error);
			};
			const onListening = () => {
				server.off('error', onError);
				resolve();
			};

			server.once('error', onError);
			server.once('listening', onListening);
			server.listen(this.config.port, this.config.host);
		});

		this.server = server;
		console.log(
			`[test-bridge] listening on http://${this.config.host}:${this.config.port}`
		);
		this.plugin.register(() => {
			void this.stop();
		});
	}

	async stop(): Promise<void> {
		if (!this.server) {
			return;
		}

		const server = this.server;
		this.server = null;

		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}

	private recordError(error: unknown): void {
		const message = toErrorMessage(error);

		if (!message) {
			return;
		}

		this.recentErrors.push(message);

		if (this.recentErrors.length > MAX_RECENT_ERRORS) {
			this.recentErrors.splice(
				0,
				this.recentErrors.length - MAX_RECENT_ERRORS
			);
		}
	}

	private isAuthorized(request: IncomingMessage): boolean {
		if (!this.config.token) {
			return true;
		}

		const bearerHeader = request.headers.authorization;
		const tokenHeader = request.headers['x-obsidian-bridge-token'];

		if (typeof bearerHeader === 'string') {
			const expected = `Bearer ${this.config.token}`;

			if (bearerHeader === expected) {
				return true;
			}
		}

		if (typeof tokenHeader === 'string') {
			return normalizeToken(tokenHeader) === this.config.token;
		}

		return false;
	}

	private writeJson(
		response: ServerResponse,
		statusCode: number,
		payload: JsonResponse
	): void {
		response.statusCode = statusCode;
		response.setHeader('access-control-allow-origin', '*');
		response.setHeader(
			'access-control-allow-headers',
			'content-type, authorization, x-obsidian-bridge-token'
		);
		response.setHeader(
			'access-control-allow-methods',
			'GET, POST, OPTIONS'
		);
		response.setHeader('content-type', 'application/json; charset=utf-8');
		response.end(JSON.stringify(payload, null, 2));
	}

	private writeOptions(response: ServerResponse): void {
		response.statusCode = 204;
		response.setHeader('access-control-allow-origin', '*');
		response.setHeader(
			'access-control-allow-headers',
			'content-type, authorization, x-obsidian-bridge-token'
		);
		response.setHeader(
			'access-control-allow-methods',
			'GET, POST, OPTIONS'
		);
		response.end();
	}

	private async handleRequest(
		request: IncomingMessage,
		response: ServerResponse
	): Promise<void> {
		try {
			const url = new URL(
				request.url ?? '/',
				`http://${request.headers.host ?? 'localhost'}`
			);

			if (request.method === 'OPTIONS') {
				this.writeOptions(response);
				return;
			}

			if (request.method === 'GET' && url.pathname === '/health') {
				this.writeJson(response, 200, {
					ok: true,
					result: {
						status: 'ok',
						methods: BRIDGE_METHODS,
						tokenRequired: this.config.token !== null,
					},
				});
				return;
			}

			if (!this.isAuthorized(request)) {
				this.writeJson(response, 401, {
					ok: false,
					error: { message: 'unauthorized' },
				});
				return;
			}

			if (request.method !== 'POST' || url.pathname !== '/call') {
				this.writeJson(response, 404, {
					ok: false,
					error: { message: 'not found' },
				});
				return;
			}

			const payload = await readJsonBody(request);

			if (!isRecord(payload) || typeof payload.method !== 'string') {
				throw new Error('request must include a string method');
			}

			const params = isRecord(payload.params) ? payload.params : undefined;
			const result = await this.dispatch({
				method: payload.method,
				params,
			});

			this.writeJson(response, 200, { ok: true, result });
		} catch (error) {
			this.recordError(error);
			this.writeJson(response, 400, {
				ok: false,
				error: { message: toErrorMessage(error) },
			});
		}
	}

	private async dispatch(request: TestBridgeRequest): Promise<unknown> {
		switch (request.method) {
			case 'appendToFile': {
				const path = getRequiredString(request.params, 'path');
				const line = getRequiredString(request.params, 'line');
				await appendToFile(this.plugin, path, line);
				return { path, appended: true };
			}

			case 'createFile': {
				const path = getRequiredString(request.params, 'path');
				const content = getRequiredString(request.params, 'content', {
					allowEmpty: true,
				});
				const file = await this.plugin.app.vault.create(path, content);
				return { path: file.path, created: true };
			}

			case 'deleteFile': {
				const path = getRequiredString(request.params, 'path');
				const file = this.getVaultFile(path);
				await this.plugin.app.vault.trash(file, true);
				return { path, deleted: true };
			}

			case 'describe':
				return {
					methods: BRIDGE_METHODS,
					tokenRequired: this.config.token !== null,
				};

			case 'getActiveFile':
				return {
					file: serializeFile(this.plugin.app.workspace.getActiveFile()),
				};

			case 'getActiveViewInfo': {
				const leaf = this.plugin.app.workspace.activeLeaf;
				const view = leaf?.view;
				const file =
					view && 'file' in view && view.file instanceof TFile
						? view.file
						: null;

				return {
					type: view?.getViewType() ?? null,
					title:
						view instanceof ItemView ? view.getDisplayText() : null,
					file: serializeFile(file),
				};
			}

			case 'getPluginState':
				return {
					activeFile: serializeFile(
						this.plugin.app.workspace.getActiveFile()
					),
					openPluginViews: this.plugin.app.workspace.getLeavesOfType(
						PLUGIN_VIEW_TYPE
					).length,
					recentErrors: [...this.recentErrors],
					vaultName: this.plugin.app.vault.getName(),
				};

			case 'getFileMetadata': {
				const path = getRequiredString(request.params, 'path');
				const file = this.getVaultFile(path);
				const cache =
					this.plugin.app.metadataCache.getFileCache(file);
				return {
					path: file.path,
					name: file.name,
					stat: {
						ctime: file.stat.ctime,
						mtime: file.stat.mtime,
						size: file.stat.size,
					},
					frontmatter: cache?.frontmatter ?? null,
					tags: cache?.tags?.map((t) => t.tag) ?? [],
				};
			}

			case 'getRecentErrors':
				return {
					errors: [...this.recentErrors],
				};

			case 'listFiles': {
				return {
					files: this.plugin.app.vault.getMarkdownFiles().map((file) => ({
						name: file.name,
						path: file.path,
					})),
				};
			}

			case 'listFolders': {
				const folders = this.plugin.app.vault
					.getAllLoadedFiles()
					.filter((f): f is TFolder => f instanceof TFolder)
					.map((f) => ({ path: f.path, name: f.name }));
				return { folders };
			}

			case 'openPluginView':
				await openOrRevealPluginView(this.plugin, { reveal: true });
				return { opened: true };

			case 'ping':
				return { status: 'ok' };

			case 'searchVault': {
				const query = getRequiredString(request.params, 'query');
				const lowerQuery = query.toLowerCase();
				const files = this.plugin.app.vault.getMarkdownFiles();
				const results: {
					path: string;
					name: string;
					match: 'filename' | 'content';
				}[] = [];

				for (const file of files) {
					if (file.path.toLowerCase().includes(lowerQuery)) {
						results.push({
							path: file.path,
							name: file.name,
							match: 'filename',
						});
						continue;
					}

					const content =
						await this.plugin.app.vault.cachedRead(file);
					if (content.toLowerCase().includes(lowerQuery)) {
						results.push({
							path: file.path,
							name: file.name,
							match: 'content',
						});
					}
				}

				return { query, results };
			}

			case 'readVaultFile': {
				const path = getRequiredString(request.params, 'path');
				const file = this.getVaultFile(path);
				const content = await this.plugin.app.vault.cachedRead(file);

				return {
					content,
					name: file.name,
					path: file.path,
				};
			}

			case 'writeVaultFile': {
				const path = getRequiredString(request.params, 'path');
				const content = getRequiredString(request.params, 'content', {
					allowEmpty: true,
				});
				const file = this.getVaultFile(path);
				await this.plugin.app.vault.modify(file, content);

				return {
					path: file.path,
					written: true,
				};
			}

			default:
				throw new Error(`unknown method: ${request.method}`);
		}
	}

	private getVaultFile(path: string): TFile {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			throw new Error(`vault file not found: ${path}`);
		}

		return file;
	}
}

export async function maybeStartTestBridge(
	plugin: Plugin
): Promise<TestBridgeServer | null> {
	const config = getTestBridgeConfig();

	if (!config.enabled) {
		return null;
	}

	const server = new TestBridgeServer(plugin, config);
	await server.start();
	return server;
}
