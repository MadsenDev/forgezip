export type TelemetryLevel = 'minimal' | 'full'

export interface PrivacySettings {
  privacyMode: boolean
  stripMetadata: boolean
  telemetryLevel: TelemetryLevel
}

export interface RedactionRule {
  key: string
  pattern?: RegExp
}

const defaultRules: RedactionRule[] = [
  { key: 'password' },
  { key: 'token' },
  { key: 'secret' },
  { key: 'authorization', pattern: /^Bearer\s+.+/i },
]

export function isTelemetryAllowed(settings: PrivacySettings) {
  if (settings.privacyMode) return false
  return settings.telemetryLevel === 'full'
}

function redactValue(value: unknown, pattern?: RegExp) {
  if (typeof value !== 'string') return '***'
  if (pattern && !pattern.test(value)) return '***'
  return value.length > 8 ? `${value.slice(0, 3)}…${value.slice(-2)}` : '***'
}

export function redactPayload<T extends Record<string, unknown>>(payload: T, rules: RedactionRule[] = defaultRules): T {
  const clone = { ...payload }
  for (const rule of rules) {
    const key = rule.key as keyof T
    if (key in clone && clone[key] !== undefined) {
      clone[key] = redactValue(clone[key], rule.pattern) as T[keyof T]
    }
  }
  return clone
}

export function buildPrivacySummary(settings: PrivacySettings) {
  return {
    telemetryAllowed: isTelemetryAllowed(settings),
    strippingMetadata: settings.stripMetadata,
    modeLabel: settings.privacyMode ? 'Privacy mode' : 'Standard mode',
  }
}
