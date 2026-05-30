# Official Obsidian CLI MCP Plan

Plan for evolving `obsikit` from a bridge-first LLM development stack into a backend-flexible tool layer that prefers the official Obsidian CLI.

## Summary

`obsikit` already has:

- a working plugin scaffold
- a Dockerized Obsidian harness
- an in-plugin HTTP bridge
- an MCP server that exposes bridge methods as `obsidian_*` tools

The next step is not to expand the custom bridge further by default. The next step is to add a second MCP backend that wraps the official `obsidian` CLI, then make the LLM-facing tool contract stable across both backends.

Target end state:

- the official `obsidian` CLI is the preferred implementation for overlapping plugin-development capabilities
- the current bridge remains available for capabilities the CLI does not expose cleanly and as fallback infrastructure
- one unified MCP server assembles tools from both capability sources
- skills and agents call a stable set of shared `obsidian_*` tools for overlapping capabilities
- backend-specific capabilities remain exposed explicitly instead of being hidden behind false parity

## Why this change makes sense

The official CLI now exposes most of the developer controls an LLM needs:

- plugin reload
- command listing and execution
- plugin enable/disable
- captured errors
- captured console logs
- DOM inspection
- CSS inspection
- screenshots
- JavaScript evaluation
- CDP passthrough

That covers most of the capability gaps previously motivating custom bridge expansion.

For `obsikit`, this creates a better architecture:

- official CLI for primary runtime control
- MCP as the LLM-facing interface
- bridge used where it still adds unique value
- unified capability assembly instead of winner-takes-all backend selection

## Non-goals

- Do not remove the bridge backend yet.
- Do not rewrite the plugin scaffold around the CLI.
- Do not force Docker or CI to depend on the CLI before verifying compatibility.
- Do not expose every CLI command through MCP in the first pass.
- Do not break the current `obsidian_*` tool names if avoidable.

## Current state

Current relevant files:

- `mcp/bridge-server.mjs`
- `src/obsidian/testBridge.ts`
- `docs/dev-bridge.md`

Current bridge-backed MCP tools:

- `obsidian_ping`
- `obsidian_get_plugin_state`
- `obsidian_list_files`
- `obsidian_list_folders`
- `obsidian_search`
- `obsidian_read_file`
- `obsidian_create_file`
- `obsidian_write_file`
- `obsidian_append_to_file`
- `obsidian_delete_file`
- `obsidian_get_metadata`
- `obsidian_get_active_file`
- `obsidian_get_active_view`
- `obsidian_open_plugin_view`
- `obsidian_get_errors`

Important current limitation:

- the tool surface is shaped by the bridge rather than by the stronger official CLI developer workflow

## Architecture direction

Adopt a two-layer design:

### Layer 1: capability providers

Independent capability sources:

- CLI backend
- bridge backend

Each provider is responsible for:

- validating required runtime availability
- executing the underlying action
- normalizing output into a shared result shape
- translating backend-specific failures into useful MCP errors

### Layer 2: shared MCP tool contract

One MCP surface for agents:

- stable tool names
- stable parameter schemas
- stable output shapes where practical

This keeps skill instructions and agent workflows capability-agnostic where overlap is real.

### Layer 3: backend-specific extensions

Not every capability should be forced into the shared contract.

Where one backend can do something the other cannot, expose it explicitly through backend-specific tools rather than weakening the model to the lowest common denominator.

Examples:

- CLI-only tools for capabilities tied to official developer commands
- bridge-only tools for plugin-internal or harness-specific state that the CLI cannot expose

### Layer 4: capability discovery

Agents need a way to know what is actually available at runtime.

Add a discovery tool early, for example:

- `obsidian_get_capabilities`

That tool should report:

- active backend
- available shared tools
- available backend-specific tools
- important environment facts such as CLI availability, bridge availability, and screenshot support

## Proposed file structure

Start flat. Extract shared modules only when the second backend actually needs them.

### Phase 1 structure

```text
mcp/
  bridge-server.mjs          # existing, untouched
  cli-server.mjs             # new CLI-backed MCP entry point (self-contained)
```

`cli-server.mjs` owns its own tool definitions, CLI execution, and output formatting inline. No shared abstractions yet — the goal is a working CLI backend, not a framework.

### Phase 2 structure (extract when real duplication appears)

