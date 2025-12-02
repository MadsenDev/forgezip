import fs from 'node:fs'
import path from 'node:path'
import type { PrivacySettings, TelemetryLevel } from '../security/privacy'

export type AppSettings = PrivacySettings & { rememberSecrets: boolean }

export const SETTINGS_FILENAME = 'settings.json'

export function defaultSettings(): AppSettings {
  return {
    privacyMode: false,
    stripMetadata: true,
    telemetryLevel: 'minimal',
    rememberSecrets: false,
  }
}

export function resolveSettingsPath(baseDir: string) {
  return path.join(baseDir, SETTINGS_FILENAME)
}

function normalizeTelemetryLevel(value: unknown): TelemetryLevel {
  return value === 'full' ? 'full' : 'minimal'
}

export function normalizeSettings(input: Partial<AppSettings> = {}): AppSettings {
  const defaults = defaultSettings()
  return {
    privacyMode: Boolean(input.privacyMode ?? defaults.privacyMode),
    stripMetadata: Boolean(input.stripMetadata ?? defaults.stripMetadata),
    telemetryLevel: normalizeTelemetryLevel(input.telemetryLevel),
    rememberSecrets: Boolean(input.rememberSecrets ?? defaults.rememberSecrets),
  }
}

export function readSettings(filePath: string): AppSettings {
  if (!fs.existsSync(filePath)) {
    return defaultSettings()
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  try {
    const parsed = JSON.parse(raw)
    return normalizeSettings(parsed)
  } catch (error) {
    console.warn('Settings parse failed, using defaults', error)
    return defaultSettings()
  }
}

export function writeSettings(filePath: string, settings: Partial<AppSettings>): AppSettings {
  const normalized = normalizeSettings(settings)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

export function exportSettingsFile(sourcePath: string, targetPath: string) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('No settings file to export')
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
  return targetPath
}

export function importSettingsFile(destinationPath: string, sourcePath: string): AppSettings {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Source settings file not found')
  }
  const buffer = fs.readFileSync(sourcePath)

  if (isProbablyBinary(buffer)) {
    throw new Error('Binary files are not supported')
  }

  try {
    const parsed = JSON.parse(buffer.toString('utf-8'))
    return writeSettings(destinationPath, parsed)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to import settings')
  }
}

function isProbablyBinary(buffer: Buffer): boolean {
  if (!buffer.length) return false

  const maxSample = Math.min(buffer.length, 1024)
  let suspiciousBytes = 0

  for (let index = 0; index < maxSample; index += 1) {
    const byte = buffer[index] ?? 0
    if (byte === 0) return true
    // Treat control characters as a signal of binary data.
    if (byte < 7 || (byte > 14 && byte < 32)) {
      suspiciousBytes += 1
    }
  }

  return suspiciousBytes / maxSample > 0.3
}
