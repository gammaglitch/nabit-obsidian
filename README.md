An opinionated Obsidian plugin boilerplate with built-in LLM support.

The default stack is:

- Preact for UI
- Jotai for state
- Tailwind for styling
- Obsidian's vault and metadata cache APIs for file access

## Setup

Install dependencies:

```bash
pnpm install
```

Set `OBSIDIAN_PATH` in a `.env` file to point to your dev vault:

```
OBSIDIAN_PATH=/path/to/your/vault
```

Run the plugin build in watch mode:

```bash
pnpm dev
```

Run the full build:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

## E2E

A Dockerized Obsidian e2e harness is included. See `docs/e2e.md` for setup and usage.

## MCP Tooling

`obsikit` now ships with a unified MCP server at `mcp/server.mjs`.

It assembles tools from:

- the official Obsidian CLI for developer-control and verification features
- the custom bridge for plugin-specific state and current vault/file operations

See:

- `docs/dev-cli.md` for unified MCP usage, backend modes, and examples
- `docs/dev-bridge.md` for the bridge API and bridge-specific setup details

## Dev Bridge

For long-running development and agent-debug sessions, the plugin can expose a localhost HTTP bridge. See `docs/dev-bridge.md` for the bridge API, env flags, and the persistent Docker harness.

## Architecture

The reusable plugin shell lives in a small set of generic files:

1. `src/main.ts` registers the custom view and mounts the Preact app.
2. `src/obsidian/constants.ts` holds view identifiers and display metadata.
3. `src/obsidian/view.ts` opens or reveals the plugin view in the workspace.
4. `src/obsidian/events.ts` registers vault and metadata cache listeners.
5. `src/obsidian/VaultSync.tsx` bridges vault events into Jotai state.
6. `src/store/atoms/files.tsx` stores the plugin reference and file data.

## Example Feature

The boilerplate ships with a minimal example that demonstrates the full data flow:

**Read:** `src/store/atoms/files.tsx` loads all markdown files from the vault on startup.

**Display:** `src/components/ExampleView.tsx` lists files in a sidebar and shows the selected file's contents.

**Write:** Typing into the input and pressing Append calls `appendToFile` in `src/helpers/files/util.ts`, which appends a line to the selected file via `vault.modify()`.

**Test:** `src/helpers/lines.ts` contains the pure append/parse logic with unit tests in `src/helpers/lines.test.ts`.

To build your own plugin, replace `ExampleView` with your feature and add helpers under `src/helpers/`.

## LLM Working Notes

This repo is designed for LLM-assisted development. See `CLAUDE.md` / `AGENTS.md` for safe edit seams and conventions.