```text
mcp/
  bridge-server.mjs          # existing
  cli-server.mjs             # CLI-backed entry point
  server.mjs                 # unified entry point, backend selected by env
  shared/
    tool-definitions.mjs     # common tool schemas extracted from real overlap
    normalize.mjs            # output helpers extracted from real patterns
  backends/
    cli.mjs                  # CLI adapter extracted from cli-server
    bridge.mjs               # bridge adapter extracted from bridge-server
```

Only create `shared/` and `backends/` after `cli-server.mjs` is working end-to-end and the actual shared surface is clear from experience, not guesswork.

Initial recommendation:

- implement `cli-server.mjs` as a flat, self-contained module first
- keep `bridge-server.mjs` working and untouched
- extract shared pieces and unify entry points only after the CLI backend stabilizes

## Capability assembly model

Preferred long-term behavior:

- start one unified MCP server
- probe which capability sources are available at startup
- register CLI-backed tools where the CLI is the preferred implementation
- register bridge-backed tools where the bridge provides unique value
- register bridge-backed fallback implementations for overlapping tools only when the CLI is unavailable

Suggested env contract:

- `OBSIDIAN_MCP_BACKEND=cli|bridge|auto`
- `OBSIDIAN_CLI_BIN=obsidian`
- `OBSIDIAN_BRIDGE_URL=...`
- `OBSIDIAN_BRIDGE_TOKEN=...`

Behavior:

- `auto`: assemble tools from all available capability sources
- `cli`: register only CLI-backed tools, fail fast if CLI is unavailable
- `bridge`: register only bridge-backed tools, fail fast if bridge is unavailable

Default recommendation:

- `auto` should become the normal mode once the unified server exists

Important clarification:

- this is no longer a pure "pick one backend" design
- it is a "register the best available implementation for each capability" design

Reference:

- see `docs/cli-vs-bridge-capability-matrix.md`

## First-pass MCP tool set

Do not mirror the entire CLI at first. Start with the operations that are most useful for LLM-driven plugin development and verification.

### Phase 1 tool set

- `obsidian_ping`
- `obsidian_version`
- `obsidian_plugins`
- `obsidian_plugin_info`
- `obsidian_reload_plugin`
- `obsidian_list_commands`
- `obsidian_execute_command`
- `obsidian_get_errors`
- `obsidian_get_console`
- `obsidian_query_dom`
- `obsidian_get_css`
- `obsidian_take_screenshot`
- `obsidian_eval`

### Optional Phase 1.5 tools

- `obsidian_enable_plugin`
- `obsidian_disable_plugin`
- `obsidian_list_tabs`
- `obsidian_workspace`
- `obsidian_reload_vault`
- `obsidian_restart_app`

### Why these first

They directly support the LLM development loop:

1. make code changes
2. reload plugin
3. inspect errors
4. verify command registration
5. inspect DOM or screenshot
6. run app-context checks with `eval`

## Mapping from logical tool to CLI command

Initial mapping proposal:

| MCP tool | CLI command |
|---|---|
| `obsidian_ping` | `obsidian version` or lightweight `vault info=name` check |
| `obsidian_version` | `obsidian version` |
| `obsidian_plugins` | `obsidian plugins format=json versions` |
| `obsidian_plugin_info` | `obsidian plugin id=<plugin-id>` |
| `obsidian_reload_plugin` | `obsidian plugin:reload id=<plugin-id>` |
| `obsidian_list_commands` | `obsidian commands` |
| `obsidian_execute_command` | `obsidian command id=<command-id>` |
| `obsidian_get_errors` | `obsidian dev:errors` |
| `obsidian_get_console` | `obsidian dev:console` |
| `obsidian_query_dom` | `obsidian dev:dom ...` |
| `obsidian_get_css` | `obsidian dev:css ...` |
| `obsidian_take_screenshot` | `obsidian dev:screenshot path=<file>` |
| `obsidian_eval` | `obsidian eval code=<javascript>` |

## Tool design principles

### Preserve stable names when possible

The current MCP naming scheme is good for agents:

- explicit `obsidian_*` namespace
- action-oriented verbs
- easy to discover

Reuse that pattern instead of leaking raw CLI command names into the shared tool contract.

### Normalize output aggressively

CLI output can be:

- plain text
- TSV
- CSV
- JSON

The MCP wrapper should normalize this so agents receive predictable text or JSON-like structures. Prefer JSON-capable CLI formats whenever available.

Examples:

- use `format=json` when the CLI supports it
- wrap non-JSON textual output in structured envelopes
- add metadata such as backend name and raw command for debugging

### Make backend-specific gaps explicit

Not every existing bridge tool has a perfect CLI equivalent.

Examples:

