import fs from 'node:fs/promises'
import path from 'node:path'
import { exiftool } from 'exiftool-vendored'

export interface ExifStripOptions {
  backupOriginals?: boolean
  deleteOriginal?: boolean
}

export type StripResult = {
  file: string
  stripped: boolean
  reason?: string
}

async function ensureBackup(filePath: string) {
  const backupPath = `${filePath}.bak`
  await fs.copyFile(filePath, backupPath)
  return backupPath
}

export async function stripExifFromFile(filePath: string, options: ExifStripOptions = {}): Promise<StripResult> {
  const absolutePath = path.resolve(filePath)
  try {
    if (options.backupOriginals) {
      await ensureBackup(absolutePath)
    }

    await exiftool.write(absolutePath, {}, ['-all='])

    if (options.deleteOriginal) {
      await fs.unlink(absolutePath)
    }

    return { file: absolutePath, stripped: true }
  } catch (error) {
    return { file: absolutePath, stripped: false, reason: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function stripExifFromFiles(files: string[], options: ExifStripOptions = {}) {
  const results = await Promise.all(files.map((file) => stripExifFromFile(file, options)))
  return results
}

export async function shutdownExifTool() {
  await exiftool.end()
}
