# E2E Harness

This repository includes a first-pass Dockerized Electron harness for running the plugin inside Obsidian.

## Goals

- Launch Obsidian against a temporary test vault.
- Build the plugin directly into that vault.
- Drive the renderer with Playwright's Electron support.
- Save screenshots, traces, and other artifacts when tests fail.

## Files

- `Dockerfile.e2e` builds the Linux runtime used for Dockerized e2e runs.
- `docker-compose.e2e.yml` mounts the repo and a local Obsidian binary into the container.
- `scripts/prepare-e2e-vault.mjs` resets and seeds a temporary vault under `.e2e/vault` by default.
- `scripts/build-e2e-plugin.mjs` builds the plugin into the prepared vault by setting `OBSIDIAN_PATH`.
- `tests/e2e/playwright.config.ts` configures Playwright artifact capture.
- `tests/e2e/helpers/obsidian.ts` launches the Electron app and waits for the plugin root.
- `tests/e2e/fixtures/vault/` contains the seeded vault content used by the smoke test.

## Environment Variables

- `OBSIDIAN_E2E_BINARY`: absolute path to the Obsidian desktop binary or AppImage.
- `E2E_VAULT_DIR`: temporary vault directory. Defaults to `.e2e/vault`.
- `PLAYWRIGHT_ARTIFACTS_DIR`: artifact output directory. Defaults to `.e2e/artifacts`.
- `PLAYWRIGHT_HTML_REPORT`: HTML report directory. Defaults to `.e2e/report`.

## Expected Flow

1. Prepare the temporary vault.
2. Build the plugin into `E2E_VAULT_DIR/.obsidian/plugins/<manifest.id>/`.
3. Launch Obsidian against that vault.
4. Wait for `data-testid="plugin-root"`.
5. Assert view rendering and inspect renderer errors.

## Local Run

After installing the Playwright dependency and providing an Obsidian binary:

```bash
pnpm e2e:prepare-vault
pnpm e2e:build
OBSIDIAN_E2E_BINARY=/path/to/Obsidian.AppImage pnpm e2e:smoke
```

## Docker Run

```bash
OBSIDIAN_BINARY_PATH=/absolute/path/to/Obsidian.AppImage docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e
```

## Notes

- The smoke test assumes the plugin opens its view on load.
- The launch helper currently passes the vault path as a positional argument to Obsidian. If a local Obsidian build needs different launch arguments, update `tests/e2e/helpers/obsidian.ts`.
- The Docker image includes the Linux runtime packages needed by the mounted Obsidian AppImage, including FUSE-, zlib-, and `xdg-utils`-related dependencies.
- Docker runs pre-extract the AppImage with `--appimage-extract` and point Playwright directly at the extracted `obsidian` binary. This avoids the `APPIMAGE_EXTRACT_AND_RUN` path, which interferes with Playwright's debugging-pipe file descriptors.
- Obsidian ships with the `EnableNodeCliInspectArguments` Electron fuse disabled. Playwright needs `--inspect` to connect, so the Docker harness flips this fuse with `@electron/fuses` after extraction.
- The launch helper adds `--no-sandbox`, `--disable-gpu`, and `--disable-dev-shm-usage` when `CI=1` for headless Docker compatibility.
- The Docker harness pre-registers the vault in `obsidian.json` so Obsidian opens it directly instead of showing the vault picker.
- On first open of a vault with community plugins, Obsidian shows a trust dialog. The launch helper dismisses it automatically.
- Add stable `data-testid` attributes to plugin UI elements before expanding beyond smoke coverage.
