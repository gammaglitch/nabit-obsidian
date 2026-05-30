# Dev Bridge

The plugin can expose a small localhost HTTP bridge for long-running development and agent debugging sessions.

The bridge is disabled by default. Enable it only in a dev or test build.

## Environment Variables

- `VITE_OBSIDIAN_DEBUG_BRIDGE=1` enables the bridge.
- `VITE_OBSIDIAN_DEBUG_BRIDGE_HOST` sets the listen host. Defaults to `127.0.0.1`.
- `VITE_OBSIDIAN_DEBUG_BRIDGE_PORT` sets the listen port. Defaults to `27124`.
- `VITE_OBSIDIAN_DEBUG_BRIDGE_TOKEN` sets an optional bearer or `x-obsidian-bridge-token` auth token.

## API

`GET /health`

- Returns bridge status, method list, and whether auth is required.

`POST /call`

- Accepts JSON shaped like `{ "method": "ping", "params": {} }`.

Methods:

- `ping`
- `describe`
- `getPluginState`
- `openPluginView`
- `listFiles`
- `listFolders`
- `readVaultFile`
- `writeVaultFile`
- `createFile`
- `deleteFile`
- `appendToFile`
- `searchVault`
- `getFileMetadata`
- `getActiveFile`
- `getActiveViewInfo`
- `getRecentErrors`

## Local Dev

Add the bridge flags to your `.env` before rebuilding the plugin:

```bash
OBSIDIAN_PATH=/path/to/your/vault
VITE_OBSIDIAN_DEBUG_BRIDGE=1
VITE_OBSIDIAN_DEBUG_BRIDGE_HOST=127.0.0.1
VITE_OBSIDIAN_DEBUG_BRIDGE_PORT=27124
```

Then run:

```bash
pnpm dev
```

When Obsidian loads the rebuilt plugin, the bridge listens on `http://127.0.0.1:27124`.

## Docker Dev Harness

This repo also includes a long-running Docker harness for development:

```bash
OBSIDIAN_BINARY_PATH=/absolute/path/to/Obsidian.AppImage docker compose -f docker-compose.dev.yml up --build
```

That service:

- prepares the temporary vault under `.e2e/vault`
- builds the plugin with the bridge enabled
- launches Obsidian under Xvfb with `--no-sandbox` and `--remote-debugging-port=9222`
- dismisses the community-plugin trust dialog via CDP (`scripts/cdp-dismiss-trust.mjs`)
- exposes the bridge port to the host
- reports healthy once the bridge responds to `/health`

If you set `OBSIDIAN_DEBUG_BRIDGE_TOKEN`, send it with either:

- `Authorization: Bearer <token>`
- `x-obsidian-bridge-token: <token>`

## Example Calls

```bash
curl -s http://127.0.0.1:27124/health
```

```bash
curl -s \
  -X POST http://127.0.0.1:27124/call \
  -H 'content-type: application/json' \
  -d '{"method":"listFiles"}'
```

```bash
curl -s \
  -X POST http://127.0.0.1:27124/call \
  -H 'content-type: application/json' \
  -d '{"method":"appendToFile","params":{"path":"example.md","line":"from bridge"}}'
```

## MCP Integration

The recommended MCP entry point is now the unified server in `mcp/server.mjs`.

It assembles:

- CLI-backed tools when the official Obsidian CLI is available
- bridge-backed tools when this bridge is reachable

The old `mcp/bridge-server.mjs` still exists as a bridge-only entry point, but it is no longer the default recommendation.

### Configuration

The project includes an `.mcp.json` that Claude Code picks up automatically:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "env": {
        "OBSIDIAN_BRIDGE_URL": "http://127.0.0.1:27124"
      }
    }
  }
}
```

Environment variables:

- `OBSIDIAN_MCP_BACKEND` — `auto`, `cli`, or `bridge`. Defaults to `auto`.
- `OBSIDIAN_BRIDGE_URL` — bridge base URL. Defaults to `http://127.0.0.1:27124`.
- `OBSIDIAN_BRIDGE_TOKEN` — optional bearer token, passed as `Authorization: Bearer <token>`.

### Bridge-backed tools

When the bridge is available, the unified server can expose bridge-backed tools including:

| Tool | Description | Notes |
|---|---|---|
| `obsidian_get_plugin_state` | Vault name, active file, open views, recent errors | Bridge-only |
| `obsidian_get_active_file` | Currently active file | Bridge-only |
| `obsidian_get_active_view` | Active view type, title, file | Bridge-only |
| `obsidian_open_plugin_view` | Open/reveal plugin sidebar | Bridge-only |
| `obsidian_get_metadata` | Frontmatter, tags, size, timestamps | Bridge-only |
| `obsidian_write_file` | Overwrite an existing file | Bridge-only |
| `obsidian_list_files` | List all markdown files | Bridge-backed for now |
| `obsidian_list_folders` | List all folders | Bridge-backed for now |
| `obsidian_search` | Search by filename or content | Bridge-backed for now |
| `obsidian_read_file` | Read a vault file | Bridge-backed for now |
| `obsidian_create_file` | Create a new file | Bridge-backed for now |
| `obsidian_append_to_file` | Append a line | Bridge-backed for now |
| `obsidian_delete_file` | Move to trash | Bridge-backed for now |
| `obsidian_ping` | Check bridge connectivity | Fallback when CLI is absent |
| `obsidian_get_errors` | Recent uncaught errors | Fallback when CLI is absent |

### Usage

1. Start the bridge (local dev or Docker harness).
2. Open a Claude Code session in this repo — the unified MCP server starts automatically.
3. Call `obsidian_get_capabilities` to see whether the bridge, CLI, or both were registered.
4. Use the bridge-backed tools for plugin-specific state and the current vault/file tool set.

For the full unified workflow, backend modes, and CLI examples, see `docs/dev-cli.md`.
