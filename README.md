# ForgeZip

ForgeZip is an Electron desktop app scaffolded with React, TypeScript, Vite, and Tailwind CSS (pinned to 3.4.14). The project is structured with separate main, preload, and renderer processes plus a `src/core` space for Node-side services such as compression, cloud sync, analytics, automation, plugins, and local DB layers.

## Getting started
1. Install [pnpm](https://pnpm.io/installation) if you don't have it.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the app in development mode:
   ```bash
   pnpm dev
   ```
4. Run tests:
   ```bash
   pnpm test
   ```

## Scripts
- `pnpm dev` – Run the Electron + Vite dev server.
- `pnpm lint` – Lint the project. (Currently surfaces the upstream @typescript-eslint notice about TypeScript 5.9.)
- `pnpm test` – Execute Vitest unit tests for core utilities.

## Project layout
- `src/main` – Electron main process entrypoint and window creation.
- `src/preload` – Context-isolated bridge exposing a typed, minimal IPC surface.
- `src/renderer` – React UI with Zustand for state and TanStack Query for async data.
- `src/core` – Placeholder backend modules for compression, cloud, automation, analytics, plugins, DB, and workspace logic.

## Packaging & updates
`electron-builder` is configured in `electron-builder.json5` with macOS (dmg + zip), Windows (NSIS + portable), and Linux (AppImage + deb) targets plus file associations for archive formats. Auto-update is wired to GitHub Releases; trigger manual checks from the File → Check for updates menu item in the running app.

## Docs
Guides live under `/docs`:
- `getting-started.md` – local setup and build steps.
- `smart-profiles.md` – modeling automation profiles.
- `automation.md` – orchestrating watchers and jobs.
- `plugin-development.md` – manifest structure and loader expectations.
- `whats-new.md` – release highlights surfaced by the in-app feed.