- `obsidian_open_plugin_view`
- `obsidian_get_plugin_state`
- some vault CRUD helpers currently offered by the bridge

These should be handled explicitly:

- keep them bridge-only for now
- or provide CLI-backed approximations if they are reliable
- or omit them from the shared surface until a stable abstraction exists
- or expose CLI-only and bridge-only variants when both are valuable but not actually equivalent

Do not fake parity where parity does not really exist.

### Do not collapse to the weakest common denominator

The goal is not to make every tool available everywhere.

The goal is:

- a shared core for real overlap
- explicit extensions for unique backend power
- capability reporting so agents can adapt cleanly

This protects the project from two bad outcomes:

- losing useful official CLI features because the bridge cannot match them
- hiding useful bridge or harness features because the CLI cannot match them

## Recommended implementation phases

## Phase 0: document the backend strategy — DONE

Deliverables:

- this plan
- updated `README.md`
- updated `docs/dev-bridge.md`

Status: plan written and refined. README and dev-bridge updates deferred to Phase 4.

## Phase 1: implement CLI backend — DONE

Deliverables:

- `mcp/cli-server.mjs` — flat, self-contained MCP server wrapping the official CLI

Implemented tools (15):

- `obsidian_ping` — probes `vault info=name` to confirm the app is running, not just that the CLI binary exists
- `obsidian_version` — `version`
- `obsidian_plugins` — `plugins format=json`
- `obsidian_plugin_info` — `plugin id=<id>`
- `obsidian_reload_plugin` — `plugin:reload id=<id>`
- `obsidian_list_commands` — `commands`
- `obsidian_execute_command` — `command id=<id>`
- `obsidian_get_errors` — `dev:errors`
- `obsidian_get_console` — `dev:console` (requires debugger attached)
- `obsidian_debug_attach` — `dev:debug on`
- `obsidian_debug_detach` — `dev:debug off`
- `obsidian_query_dom` — `dev:dom`
- `obsidian_get_css` — `dev:css`
- `obsidian_take_screenshot` — `dev:screenshot`
- `obsidian_eval` — `eval`

Design decisions made during implementation:

- started flat (no shared abstractions) per the refined plan
- added `debug_attach`/`debug_detach` because `dev:console` requires the debugger — without them agents hit a dead end
- response helpers handle arrays without corruption (`{ data: [...], _meta }` for arrays, spread for objects)
- `_meta` carries the raw CLI command for debugging, agents can ignore it
- errors use MCP native `isError` mechanism
- CLI server is NOT in `.mcp.json` by default — users opt in manually until unified capability assembly ships

What remains before this phase is fully validated:

- test all tools against a running Obsidian instance (reload, commands, errors, DOM, screenshot, eval)
- verify error paths (missing plugin, bad selector, eval syntax error)

## Phase 2: validate the CLI debug loop — DONE

All 15 tools validated against a running Obsidian instance (v1.12.7, vault: dev-vault).

Happy paths verified:

- `obsidian_ping` — returns version + vault name
- `obsidian_version` — returns version string
- `obsidian_plugins` — returns JSON array (community filter tested)
- `obsidian_plugin_info` — returns TSV plugin details (hot-reload tested)
- `obsidian_reload_plugin` — confirms reload (hot-reload tested)
- `obsidian_list_commands` — returns filtered command list (editor: prefix tested)
- `obsidian_execute_command` — executes command (app:show-debug-info tested)
- `obsidian_get_errors` — returns "No errors captured." when clean
- `obsidian_debug_attach` / `obsidian_debug_detach` — attach/detach confirmed
- `obsidian_get_console` — returns captured console messages when debugger attached
- `obsidian_query_dom` — returns element count (`.workspace` tested)
- `obsidian_get_css` — returns matched rules (body background-color tested)
- `obsidian_take_screenshot` — writes valid PNG (1570x649)
- `obsidian_eval` — executes JS, returns parsed result (app.vault.getName() tested)

Error paths verified (all return `isError: true`):

- missing plugin: `Plugin "x" not found. Use "plugins" to list available plugins.`
- bad command ID: `Command "x" not found. Use "commands" to list available command IDs.`
- eval syntax error: `Error: Unexpected identifier 'is'`
- bad CSS selector: `Error: Invalid selector: ... '###invalid' is not a valid selector.`

Issue found and fixed during validation: the CLI returns errors as stdout with exit code 0, using an `Error:` prefix. Added `isCliError()` detection so all tools now check for this pattern and return MCP-native `isError: true` responses instead of silently claiming success.

