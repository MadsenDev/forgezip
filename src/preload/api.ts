import { ipcRenderer } from 'electron'
import type {
  AddToArchivePayload,
  ArchiveCommandResult,
  ArchiveListResult,
  ArchivePreviewResult,
  DeleteEntriesPayload,
  ExtractArchivePayload,
  ForgeZipAPI,
  PreviewArchivePayload,
  TestArchiveResult,
} from '@shared/archive'

async function invokeChannel<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

async function pickSinglePath(channel: string, ...args: unknown[]) {
  const result = await invokeChannel<{ canceled: boolean; filePaths: string[] }>(channel, ...args)
  if (result?.canceled || !result?.filePaths?.length) {
    return null
  }
  return result.filePaths[0]
}

async function pickMultiplePaths(channel: string, ...args: unknown[]) {
  const result = await invokeChannel<{ canceled: boolean; filePaths: string[] }>(channel, ...args)
  if (result?.canceled || !result.filePaths?.length) {
    return []
  }
  return result.filePaths
}

export const forgezipAPI: ForgeZipAPI = {
  chooseArchive() {
    return pickSinglePath('archive:dialog:open')
  },
  chooseFiles() {
    return pickMultiplePaths('archive:dialog:files')
  },
  chooseDestination(defaultPath) {
    return pickSinglePath('archive:dialog:destination', defaultPath)
  },
  chooseSaveArchive(defaultFileName) {
    return pickSinglePath('archive:dialog:save', defaultFileName)
  },
  listArchive(archivePath: string): Promise<ArchiveListResult> {
    return invokeChannel('archive:list', archivePath)
  },
  addToArchive(payload: AddToArchivePayload): Promise<ArchiveCommandResult> {
    return invokeChannel('archive:add', payload)
  },
  extractArchive(payload: ExtractArchivePayload): Promise<ArchiveCommandResult> {
    return invokeChannel('archive:extract', payload)
  },
  deleteEntries(payload: DeleteEntriesPayload): Promise<ArchiveCommandResult> {
    return invokeChannel('archive:delete', payload)
  },
  testArchive(archivePath: string): Promise<TestArchiveResult> {
    return invokeChannel('archive:test', archivePath)
  },
  previewEntry(payload: PreviewArchivePayload): Promise<ArchivePreviewResult> {
    return invokeChannel('archive:preview', payload)
  },
}

