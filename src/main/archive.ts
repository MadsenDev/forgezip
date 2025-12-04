import { dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import type {
  AddToArchivePayload,
  DeleteEntriesPayload,
  ExtractArchivePayload,
  PreviewArchivePayload,
} from '@shared/archive'
import {
  addFilesToArchive,
  deleteArchiveEntries,
  extractArchiveEntries,
  listArchiveEntries,
  previewArchiveEntry,
  testArchiveIntegrity,
} from '@core/compression/engine'

const ARCHIVE_FILTERS = [
  { name: 'Archives', extensions: ['7z', 'zip', 'rar', 'tar', 'gz', 'bz2'] },
  { name: 'All files', extensions: ['*'] },
]

function handleError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

export function registerArchiveIpcHandlers() {
  ipcMain.handle('archive:dialog:open', async () => {
    return dialog.showOpenDialog({
      title: 'Open archive',
      properties: ['openFile'],
      filters: ARCHIVE_FILTERS,
    })
  })

  ipcMain.handle('archive:dialog:files', async () => {
    return dialog.showOpenDialog({
      title: 'Select files to add',
      properties: ['openFile', 'multiSelections'],
    })
  })

  ipcMain.handle('archive:dialog:destination', async (_event, defaultPath?: string) => {
    return dialog.showOpenDialog({
      title: 'Select destination folder',
      defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    })
  })

  ipcMain.handle('archive:dialog:save', async (_event, defaultName?: string) => {
    return dialog.showSaveDialog({
      title: 'Create archive',
      defaultPath: defaultName ? path.join(process.cwd(), defaultName) : undefined,
      filters: ARCHIVE_FILTERS,
    })
  })

  ipcMain.handle('archive:list', async (_event, archivePath: string) => {
    try {
      return await listArchiveEntries(archivePath)
    } catch (error) {
      throw new Error(handleError(error, 'Unable to list archive'))
    }
  })

  ipcMain.handle('archive:add', async (_event, payload: AddToArchivePayload) => {
    try {
      return await addFilesToArchive(payload)
    } catch (error) {
      throw new Error(handleError(error, 'Unable to add files to archive'))
    }
  })

  ipcMain.handle('archive:extract', async (_event, payload: ExtractArchivePayload) => {
    try {
      return await extractArchiveEntries(payload)
    } catch (error) {
      throw new Error(handleError(error, 'Unable to extract archive'))
    }
  })

  ipcMain.handle('archive:delete', async (_event, payload: DeleteEntriesPayload) => {
    try {
      return await deleteArchiveEntries(payload)
    } catch (error) {
      throw new Error(handleError(error, 'Unable to delete entries'))
    }
  })

  ipcMain.handle('archive:test', async (_event, archivePath: string) => {
    try {
      return await testArchiveIntegrity(archivePath)
    } catch (error) {
      throw new Error(handleError(error, 'Unable to test archive'))
    }
  })

  ipcMain.handle('archive:preview', async (_event, payload: PreviewArchivePayload) => {
    try {
      const result = await previewArchiveEntry(payload)
      if (result.extractedPath) {
        await shell.openPath(result.extractedPath)
      }
      return result
    } catch (error) {
      throw new Error(handleError(error, 'Unable to preview archive entry'))
    }
  })
}

