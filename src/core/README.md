# Core services

This folder groups Node-side logic for the application. Each sub-folder has a clear responsibility so that the renderer stays focused on UI concerns.

- `compression/`: adapters for 7zip-bin, node-7z, archiver, and yauzl for listing/extracting archives.
- `cloud/`: Google Drive and Dropbox clients plus sync helpers.
- `analytics/`: metrics, charts, and reporting utilities.
- `automation/`: smart profile engine, triggers, and job scheduling.
- `plugins/`: folder-based plugin loader with manifest validation.
- `db/`: better-sqlite3 models and migrations.
- `workspace/`: chokidar-powered workspace manager and job queue plumbing.
- `jobs/`: shared job models and utilities for queued work.
- `smartProfiles/`: reusable smart profile rules and persistence helpers.
