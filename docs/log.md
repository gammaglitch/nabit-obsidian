# Log

## 2026-04-08

- Added `mcp/server.mjs`: unified MCP entry point that assembles tools from both the CLI and bridge backends based on availability at startup. Probes both, registers CLI-backed tools when CLI is available and bridge-only tools when the bridge is reachable. Fallback bridge tools registered for overlapping capabilities only when CLI is absent. `.mcp.json` now points here.
- Documented that several vault/file tools are still bridge-backed today even though the CLI has related commands; switching those tools to CLI-backed implementations is a future migration step that requires implementation and output validation first.
- Refactored `mcp/cli-server.mjs` to export `registerCliTools()` and `probeCli()` for use by the unified server. Standalone mode preserved.
- Added `mcp/cli-server.mjs`: a self-contained MCP server that wraps the official Obsidian CLI instead of the custom HTTP bridge. Exposes 15 tools covering the plugin development debug loop (reload, commands, errors, console, DOM, CSS, screenshots, eval).
- Validated all 15 CLI MCP tools against a running Obsidian instance (v1.12.7). Found that the CLI reports errors as stdout with exit code 0; added `isCliError()` detection so error responses use MCP-native `isError: true` instead of silently claiming success.
- Wrote `docs/cli-mcp-plan.md` defining the two-backend architecture: official CLI as preferred backend, bridge as fallback for Docker/CI. Plan follows a flat-first approach — shared abstractions deferred until real duplication between backends is visible.
- Added `docs/dev-cli.md` and updated `README.md` / `docs/dev-bridge.md` so the current unified MCP workflow, backend modes, and bridge-vs-CLI split are documented with concrete examples.

## 2026-04-05

- Added an MCP server (`mcp/bridge-server.mjs`) that wraps the bridge HTTP API so Claude Code can call vault operations as native tools. Configured in `.mcp.json`.
- Fixed Docker dev harness: replaced `--frozen-lockfile` with `--no-frozen-lockfile` for pnpm 10 compatibility, added `--no-sandbox` for headless Electron, and added `--remote-debugging-port=9222` for CDP access.

## 2026-03-21

- Added a test-bridge module that can expose a small localhost HTTP control surface from inside the plugin when `VITE_OBSIDIAN_DEBUG_BRIDGE=1`.
- Added a long-running Docker dev harness in `docker-compose.dev.yml` so Obsidian can stay up during interactive debug sessions while external tools connect through the bridge.
- Documented the bridge API, auth, and startup flow in `docs/dev-bridge.md`.

## 2026-03-07

- Added Dockerized Obsidian e2e scaffold with Playwright Electron support.
- Ported smoke test, vault fixture, and launch helpers from obsidian-ist.
- Added `data-testid` attributes to ExampleView for stable e2e selectors.

## 2026-02-08

- Replaced the task manager example with a minimal file browser + append-line demo.
- Stripped all task-specific helpers, components, atoms, hooks, and types.
- Simplified VaultSync to track files only (no task extraction).
- Slimmed tailwind.config.js to Obsidian theme colors only.
- Updated AGENTS.md, README, and boilerplate docs for the new structure.

## 2026-02-02

- Extracted generic Obsidian view and event helpers into `src/obsidian/` to separate the reusable plugin shell from the example feature.
- Replaced the old context-shaped event bootstrap with `VaultSync`, which makes the plugin lifecycle wiring explicit and avoids pretending there is shared context state when there is not.
- Added `docs/boilerplate.md` to define which files belong to the boilerplate core versus the current task-manager example.

## 2026-01-12

- Added a shared task serializer in `src/helpers/tasks/serialize.ts` so task markdown format has one canonical write path.
- Added round-trip tests for parser and serializer behavior to make future automated edits safer.
- Expanded repository documentation with an architecture map and explicit task-editing seams for LLM-assisted work.

## 2026-01-18

- Added `docs/task-format.md` with canonical task examples and edge cases for future automated edits.
- Moved completion and task-metadata rewrites onto parse/mutate/serialize helpers so task edits use the same formatting path.
- Cleaned up TypeScript config hygiene by moving `paths` into `compilerOptions`, enabling `skipLibCheck`, and adding local Jest global declarations to reduce verification noise.

## 2026-01-31

- Added a short task-change checklist to `AGENTS.md` covering docs, tests, type-checking, and implementation log updates.
- Renamed the file models from `FileType`/`Filey` to `ParsedFile`/`StoredFile` to make the parsed-vs-stored distinction explicit without changing behavior.
- Renamed the task models from `TaskType`/`Taskey` to `ParsedTask`/`StoredTask` and renamed the remaining `Taskey`-named helper methods for consistency.
