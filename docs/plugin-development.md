# Plugin development guide

ForgeZip supports local, folder-based plugins that expose archive formats, destinations, or automation hooks.

## Manifest
Each plugin folder must include a `plugin.json` manifest:
```json
{
  "name": "My ForgeZip Plugin",
  "version": "0.1.0",
  "entry": "index.js",
  "description": "Adds a fictional cloud target.",
  "scopes": ["automation", "cloud"]
}
```

## Entry module
The `entry` file should export a function that receives a registration API:
```ts
export function registerPlugin(api: ForgeZipPluginAPI) {
  api.registerDestination({
    id: 'acme-cloud',
    title: 'Acme Cloud',
    upload: async (filePath) => {
      // ...perform upload
    },
  })
}
```

## Loading strategy
Implement the loader in `src/core/plugins` to:
1. Discover plugin folders under a configurable workspace directory.
2. Validate the manifest fields and ensure required exports exist.
3. Sandboxed execution: avoid eval and keep IPC boundaries minimal.

## Testing plugins
Use Vitest to stub the plugin API and assert hooks are registered correctly. Provide sample fixtures under `src/core/plugins/__fixtures__` so plugin authors can quickly test without real cloud credentials.
