0. Tech & Architecture (Pre-decided)

You don’t need to choose; just implement:

Package manager: pnpm

App: Electron desktop app with single repo

Build: electron-vite (Electron + Vite + React + TS)

UI stack:

React + TypeScript

Tailwind CSS 3.4.14 (pinned)

Framer Motion

React Icons


State:

Zustand for UI/global state

TanStack Query for async data (jobs, archives, automation)


Compression backend:

7zip-bin + node-7z → multi-format (7z, zip, rar-read, etc.)

archiver → create zip/tar

yauzl → read/list zip archives


FS watching: chokidar

Local DB: better-sqlite3

Cloud (v1): Google Drive + Dropbox

Charts: recharts

Packaging: electron-builder

Plugins: local folder-based plugins with plugin.json manifest + Node module entry.



---

1. Bootstrap the Repo

[ ] Install pnpm globally if needed.

[ ] Create Electron + React + TS + Vite base:

[ ] Run:
pnpm create electron-vite@latest compression-forge --template react-ts


[ ] cd compression-forge

[ ] Initialize git repo; add .gitignore.


Install UI deps (with Tailwind pinned to v3.4.x):

[ ] pnpm add zustand @tanstack/react-query framer-motion react-icons recharts

[ ] pnpm add -D tailwindcss@3.4.14 postcss autoprefixer


Tailwind setup (ensure it stays on 3.4.14, do not upgrade to 4.x):

[ ] Run: npx tailwindcss@3.4.14 init -p

[ ] Configure tailwind.config.cjs (or .js) to scan:

[ ] ./src/renderer/src/**/*.{js,ts,jsx,tsx,html}


[ ] In src/renderer/src/index.css (or equivalent), add:

@tailwind base;
@tailwind components;
@tailwind utilities;

[ ] Optionally set up path aliases in tsconfig.* (e.g. @/components, @/core).



---

2. Project Structure & Separation

[ ] Ensure standard electron-vite structure:

[ ] src/main → Electron main process

[ ] src/preload → preload + contextBridge

[ ] src/renderer → React UI


[ ] Create backend “core” folder for Node logic:

[ ] src/core/compression/

[ ] src/core/cloud/

[ ] src/core/analytics/

[ ] src/core/automation/

[ ] src/core/plugins/

[ ] src/core/db/

[ ] src/core/workspace/

[ ] src/core/jobs/

[ ] src/core/smartProfiles/




---

3. IPC & Context Bridge API

[ ] In src/preload/api.ts, define TypeScript interfaces:

[ ] ArchiveJob

[ ] ArchiveEntry

[ ] CompressionOptions

[ ] AutomationRule

[ ] WorkspaceState

[ ] ArchiveAnalytics


[ ] In src/preload/index.ts (or similar):

[ ] Use contextBridge.exposeInMainWorld('api', { ... }) to expose:

[ ] Archive:

listArchive(path)

extractArchive({ archivePath, destination, options })

createArchive({ files, options })

testArchive(path)


[ ] Smart Profiles:

getSmartProfiles()

createSmartProfile(profile)

updateSmartProfile(profile)


[ ] Workspace (Archive-as-project):

openWorkspace(archivePath)

getWorkspaceState(workspaceId)

commitWorkspaceChanges(workspaceId)

discardWorkspaceChanges(workspaceId)


[ ] Cloud:

connectGoogleDrive()

connectDropbox()

listCloudLocations(provider)

uploadArchive(jobId, provider, targetPath)

getCloudShareLink(provider, fileId)


[ ] Automation:

listAutomationRules()

createAutomationRule(rule)

updateAutomationRule(rule)

deleteAutomationRule(id)


[ ] Analytics:

getArchiveAnalytics(archivePath)


[ ] Plugins:

listPlugins()

enablePlugin(id)

disablePlugin(id)


[ ] Jobs:

listJobs()

cancelJob(jobId)

Event subscription: onJobUpdated(callback)




[ ] In src/main/ipc.ts:

[ ] Register IPC handlers for each method and hook them to core services.




