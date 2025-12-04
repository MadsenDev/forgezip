export type CompressionFormat = '7z' | 'zip' | 'tar'

export interface ArchiveEntry {
  id: string
  path: string
  name: string
  size: number
  compressedSize: number
  modified: string
  isDirectory: boolean
}

export interface ArchiveStats {
  archivePath: string
  format: CompressionFormat
  entries: number
  totalSize: number
  totalCompressedSize: number
}

export interface ArchiveListResult {
  stats: ArchiveStats
  entries: ArchiveEntry[]
}

export interface AddToArchivePayload {
  archivePath: string
  files: string[]
  format?: CompressionFormat
  compressionLevel?: number
}

export interface ExtractArchivePayload {
  archivePath: string
  destination: string
  entries?: string[]
  overwrite?: boolean
}

export interface DeleteEntriesPayload {
  archivePath: string
  entries: string[]
}

export interface ArchiveCommandResult {
  success: boolean
  message: string
  logs: string[]
}

export interface TestArchiveResult extends ArchiveCommandResult {}

export type DialogSelectResult = {
  canceled: boolean
  filePaths: string[]
}

export interface PreviewArchivePayload {
  archivePath: string
  entryPath: string
}

export interface ArchivePreviewResult extends ArchiveCommandResult {
  extractedPath?: string
}

export interface ForgeZipAPI {
  chooseArchive(): Promise<string | null>
  chooseFiles(): Promise<string[]>
  chooseDestination(defaultPath?: string): Promise<string | null>
  chooseSaveArchive(defaultFileName?: string): Promise<string | null>
  listArchive(archivePath: string): Promise<ArchiveListResult>
  addToArchive(payload: AddToArchivePayload): Promise<ArchiveCommandResult>
  extractArchive(payload: ExtractArchivePayload): Promise<ArchiveCommandResult>
  deleteEntries(payload: DeleteEntriesPayload): Promise<ArchiveCommandResult>
  testArchive(archivePath: string): Promise<TestArchiveResult>
  previewEntry(payload: PreviewArchivePayload): Promise<ArchivePreviewResult>
}

