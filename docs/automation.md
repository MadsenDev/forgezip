# Automation guide

Automation stitches together smart profiles, watchers, and cloud connectors. Start with the scaffolding in `src/core/automation` and wire it into the renderer forms under the Automation tab.

## Building the engine
1. **Queueing** – Represent work with models in `src/core/jobs` and dispatch them from profile evaluations.
2. **Triggers** – Use chokidar in `src/core/workspace` to listen to folders for new or changed files.
3. **Execution** – Call the compression adapters in `src/core/compression` to build archives, then upload through `src/core/cloud`.
4. **Secrets** – Only persist credentials when the user enables "Remember secrets." Leverage `src/core/security/vault.ts` to encrypt tokens.

## Monitoring
- Send status updates to the renderer via the preload bridge so users can see task progress in the heartbeat panel.
- Emit analytics events to `src/core/analytics` for throughput and failure rates.

## Testing strategies
- Use Vitest to simulate filesystem events and assert queue behavior without writing to disk.
- Mock cloud connectors to guarantee deterministic results.