---

4. Core Compression Engine (Node)

Install libraries:

[ ] pnpm add 7zip-bin node-7z archiver yauzl file-type chokidar better-sqlite3


Implement services:

[ ] src/core/compression/7zService.ts

[ ] Resolve 7z executable using 7zip-bin.

[ ] Wrap node-7z for:

listArchive(path)

extractArchive(path, destination, options)

createArchive({ files, format, destination, options })

testArchive(path)


[ ] Parse stdout to emit progress events.


[ ] src/core/compression/zipService.ts

[ ] Use archiver to create zip/tar.

[ ] Use yauzl to list contents.


[ ] src/core/compression/fsUtils.ts

[ ] Helpers:

Recursive directory listing

File metadata (size, mtime, extension)

Optional hashing (crypto).



[ ] src/core/compression/engine.ts

[ ] High-level functions:

listArchive(path)

extractArchive(args)

createArchive(args)

testArchive(path)


[ ] Decide whether to use 7z or zip-specific code based on extension/format.

[ ] Integrate with JobManager (below).




---

5. Job Manager & SQLite Persistence

[ ] src/core/db/database.ts

[ ] Initialize better-sqlite3 DB in app.getPath('userData').

[ ] Create tables:

jobs

recent_archives

automation_rules

smart_profiles

plugins

archive_analytics

automation_runs



[ ] src/core/jobs/jobManager.ts

[ ] Manage:

createJob(type, payload)

updateJobStatus(id, status, progress, error?)

getJobs()

cancelJob(id) (terminate associated process)


[ ] Use EventEmitter for job updates.

[ ] On job update:

Persist in DB.

Send IPC event job-updated to renderer.





---

6. Smart Compression Profiles

[ ] src/core/smartProfiles/types.ts

[ ] Define SmartProfile, SmartProfileRule.


[ ] src/core/smartProfiles/engine.ts

[ ] Use file-type and extensions to classify.

[ ] Rules:

Media (.jpg, .png, .mp4, .mkv, .mp3) → store only / low compression.

Text/code/logs → 7z LZMA2 ultra.

Mixed sets → 7z normal.



[ ] Hardcode built-in profiles:

[ ] “Code Project”

[ ] “Media Backup”

[ ] “General Sharing”


[ ] Store custom profiles in DB table smart_profiles.

[ ] Integrate with createArchive():

[ ] When options.profileId present, compute strategy and map to final format/level.




---

7. Archive-as-Project (Workspace)

[ ] src/core/workspace/workspaceManager.ts

[ ] openWorkspace(archivePath):

Create temp dir under userData/workspaces/<uuid>.

Extract archive to temp dir (internal flag).

Create workspace record (id, archivePath, tempPath).


[ ] getWorkspaceState(id):

Compare temp dir contents against original index (stored at open).

Mark added/modified/deleted files.


[ ] commitWorkspaceChanges(id):

Rebuild archive from temp dir (full rebuild initial implementation).


[ ] discardWorkspaceChanges(id):

Delete temp dir, remove workspace record.



[ ] Use chokidar to watch temp dirs and mark workspace as “dirty” on change.



---

8. Cloud Integration (Google Drive & Dropbox)

Install:

[ ] pnpm add googleapis @dropbox/dropbox-sdk


Implement:

[ ] src/core/cloud/googleDrive.ts

[ ] OAuth2 flow using external system browser.

[ ] Save tokens (encrypted) in DB/config.

[ ] Methods:

listFolders()

uploadFile(localPath, remoteFolderId)

getShareLink(fileId)



[ ] src/core/cloud/dropbox.ts

[ ] Similar methods using Dropbox SDK.


[ ] Integrate with JobManager:

[ ] Upload after compression as separate “upload” job.


[ ] Wire to IPC methods: connectGoogleDrive, connectDropbox, listCloudLocations, uploadArchive, getCloudShareLink.



---

9. Automation Rules Engine

[ ] Install cron lib:

[ ] pnpm add node-cron


[ ] src/core/automation/types.ts