## Phase 3: compare CLI and bridge coverage

Deliverables:

- capability matrix in docs
- decision for each existing bridge tool:
  - shared
  - bridge-only
  - deprecated
- decision for each CLI-only tool:
  - shared later
  - CLI-only
  - unsupported in bridge mode

Tasks:

- compare current bridge tools against CLI parity
- identify bridge-only features still needed for Docker or CI
- identify CLI-only features worth exposing directly rather than abstracting
- decide whether `getPluginState` should remain a bridge-only convenience tool
- implement or document `obsidian_get_capabilities`
- evaluate streaming needs for `dev:console` and `eval` (see streaming note below)

Success criteria:

- capability ownership is intentional and documented
- it is clear which shared tools should prefer CLI and which tools remain bridge-only

Status:

- `docs/cli-vs-bridge-capability-matrix.md` now captures the current ownership model
- several vault/file tools remain bridge-backed in the current implementation even though the CLI has related commands; CLI-backed replacements are a future migration path, not a Phase 4 assumption

## Phase 4: add unified server and capability assembly — DONE

Deliverables:

- `mcp/server.mjs` — unified entry point
- `obsidian_get_capabilities` tool
- `.mcp.json` updated to use `server.mjs`

Implementation:

- refactored `cli-server.mjs` to export `registerCliTools(server)` and `probeCli()`; standalone mode preserved via `isMain` check
- `server.mjs` probes both backends at startup and assembles tools:
  - `auto` mode (default): register CLI tools + bridge-only tools from whichever sources are available
  - `cli` mode: CLI tools only, fail fast if unavailable
  - `bridge` mode: all bridge tools (including fallbacks for overlapping capabilities), fail fast if unavailable
- bridge-only tools: `get_plugin_state`, `get_active_file`, `get_active_view`, `open_plugin_view`, `get_metadata`, `write_file`
- bridge fallback tools (registered only when CLI is absent): `ping`, `list_files`, `list_folders`, `search`, `read_file`, `create_file`, `append_to_file`, `delete_file`, `get_errors`
- note: the vault/file fallback set above is a future migration target for CLI-backed replacements, not an area where CLI ownership is already implemented today
- startup logs to stderr describing backend availability and tool count
- `bridge-server.mjs` left untouched — bridge tool logic inlined in `server.mjs`

Tool counts by mode:

- auto (both up): 22 (15 CLI + 6 bridge-only + 1 capabilities)
- cli only: 16 (15 CLI + 1 capabilities)
- bridge only: 16 (6 bridge-only + 9 bridge fallback + 1 capabilities)

Important current limitation:

- in `auto` mode, several vault/file tools are still bridge-backed because CLI-backed implementations for those tools have not been built yet
- this is intentional for now and should be treated as a future migration area

Env contract: `OBSIDIAN_MCP_BACKEND=auto|cli|bridge`, `OBSIDIAN_CLI_BIN`, `OBSIDIAN_VAULT`, `OBSIDIAN_BRIDGE_URL`, `OBSIDIAN_BRIDGE_TOKEN`

## Phase 5: extract shared layer and harden — OPTIONAL / DEFERRED

This is now optional work, not a required next step.

Right now the codebase does not have enough harmful duplication to justify extracting a shared framework. Keep the current flat structure unless maintenance pain becomes real.

Deliverables:

- extracted `shared/` and `backends/` modules from working code
- automated tests where practical
- smoke-test scripts

Tasks:

- extract shared tool definitions from real overlap between `cli-server.mjs` and `bridge-server.mjs`
- extract backend adapters into `backends/cli.mjs` and `backends/bridge.mjs`
- unit test command-building and output normalization
- smoke test CLI-backed tool calls against a running Obsidian instance
- keep bridge backend smoke tests intact

Success criteria:

- shared modules reflect real duplication, not speculative abstraction
- regressions in tool output or capability assembly are caught early

Current decision:

- skip this phase for now unless duplication becomes painful
- prioritize docs, examples, and future CLI-backed tool migrations instead

## Implementation progress

1. ~~Build `cli-server.mjs` as a flat, self-contained module~~ — DONE (Phase 1)
2. ~~All Phase 1 tools implemented~~ — DONE (15 tools including debug_attach/detach)
3. ~~Smoke test server startup and basic tool calls~~ — DONE
4. ~~Validate all tools against running Obsidian~~ — DONE (Phase 2)
5. ~~Fix CLI error detection (`isCliError`)~~ — DONE (Phase 2)
6. ~~Compare CLI and bridge coverage, document the capability matrix~~ — DONE (Phase 3)
7. ~~Add unified server and capability assembly~~ — DONE (Phase 4)
8. Skip shared-layer extraction for now unless duplication becomes painful
9. ~~Update docs and examples~~ — DONE

