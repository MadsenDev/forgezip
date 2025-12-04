import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { path7za } from '7zip-bin'
import type {
  AddToArchivePayload,
  ArchiveCommandResult,
  ArchiveEntry,
  ArchiveListResult,
  ArchivePreviewResult,
  ArchiveStats,
  CompressionFormat,
  DeleteEntriesPayload,
  ExtractArchivePayload,
  PreviewArchivePayload,
  TestArchiveResult,
} from '@shared/archive'

type SevenZipResult = {
  code: number
  stdout: string[]
  stderr: string[]
}

const DEFAULT_FORMAT: CompressionFormat = '7z'

function formatFromArchivePath(archivePath: string, fallback: CompressionFormat = DEFAULT_FORMAT): CompressionFormat {
  const ext = path.extname(archivePath).replace('.', '').toLowerCase()
  if (ext === 'zip') return 'zip'
  if (ext === '7z') return '7z'
  if (ext === 'tar') return 'tar'
  if (ext === 'gz' || ext === 'tgz') return 'tar'
  return fallback
}

function buildCommandResult(success: boolean, message: string, stdout: string[], stderr: string[]): ArchiveCommandResult {
  const logs = [...stdout, ...stderr]
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-200)
  return { success, message, logs }
}

function normalizeEntryPath(entry: string) {
  return entry.replace(/^[/\\]+/, '')
}

function run7zip(args: string[]): Promise<SevenZipResult> {
  return new Promise((resolve, reject) => {
    const finalArgs = ['-sccUTF-8', ...args]
    const child = spawn(path7za, finalArgs, { windowsHide: true })
    const stdout: string[] = []
    const stderr: string[] = []

    child.stdout?.on('data', (chunk) => {
      stdout.push(chunk.toString())
    })

    child.stderr?.on('data', (chunk) => {
      stderr.push(chunk.toString())
    })

    child.once('error', (error) => {
      reject(error)
    })

    child.once('close', (code) => {
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

function parseListOutput(raw: string, archivePath: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  const blocks = raw.split(/\r?\n\r?\n/)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const lines = trimmed.split(/\r?\n/)
    const map = new Map<string, string>()

    for (const line of lines) {
      const [key, ...rest] = line.split(' = ')
      if (!key || rest.length === 0) continue
      map.set(key.trim(), rest.join(' = ').trim())
    }

    const relativePath = map.get('Path')
    if (!relativePath || relativePath === archivePath) continue

    const name = relativePath.split(/[/\\]/).filter(Boolean).pop() ?? relativePath
    const entry: ArchiveEntry = {
      id: relativePath,
      path: relativePath,
      name,
      size: Number(map.get('Size')) || 0,
      compressedSize: Number(map.get('Packed Size')) || 0,
      modified: map.get('Modified') ?? '',
      isDirectory: (map.get('Folder') ?? '').includes('+'),
    }

    entries.push(entry)
  }

  return entries
}

export async function listArchiveEntries(archivePath: string): Promise<ArchiveListResult> {
  const resolvedPath = path.resolve(archivePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Archive not found at ${resolvedPath}`)
  }

  const { code, stdout, stderr } = await run7zip(['l', '-slt', '-ba', resolvedPath])
  if (code !== 0) {
    throw new Error(stderr.join('').trim() || 'Unable to list archive contents')
  }

  const output = stdout.join('')
  const entries = parseListOutput(output, resolvedPath)
  const stats: ArchiveStats = {
    archivePath: resolvedPath,
    format: formatFromArchivePath(resolvedPath),
    entries: entries.length,
    totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
    totalCompressedSize: entries.reduce((sum, entry) => sum + entry.compressedSize, 0),
  }

  return { stats, entries }
}

export async function addFilesToArchive(payload: AddToArchivePayload): Promise<ArchiveCommandResult> {
  const targetPath = path.resolve(payload.archivePath)
  const files = payload.files.map((file) => path.resolve(file))
  if (!files.length) {
    throw new Error('No files selected to add')
  }

  const format = payload.format ?? formatFromArchivePath(targetPath)
  const args = ['a', `-t${format}`, '-y', targetPath, ...files]
  if (payload.compressionLevel) {
    args.splice(1, 0, `-mx=${payload.compressionLevel}`)
  }

  const { code, stdout, stderr } = await run7zip(args)
  const success = code === 0
  if (!success) {
    throw new Error(stderr.join('').trim() || 'Unable to add files to archive')
  }

  return buildCommandResult(true, `Added ${files.length} item(s)`, stdout, stderr)
}

export async function extractArchiveEntries(payload: ExtractArchivePayload): Promise<ArchiveCommandResult> {
  const archivePath = path.resolve(payload.archivePath)
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Archive not found at ${archivePath}`)
  }

  const destination = path.resolve(payload.destination)
  await fsPromises.mkdir(destination, { recursive: true })

  const args = ['x', archivePath, `-o${destination}`, '-y']
  if (payload.entries?.length) {
    args.push(...payload.entries.map(normalizeEntryPath))
  }

  const { code, stdout, stderr } = await run7zip(args)
  if (code !== 0) {
    throw new Error(stderr.join('').trim() || 'Unable to extract archive')
  }

  const label = payload.entries?.length ? `Extracted ${payload.entries.length} item(s)` : 'Extracted entire archive'
  return buildCommandResult(true, `${label} to ${destination}`, stdout, stderr)
}

export async function deleteArchiveEntries(payload: DeleteEntriesPayload): Promise<ArchiveCommandResult> {
  const archivePath = path.resolve(payload.archivePath)
  if (!payload.entries.length) {
    throw new Error('No entries selected for deletion')
  }

  const args = ['d', archivePath, ...payload.entries.map(normalizeEntryPath)]
  const { code, stdout, stderr } = await run7zip(args)
  if (code !== 0) {
    throw new Error(stderr.join('').trim() || 'Unable to delete selected entries')
  }

  return buildCommandResult(true, `Deleted ${payload.entries.length} item(s)`, stdout, stderr)
}

export async function testArchiveIntegrity(archivePath: string): Promise<TestArchiveResult> {
  const resolvedPath = path.resolve(archivePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Archive not found at ${resolvedPath}`)
  }

  const { code, stdout, stderr } = await run7zip(['t', resolvedPath])
  const success = code === 0
  const message = success ? 'Archive passed integrity test' : 'Archive failed integrity test'
  return buildCommandResult(success, message, stdout, stderr)
}

export async function previewArchiveEntry(payload: PreviewArchivePayload): Promise<ArchivePreviewResult> {
  const archivePath = path.resolve(payload.archivePath)
  const entry = normalizeEntryPath(payload.entryPath)
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'forgezip-preview-'))

  const args = ['x', archivePath, entry, `-o${tempDir}`, '-y']
  const { code, stdout, stderr } = await run7zip(args)
  if (code !== 0) {
    throw new Error(stderr.join('').trim() || 'Unable to extract preview')
  }

  const extractedPath = path.join(tempDir, entry)
  return {
    ...buildCommandResult(true, `Preview ready for ${entry}`, stdout, stderr),
    extractedPath,
  }
}

