# Boilerplate Structure

## Stack

- Preact for UI
- Jotai for state
- Tailwind for styling
- Vite for builds

## Core vs Example

### Boilerplate core

These files are generic and reusable across plugin ideas:

- `src/main.ts`
- `src/ViewWrapper.tsx`
- `src/obsidian/constants.ts`
- `src/obsidian/view.ts`
- `src/obsidian/events.ts`
- `src/obsidian/VaultSync.tsx`
- `src/store/atoms/files.tsx`

### Example feature (replace with your own)

- `src/components/ExampleView.tsx`
- `src/helpers/lines.ts`
- `src/helpers/files/util.ts` (the `appendToFile` function)

## Rules

- Keep direct `app.vault` and `app.workspace` access out of UI components.
- Put pure logic in `src/helpers/` with tests alongside.
- Update `src/obsidian/constants.ts` to change the view type, name, and icon.
