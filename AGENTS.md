This is an Obsidian plugin boilerplate using Preact, Jotai, and Tailwind.

When you make changes, try to match the existing code pattern.

Reference docs/ for architecture details. When implementing something that requires additional explanation, add a note to docs/log.md.

## Safe edit seams

- `src/helpers/` for pure logic (parsing, formatting, transforms)
- `src/helpers/files/util.ts` for vault read/write operations
- `src/store/atoms/files.tsx` for shared state
- `src/components/` for UI

## Plugin shell (modify with care)

- `src/main.ts` — plugin lifecycle
- `src/obsidian/` — view, event, and sync infrastructure
- `src/ViewWrapper.tsx` — app root mounting

## Checklist

- If helper logic changes, run `pnpm test`.
- If types change, run `pnpm build:ts`.
- If architecture changes non-obviously, add a note to `docs/log.md`.
