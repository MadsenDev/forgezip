import path from 'node:path'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

const rendererRoot = path.join(__dirname, 'src/renderer')

export default defineConfig({
  root: rendererRoot,
  publicDir: path.join(__dirname, 'public'),
  envDir: path.join(__dirname),
  resolve: {
    alias: {
      '@': path.join(rendererRoot, 'src'),
      '@core': path.join(__dirname, 'src/core'),
    },
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
        entry: 'src/main/index.ts',
      },
      preload: {
        input: path.join(__dirname, 'src/preload/index.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
})
