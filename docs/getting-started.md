# Getting started with ForgeZip

ForgeZip ships as an Electron + React starter focused on archive automation. Use the steps below to run the project locally and understand the separation between processes.

## Prerequisites
- [Node.js 18+](https://nodejs.org/) with `corepack` enabled.
- [pnpm](https://pnpm.io/) (run `corepack enable pnpm` if you do not have it).

## Install and run
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development app (Vite + Electron):
   ```bash
   pnpm dev
   ```
   Or run the explicit Electron alias:
   ```bash
   pnpm electron:dev
   ```
3. Lint and type-check:
   ```bash
   pnpm lint
   pnpm test
   ```

The renderer code lives in `src/renderer`, while the Electron main process is in `src/main` and the preload bridge in `src/preload`. Node-oriented services (compression, automation, analytics, cloud) reside in `src/core`.

## Building installers
Run the production build and package installers with:
```bash
pnpm build
```
Artifacts are emitted under `release/<version>` for macOS (dmg + zip), Windows (NSIS + portable), and Linux (AppImage + deb) using the configuration in `electron-builder.json5`.
