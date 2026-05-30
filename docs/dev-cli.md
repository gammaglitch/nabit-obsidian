# Unified MCP And CLI Dev Workflow

`obsikit` now exposes a unified MCP server at `mcp/server.mjs`.

This server assembles tools from two capability sources:

- the official Obsidian CLI
- the local `obsikit` dev bridge

The goal is:

- use the official CLI where it is clearly the better source
- keep bridge-backed tools where the CLI does not yet expose the needed behavior cleanly
- give agents one MCP server with the best available tool set for the current environment

## Current backend split

Today the unified server generally works like this:

- CLI-backed tools:
  - plugin reload
  - commands
  - errors
  - console
  - DOM/CSS
  - screenshots
  - eval
- bridge-backed tools:
  - plugin state
  - active file/view
  - open plugin view
  - metadata
  - overwrite file
  - current vault/file CRUD and search helpers

Some vault/file operations are future migration candidates for CLI-backed implementations, but they remain bridge-backed for now.

## Unified server

Default MCP entry point:

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

The checked-in `.mcp.json` already points here.

## Environment variables

- `OBSIDIAN_MCP_BACKEND=auto|cli|bridge`
- `OBSIDIAN_CLI_BIN=obsidian`
- `OBSIDIAN_VAULT=<vault-name>`
- `OBSIDIAN_BRIDGE_URL=http://127.0.0.1:27124`
- `OBSIDIAN_BRIDGE_TOKEN=<token>`

## Modes

### `auto` (default)

Probes both capability sources at startup:

- if CLI is available, registers CLI-backed tools
- if bridge is available, registers bridge-backed tools
- if both are available, registers both capability groups

This is the recommended mode for normal development.

### `cli`

Registers only CLI-backed tools and fails fast if the CLI is unavailable.

Use this when:

- you want to test the official-CLI-only path
- you are developing or debugging CLI-backed tools specifically

### `bridge`

Registers only bridge-backed tools and fails fast if the bridge is unavailable.

Use this when:

- you are developing or debugging the bridge path
- you are working in a bridge-only environment

## Running the server manually

Auto mode:

```bash
node mcp/server.mjs
```

Force CLI mode:

```bash
OBSIDIAN_MCP_BACKEND=cli node mcp/server.mjs
```

Force bridge mode:

```bash
OBSIDIAN_MCP_BACKEND=bridge \
OBSIDIAN_BRIDGE_URL=http://127.0.0.1:27124 \
node mcp/server.mjs
```

Force a named vault through the CLI:

```bash
OBSIDIAN_MCP_BACKEND=cli \
OBSIDIAN_VAULT=dev-vault \
node mcp/server.mjs
```

## Capability discovery

The unified server exposes:

- `obsidian_get_capabilities`

Use it to inspect:

- whether CLI is available
- whether bridge is available
- which tool groups were registered
- which vault the CLI probe found

## Example development flows

### Local development with both CLI and bridge available

1. Start Obsidian against your dev vault.
2. Build the plugin in watch mode with `pnpm dev`.
3. Enable the bridge if you want bridge-backed plugin-state and vault/file tools.
4. Open a Claude Code session in the repo.
5. Call `obsidian_get_capabilities`.
6. Use:
   - CLI-backed tools for reload, commands, errors, DOM, screenshots, and eval
   - bridge-backed tools for plugin-state and current vault/file operations

### Bridge-enabled local plugin session

Add the bridge flags to `.env`:

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

When Obsidian loads the rebuilt plugin, the unified MCP server can pick up the bridge-backed tools automatically in `auto` mode.

### Docker dev harness

```bash
OBSIDIAN_BINARY_PATH=/absolute/path/to/Obsidian.AppImage \
docker compose -f docker-compose.dev.yml up --build
```

That harness exposes the bridge. Depending on whether the official CLI is also usable in the environment, the unified server will register:

- bridge-only tools
- current bridge-backed vault/file tools
- and CLI tools only if the CLI probe succeeds

## Current limitations

- vault/file tools are still bridge-backed in the unified server
- bridge and CLI do not have full parity and are not treated as interchangeable
- `bridge-server.mjs` and `cli-server.mjs` still exist as direct entry points, but `server.mjs` is now the recommended one

## Related docs

- `docs/dev-bridge.md`
- `docs/cli-vs-bridge-capability-matrix.md`
- `docs/cli-mcp-plan.md`
