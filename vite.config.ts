import path from 'node:path'
import { defineConfig } from 'vite'
import type { UserConfig as ViteUserConfig } from 'vite'
import type { TestUserConfig } from 'vitest/config'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

const projectRoot = __dirname
const rendererRoot = path.join(projectRoot, 'src/renderer')
const distElectronDir = path.join(projectRoot, 'dist-electron')
const sharedAlias = {
  '@core': path.join(projectRoot, 'src/core'),
  '@shared': path.join(projectRoot, 'src/shared'),
}
const rendererAlias = {
  '@': path.join(rendererRoot, 'src'),
  ...sharedAlias,
}

type ForgeZipConfig = ViteUserConfig & {
  test?: TestUserConfig
}

const config: ForgeZipConfig = {
  root: rendererRoot,
  publicDir: path.join(__dirname, 'public'),
  envDir: path.join(__dirname),
  resolve: {
    alias: rendererAlias,
  },
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    globals: true,
    root: __dirname,
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: path.join(projectRoot, 'src/main/index.ts'),
        vite: {
          root: projectRoot,
          build: {
            outDir: distElectronDir,
            rollupOptions: {
              external: ['7zip-bin'],
            },
          },
          resolve: {
            alias: sharedAlias,
          },
        },
      },
      preload: {
        input: path.join(projectRoot, 'src/preload/index.ts'),
        vite: {
          root: projectRoot,
          build: {
            outDir: distElectronDir,
          },
          resolve: {
            alias: sharedAlias,
          },
        },
      },
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
}

export default defineConfig(config)
