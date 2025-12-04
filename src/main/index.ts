import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { autoUpdater } from 'electron-updater'
import {
  exportSettingsFile,
  importSettingsFile,
  resolveSettingsPath,
  readSettings,
  writeSettings,
} from '@core/workspace/settings'
import { registerArchiveIpcHandlers } from './archive'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let settingsPath: string

function broadcastMessage(message: string) {
  win?.webContents.send('main-process-message', message)
}

async function checkForUpdates(manual = false) {
  try {
    const result = await autoUpdater.checkForUpdatesAndNotify()
    if (manual) {
      const label = result?.updateInfo ? `Update channel responded (${result.updateInfo.version})` : 'No updates found'
      broadcastMessage(label)
    }
  } catch (error) {
    if (manual) {
      broadcastMessage(`Update check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Check for updates', click: () => checkForUpdates(true) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools', visible: isDev },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open documentation',
          click: () => {
            broadcastMessage('Docs are available in the repository /docs folder.')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function registerSettingsIpc() {
  ipcMain.handle('settings:load', () => {
    return readSettings(settingsPath)
  })

  ipcMain.handle('settings:save', (_event, payload: unknown) => {
    const settings = typeof payload === 'object' && payload ? payload : {}
    return writeSettings(settingsPath, settings)
  })

  ipcMain.handle('settings:export', async () => {
    const exportTarget = await dialog.showSaveDialog({
      title: 'Export settings',
      defaultPath: 'forgezip-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (exportTarget.canceled || !exportTarget.filePath) {
      return { canceled: true }
    }

    writeSettings(settingsPath, readSettings(settingsPath))
    exportSettingsFile(settingsPath, exportTarget.filePath)
    return { canceled: false, filePath: exportTarget.filePath }
  })

  ipcMain.handle('settings:import', async () => {
    const importTarget = await dialog.showOpenDialog({
      title: 'Import settings',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (importTarget.canceled || !importTarget.filePaths[0]) {
      return { canceled: true }
    }

    try {
      const settings = importSettingsFile(settingsPath, importTarget.filePaths[0])
      return { canceled: false, settings }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed'
      return { canceled: false, error: message }
    }
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'ForgeZip',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.webContents.on('did-finish-load', () => {
    broadcastMessage(new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  settingsPath = resolveSettingsPath(app.getPath('userData'))
  writeSettings(settingsPath, readSettings(settingsPath))
  registerSettingsIpc()
  registerArchiveIpcHandlers()
  buildMenu()
  createWindow()

  if (!isDev) {
    checkForUpdates(false)
  }
})
