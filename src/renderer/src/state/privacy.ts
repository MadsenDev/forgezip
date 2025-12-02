import { create } from 'zustand'
import type { PrivacySettings, TelemetryLevel } from '@core/security/privacy'

interface PrivacyStore extends PrivacySettings {
  rememberSecrets: boolean
  setTelemetryLevel: (level: TelemetryLevel) => void
  setStripMetadata: (enabled: boolean) => void
  togglePrivacyMode: () => void
  toggleRememberSecrets: () => void
}

export const usePrivacyStore = create<PrivacyStore>((set) => ({
  privacyMode: false,
  stripMetadata: true,
  telemetryLevel: 'minimal',
  rememberSecrets: false,
  setTelemetryLevel: (level) => set({ telemetryLevel: level }),
  setStripMetadata: (enabled) => set({ stripMetadata: enabled }),
  togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
  toggleRememberSecrets: () => set((state) => ({ rememberSecrets: !state.rememberSecrets })),
}))
