import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, beforeEach } from 'vitest'
import {
  SETTINGS_FILENAME,
  defaultSettings,
  exportSettingsFile,
  importSettingsFile,
  normalizeSettings,
  readSettings,
  resolveSettingsPath,
  writeSettings,
} from './settings'

describe('workspace settings', () => {
  let tempDir: string
  let settingsPath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgezip-settings-'))
    settingsPath = resolveSettingsPath(tempDir)
  })

  it('normalizes missing and invalid values', () => {
    const normalized = normalizeSettings({ privacyMode: 1 as unknown as boolean, telemetryLevel: 'unknown' as never })
    expect(normalized).toEqual({
      privacyMode: true,
      stripMetadata: true,
      telemetryLevel: 'minimal',
      rememberSecrets: false,
    })
  })

  it('writes and reads back settings with defaults', () => {
    const written = writeSettings(settingsPath, { telemetryLevel: 'full' })
    expect(written.telemetryLevel).toBe('full')
    expect(fs.existsSync(settingsPath)).toBe(true)

    const loaded = readSettings(settingsPath)
    expect(loaded).toEqual({
      ...defaultSettings(),
      telemetryLevel: 'full',
    })
  })

  it('exports and imports a settings file', () => {
    const sourceSettings = writeSettings(settingsPath, { privacyMode: true, stripMetadata: false })
    const exportTarget = path.join(tempDir, 'backup', SETTINGS_FILENAME)
    const importedDestination = resolveSettingsPath(path.join(tempDir, 'restored'))

    const exportedPath = exportSettingsFile(settingsPath, exportTarget)
    expect(fs.existsSync(exportedPath)).toBe(true)

    const imported = importSettingsFile(importedDestination, exportedPath)
    expect(imported).toEqual({ ...sourceSettings, stripMetadata: false })
  })

  it('rejects binary input when importing settings', () => {
    const binaryPath = path.join(tempDir, 'bad', SETTINGS_FILENAME)
    fs.mkdirSync(path.dirname(binaryPath), { recursive: true })
    fs.writeFileSync(binaryPath, Buffer.from([0, 159, 146, 150]))

    expect(() => importSettingsFile(settingsPath, binaryPath)).toThrowError('Binary files are not supported')
  })
})