## Output normalization plan

Keep output lightweight for the agent. Avoid custom envelopes that the LLM has to parse on every call.

### Success responses

Return the tool-specific payload directly as MCP content. Add a `_meta` field for debugging context when useful, but do not wrap every response in a status envelope:

```json
{
  "plugins": ["my-plugin", "other-plugin"],
  "_meta": { "backend": "cli", "command": "obsidian plugins format=json" }
}
```

Agents consume the top-level fields. `_meta` is optional and ignorable.

### Error responses

Use MCP's native `isError: true` mechanism. Include the failure details in the text content:

```json
{
  "message": "plugin reload failed",
  "exitCode": 1,
  "stderr": "Error: plugin not found",
  "_meta": { "backend": "cli", "command": "obsidian plugin:reload id=my-plugin" }
}
```

### Guidelines

- prefer `format=json` when the CLI supports it
- wrap non-JSON textual output in a simple `{ "output": "..." }` shape
- do not invent a custom `ok`/`error` envelope — MCP already has success and error semantics
- `_meta` is for debugging, not for agent logic

## Streaming considerations

Some CLI commands may produce long or ongoing output:

- `dev:console` — console log capture may be large or continuous
- `eval` — evaluated code may produce substantial output
- `dev:dom` — DOM trees can be large

For the initial implementation, treat all CLI calls as request/response with a reasonable timeout. Capture full stdout/stderr and return it as a single MCP response.

If this proves insufficient (e.g., agents need to tail console logs in real time), evaluate MCP streaming support or a polling pattern in a later phase. Do not over-engineer this upfront — the request/response model covers the plugin debug loop.

## Risks and open questions

## 1. CLI availability

Risk:

- the official CLI may not be installed or enabled in all development environments

Mitigation:

- keep bridge backend
- detect CLI availability at startup
- document setup clearly

## 2. Output instability

Risk:

- human-readable CLI output may change between versions

Mitigation:

- prefer JSON output where supported
- centralize parsers
- capture Obsidian version in diagnostics

## 3. Docker and CI compatibility

Risk:

- the CLI may be harder to use in the current containerized harness than the bridge

Mitigation:

- treat bridge as the CI and harness fallback until proven otherwise
- avoid coupling all tests to CLI-first assumptions too early

## 4. Feature mismatch with current bridge tools

Risk:

- some bridge tools have no clean CLI equivalent

Mitigation:

- document bridge-only tools explicitly
- only expose shared abstractions where parity is real

## 4b. Feature mismatch in the other direction

Risk:

- some official CLI capabilities may never have a meaningful bridge equivalent

Mitigation:

- keep those tools CLI-specific
- avoid weakening the shared interface to match the bridge
- rely on capability discovery so agents can branch when needed

## 5. MCP surface bloat

Risk:

- wrapping every CLI command leads to an oversized tool surface that is hard for agents to choose from

Mitigation:

- start with plugin-development-critical tools only
- add vault authoring tools only if they are needed for the actual workflow

## Documentation updates needed

After implementation starts, update:

- `README.md`
- `docs/dev-bridge.md`
- add a new CLI-focused doc, likely `docs/dev-cli.md`

`docs/dev-cli.md` should cover:

- CLI prerequisites
- enabling the CLI in Obsidian
- running the CLI-backed MCP server
- selecting backend mode
- troubleshooting common CLI failures

## Recommended final positioning for obsikit

Once this lands, `obsikit` should be presented as:

- an Obsidian plugin boilerplate
- with LLM-friendly tooling
- that prefers the official Obsidian CLI for local development
- and includes a custom bridge fallback for controlled or containerized environments

That is a stronger story than presenting the custom bridge as the primary innovation.

## Immediate next task

The first concrete implementation task should be:

- extract the current MCP tool definitions from `mcp/bridge-server.mjs` into shared modules, then implement a minimal `mcp/cli-server.mjs` with:
  - `obsidian_version`
  - `obsidian_reload_plugin`
  - `obsidian_list_commands`
  - `obsidian_execute_command`
  - `obsidian_get_errors`
  - `obsidian_eval`

That is enough to prove the architecture before tackling screenshots, DOM inspection, and backend auto-selection.
