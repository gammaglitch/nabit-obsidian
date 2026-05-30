# Obsidian CLI vs Bridge Capability Matrix

Current comparison of the official Obsidian CLI and the custom `obsikit` bridge/MCP surface.

Purpose:

- define which backend should own which capabilities
- identify where the bridge still adds value
- prevent duplicate tool design where the CLI is already sufficient

Status date: 2026-04-08

## Summary

Current conclusion:

- use the official Obsidian CLI as the default backend for plugin development and verification
- keep the custom bridge for capabilities the CLI does not currently expose cleanly
- keep the bridge as a fallback for controlled harness and CI environments

In short:

- CLI is stronger for developer-control operations
- bridge is still useful for plugin-specific state and convenience queries

## Classification

Legend:

- `CLI` = official Obsidian CLI is the preferred implementation
- `Bridge` = custom bridge is still needed or clearly better
- `Either` = both can plausibly serve the need
- `Mixed` = use CLI for the default shared tool, keep bridge as fallback or explicit extension

## Capability matrix

| Capability | CLI | Bridge | Preferred owner now | Notes |
|---|---|---|---|---|
| Check connectivity | Yes | Yes | Mixed | CLI can verify app/vault reachability; bridge has native ping. Shared tool can prefer CLI when available. |
| Get Obsidian version | Yes | Indirectly no | CLI | Official command exists. |
| List installed plugins | Yes | No | CLI | Official plugin inventory is better source of truth. |
| Get plugin info by ID | Yes | No | CLI | Official command exists. |
| Reload plugin | Yes | No clear equivalent today | CLI | `plugin:reload` is a major reason to prefer CLI. |
| List commands | Yes | No | CLI | Official source of command IDs. |
| Execute command | Yes | No | CLI | Official command execution should be preferred. |
| Get runtime errors | Yes | Yes | CLI | CLI is the better default for dev diagnostics; bridge can remain fallback. |
| Get console logs | Yes | No | CLI | Bridge captures uncaught errors only, not general console stream. |
| Attach/detach debugger | Yes | No | CLI | CLI-only developer capability. |
| Query DOM | Yes | No | CLI | CLI-only. |
| Inspect CSS | Yes | No | CLI | CLI-only. |
| Take screenshot | Yes | No | CLI | CLI-only in current setup. |
| Eval app-context JavaScript | Yes | No | CLI | CLI-only escape hatch. |
| List markdown files | Yes | Yes | Either | CLI has `files`; bridge has `listFiles`. Prefer CLI if shape is good enough, bridge if structured vault-specific output is better for agents. |
| List folders | Yes | Yes | Either | Same logic as files. |
| Read note/file content | Yes | Yes | Either | CLI has `read`; bridge has `readVaultFile`. |
| Create file | Yes | Yes | Either | CLI has `create`; bridge has `createFile`. |
| Write/overwrite file | Partial | Yes | Bridge | CLI has append/prepend/create/move/rename/property ops, but not the same direct overwrite primitive as current bridge. |
| Append to file | Yes | Yes | Either | CLI `append` overlaps strongly. |
| Delete file | Yes | Yes | Either | CLI `delete`; bridge `deleteFile`. |
| Search vault content | Yes | Yes | Either | CLI search is stronger than earlier assumptions. |
| Get file properties/frontmatter | Partial | Yes | Bridge | CLI has property-oriented commands, but not the same one-shot structured metadata payload. |
| Get tags/links/backlinks | Yes | No | CLI | CLI exposes these well. |
| Get active file | No clear direct command | Yes | Bridge | CLI defaults to active file but does not clearly expose “what is active” as a direct tool. |
| Get active view info | No clear direct command | Yes | Bridge | CLI has `workspace` and `tabs`, but not the same direct active-view query. |
| Open plugin custom view | No clear direct command | Yes | Bridge | `openPluginView` remains useful and currently unique. |
| Get plugin state bundle | No | Yes | Bridge | `getPluginState` is a high-value agent convenience endpoint. |
| Harness health endpoint | No | Yes | Bridge | Useful for Docker/dev-harness readiness checks. |

