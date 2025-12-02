# Smart profiles guide

Smart profiles orchestrate how ForgeZip chooses formats, destinations, and automation cadence. The UI surfaces placeholders for these rules; wire them to the `src/core/automation` and `src/core/smartProfiles` folders as you implement real behavior.

## Designing a profile
A profile should contain:
- **Name and description** – human-readable context for the job.
- **Destination** – one of your configured cloud connectors (Google Drive, Dropbox) or local workspace paths.
- **Format and compression level** – e.g., solid 7z for dense assets or zip for compatibility.
- **Cadence** – nightly, hourly, or on-demand triggers.
- **Privacy options** – EXIF stripping and checksum generation flags.

## Persistence and scheduling
- Store profile definitions alongside jobs in `src/core/db` using better-sqlite3 models.
- Use chokidar watchers in `src/core/workspace` to trigger profile execution when files change.
- Route uploads through `src/core/cloud` to reuse credentials and upload helpers.

## Testing
Add unit tests under `src/core` to confirm profile evaluation logic. Vitest is preconfigured via `pnpm test` so you can stub file-system and cloud interactions without real network calls.