[ ] Define triggers (timeSchedule, folderWatch, usbInsert?) and actions (compressFolder, compressAndUpload, rotateBackups).


[ ] src/core/automation/ruleEngine.ts

[ ] Load enabled rules from DB.

[ ] Use node-cron for schedule-based triggers.

[ ] Use chokidar for folder watchers.

[ ] On trigger:

Create compression job with selected smart profile.

Optionally create follow-up upload job.


[ ] Log runs into automation_runs table.


[ ] Expose CRUD via IPC: listAutomationRules, createAutomationRule, updateAutomationRule, deleteAutomationRule.



---

10. Archive Analytics

[ ] src/core/analytics/analyticsService.ts

[ ] During archive creation:

Capture per-file original and compressed sizes.

Time spent on compression.


[ ] Compute:

Total compression ratio.

Ratio per file extension.

Worst-compressing files.


[ ] Persist per-archive analytics in archive_analytics table.

[ ] Implement getArchiveAnalytics(archivePath) for IPC.

[ ] Simple suggestion heuristics:

Many PNGs → suggest WebP.

Media not compressing → suggest store-only.





---

11. Plugin System

[ ] src/core/plugins/pluginManifest.ts

[ ] Define PluginManifest interface (id, name, version, type, entry, etc.).


[ ] src/core/plugins/pluginLoader.ts

