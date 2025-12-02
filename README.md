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

## Scripts
- `pnpm dev` – Run the Electron + Vite dev server.
- `pnpm lint` – Lint the project. (Currently surfaces the upstream @typescript-eslint notice about TypeScript 5.9.)

## Project layout
- `src/main` – Electron main process entrypoint and window creation.
- `src/preload` – Context-isolated bridge exposing a typed, minimal IPC surface.
- `src/renderer` – React UI with Zustand for state and TanStack Query for async data.
- `src/core` – Placeholder backend modules for compression, cloud, automation, analytics, plugins, DB, and workspace logic.

## Packaging
`electron-builder` is configured in `electron-builder.json5`. Adjust the app ID, icons, and targets before releasing installers.
