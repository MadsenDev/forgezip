import { buildPrivacySummary, isTelemetryAllowed, redactPayload } from './privacy'

describe('privacy helpers', () => {
  it('honors privacy mode when deciding telemetry', () => {
    expect(
      isTelemetryAllowed({
        privacyMode: true,
        stripMetadata: true,
        telemetryLevel: 'full',
      }),
    ).toBe(false)

    expect(
      isTelemetryAllowed({
        privacyMode: false,
        stripMetadata: false,
        telemetryLevel: 'minimal',
      }),
    ).toBe(false)

    expect(
      isTelemetryAllowed({
        privacyMode: false,
        stripMetadata: false,
        telemetryLevel: 'full',
      }),
    ).toBe(true)
  })

  it('redacts sensitive keys while preserving benign fields', () => {
    const payload = {
      token: 'abcdef-123456',
      password: 'super-secret',
      bucket: 'forgezip-private',
      region: 'us-east-1',
    }

    const result = redactPayload(payload)

    expect(result.token).not.toEqual(payload.token)
    expect(result.password).not.toEqual(payload.password)
    expect(result.bucket).toEqual(payload.bucket)
    expect(result.region).toEqual(payload.region)
  })

  it('builds a concise privacy summary', () => {
    const summary = buildPrivacySummary({
      privacyMode: false,
      stripMetadata: true,
      telemetryLevel: 'minimal',
    })

    expect(summary.telemetryAllowed).toBe(false)
    expect(summary.strippingMetadata).toBe(true)
    expect(summary.modeLabel).toBe('Standard mode')
  })
})