[ ] Load plugin.json files from userData/plugins/**.

[ ] Validate manifest.

[ ] Dynamic import entry file.

[ ] Register plugin capabilities in registries:

previewerRegistry

actionRegistry

cloudProviderRegistry



[ ] src/core/plugins/sdk.ts

[ ] Define TypeScript APIs for:

ArchivePreviewerPlugin

ActionPlugin

CloudProviderPlugin



[ ] Persist plugin states in plugins table.

[ ] Expose plugin management via IPC.

[ ] Implement 2 sample built-in plugins:

[ ] webp-optimizer (pre-process images).

[ ] dummy-virus-scan (mock scan hook).




---

12. OS Integration & CLI

[ ] pnpm add -D electron-builder

[ ] Configure electron-builder (package.json or electron-builder.yml):

[ ] appId, productName.

[ ] Icons per OS.

[ ] Targets: nsis (Windows), dmg (macOS), AppImage (Linux).

[ ] File associations: .zip, .7z, .rar (open-only), .tar, .gz.


[ ] CLI:

[ ] Create cli/cli.ts (compiled to JS) that can:

--create out.7z file1 file2

--extract archive.7z --to path


[ ] Use core engine directly (no UI).

[ ] Add bin entry in package.json.


[ ] Windows context menu:

[ ] Using electron-builder nsis config and/or custom script, register:

“Compress to {foldername}.7z” → calls CLI.

“Extract here” → calls CLI.



[ ] macOS & Linux:

[ ] Provide minimal integration scripts / .desktop entries (can be v1.x).




---

13. Renderer: Global Shell & State (Tailwind 3.4.14)

Ensure all React components use Tailwind CSS 3.4.14 utility classes.

[ ] Install Zustand / React Query if not already done:

[ ] pnpm add zustand @tanstack/react-query


[ ] Global state (src/renderer/src/store/appStore.ts):

[ ] Current view, selected archive, selected job, theme, etc.


[ ] React Query setup:

[ ] QueryClient provider at root.


[ ] Layout components:

[ ] AppShell:

Sidebar + topbar + main content.

Use Tailwind 3.4.14 classes (e.g., flex, h-screen, bg-slate-900, etc.).


[ ] Sidebar sections:

Home, Archives, Automation, Analytics, Plugins, Settings.


[ ] Topbar:

App title, quick actions (“New Archive”, “Open Archive”).





---

14. Renderer: Screens & Flows

14.1 Home / Dashboard

[ ] Show:

Recent archives list.

Recent jobs with status.

Cloud account connection badges.

Quick action cards.


[ ] Style with Tailwind 3.4.14:

Card layout (grid, gap-4, rounded-xl, shadow, etc).

Add subtle Framer Motion animations for cards.



14.2 Archive Browser View

[ ] File list:

Table or virtualized list of ArchiveEntrys.

Columns: name, path, size, compressed size, ratio, modified date.


[ ] Preview pane:

Registers previewers:

Text/code viewer.

Image (with zoom).

Audio/video players.

PDF (pdf.js).



[ ] Actions:

Buttons: extract selected, extract all, open workspace, view analytics.


[ ] Design:

Use Tailwind 3.4.14 for layout & theming.



14.3 New Archive Flow

[ ] Modal or dedicated page:

Drag & drop area (drops file paths via Electron).

Smart profile selector (dropdown).

Advanced settings:

Format, level, split size, password.

Destination: local or cloud target.



[ ] Use Framer Motion for modal transitions.

[ ] Use Tailwind 3.4.14 utilities for spacing, borders, etc.


14.4 Jobs Panel

[ ] Jobs drawer or page:

List all jobs with:

Progress bar.

Speed, ETA (if provided).

Type icon (compress, extract, upload, automation).


Actions: cancel, open log.


[ ] Subscribe to onJobUpdated from preload API.

[ ] Style with Tailwind 3.4.14.


14.5 Automation Rules UI

[ ] Rules list:

Table or cards with name, trigger summary, last/next run, enabled toggle.


[ ] Rule editor:

Multi-step form:

Choose trigger.

Configure schedule/folder/watch.

Choose compression profile.

Optional cloud upload.



[ ] Tailwind 3.4.14 for forms, toggles, layout.


14.6 Analytics UI

[ ] Per-archive analytics:

Big ratio headline.

Recharts bar chart for ratio per file type.

Table of worst-compressing files.

Suggestion list.


[ ] Tailwind 3.4.14 for layout and card styling.


14.7 Plugins UI

[ ] Show installed plugins with:

Name, version, type, enabled toggle.


[ ] Button to open plugins folder in OS file manager.

[ ] Indicate which plugins are active in current context (e.g., previewers).

[ ] Tailwind 3.4.14 for list layout and toggles.


14.8 Settings UI

[ ] Tabs:

General, Compression, Cloud, Automation, Privacy.


[ ] Bind form fields to config via IPC.

[ ] Allow export/import settings to JSON.

[ ] Tailwind 3.4.14 for tabbed layout and forms.



---

15. Security & Privacy

[ ] Ensure:

nodeIntegration: false in BrowserWindow.

contextIsolation: true.

Preload only exposes safe, typed APIs.


[ ] Password handling:

No logging of passwords.

No cloud sync of secrets by default.

Optional encrypted storage if “remember password” feature added.


[ ] EXIF stripping:

Add optional toggles & implement via EXIF-removal lib (e.g., exiftool wrapper).


[ ] “Privacy mode” toggle in settings:

Turns off telemetry/logging beyond essentials.




---

16. Testing & QA

[ ] Install test libs if needed (Vitest, etc.).

[ ] Unit tests:

Compression engine (create/extract/list).

Smart profile rules.

Automation triggers.

Analytics calculations.


[ ] E2E tests (Playwright/Cypress):

Create archive → extract → compare.

Automation rule that runs successfully.


[ ] Manual tests:

Very large archives (10k+ files).

Multi-GB archives.

Cloud upload and link retrieval.

Context menu integration on Windows.




---

17. Packaging, Auto-Update, Release

[ ] Finalize electron-builder config:

AppId, icons, targets.

File associations confirmed.


[ ] Auto-update:

Use GitHub Releases or simple update server.

Add “Check for updates” action to menu.


[ ] CI (GitHub Actions or similar):

On tag: build Windows/macOS/Linux installers.


[ ] Smoke test installers on real machines/VMs.



---

18. Docs & Onboarding

[ ] Create docs/:

Getting started.

Smart profiles guide.

Automation guide.

Plugin development guide.


[ ] In-app onboarding:

One-time tour: New Archive, Automation, Workspace, Cloud upload.


[ ] “What’s New” dialog for releases (reads from changelog).