## What the CLI already made obsolete

These are no longer good reasons to expand the bridge:

- plugin reload
- command execution
- command discovery
- screenshots
- DOM inspection
- CSS inspection
- app-context evaluation
- console capture

If a new feature request falls into one of those areas, prefer the CLI backend.

## What the bridge still meaningfully adds

These are the highest-value remaining bridge capabilities:

- `getPluginState`
- `getActiveFile`
- `getActiveViewInfo`
- `openPluginView`
- `getFileMetadata`
- direct overwrite-style vault write helper
- harness-local health and reachability behavior

These are strong candidates for:

- bridge-only MCP tools
- fallback implementations where CLI is absent
- future reevaluation if the official CLI expands

## Recommended MCP ownership model

### Shared tools backed by CLI when available

Use CLI as default implementation for:

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

Potentially also:

- `obsidian_list_files`
- `obsidian_list_folders`
- `obsidian_read_file`
- `obsidian_create_file`
- `obsidian_append_to_file`
- `obsidian_delete_file`
- `obsidian_search`

Those should only move to CLI-backed shared tools if the output shape is good enough for agents and the semantics match what current bridge consumers expect.

Current implementation note:

- these tools should remain bridge-backed in the unified server until CLI-backed versions are actually implemented and validated
- theoretical CLI overlap is not enough to suppress the current bridge implementations in `auto` mode

### Bridge-only tools

Keep these as bridge-only for now:

- `obsidian_get_plugin_state`
- `obsidian_get_active_file`
- `obsidian_get_active_view`
- `obsidian_open_plugin_view`
- `obsidian_get_metadata`
- `obsidian_write_file`

## Design implications

This comparison argues against a winner-takes-all backend selector.

Instead, the unified MCP server should:

1. Register CLI-backed tools for capabilities where CLI is preferred.
2. Register bridge-backed tools for capabilities that remain unique to the bridge.
3. Optionally register bridge-backed fallback implementations for overlapping tools when CLI is unavailable.
4. Expose `obsidian_get_capabilities` so agents can understand:
   - whether CLI is available
   - whether bridge is available
   - which shared tools are active
   - which bridge-only tools are present

## Immediate implementation guidance

Near-term guidance for `obsikit`:

- do not add more bridge features in areas already covered by the CLI
- do not force duplicate MCP tools where CLI is clearly the better source
- do preserve bridge-only tools that expose plugin-specific runtime context
- do move toward one unified MCP server that assembles capabilities from both sources

## Future migration note

Several vault/file tools are candidates for future migration from bridge-backed implementations to CLI-backed implementations, but that migration is not complete just because the CLI has related commands.

Candidate migration set:

- `obsidian_list_files`
- `obsidian_list_folders`
- `obsidian_search`
- `obsidian_read_file`
- `obsidian_create_file`
- `obsidian_append_to_file`
- `obsidian_delete_file`

Migration rule:

- only switch a tool from bridge-backed to CLI-backed after a real implementation exists, output normalization is in place, and the CLI behavior has been validated against the current bridge-facing contract

Until then:

- keep these tools bridge-backed in the unified server
- treat CLI support for them as a future migration consideration, not current ownership

## Open questions to re-evaluate later

- Does the official CLI grow direct active-file and active-view queries?
- Does the official CLI gain a direct way to open plugin custom views?
- Is CLI file output structured enough to replace bridge vault tools cleanly?
- In Docker and CI, is the CLI reliable enough to replace bridge-backed verification for most flows?

## Sources

- Local bridge implementation: `src/obsidian/testBridge.ts`
- Local bridge MCP: `mcp/bridge-server.mjs`
- Official Obsidian CLI command list captured on 2026-04-08
