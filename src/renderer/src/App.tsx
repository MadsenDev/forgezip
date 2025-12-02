import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { create } from 'zustand'
import { buildPrivacySummary, redactPayload } from '@core/security/privacy'
import { usePrivacyStore } from './state/privacy'
import {
  FiArchive,
  FiCheckCircle,
  FiCloud,
  FiCpu,
  FiDatabase,
  FiFolder,
  FiLock,
  FiPlayCircle,
  FiSettings,
  FiShield,
  FiSliders,
  FiZap,
} from 'react-icons/fi'

interface AutomationProfile {
  name: string
  target: string
  enabled: boolean
  cadence: string
}

interface WorkspaceState {
  profiles: AutomationProfile[]
  queuedTasks: string[]
}

type TabKey = 'archive' | 'automation' | 'privacy'

const useWorkspaceStore = create<WorkspaceState>(() => ({
  profiles: [
    { name: 'Project backups', target: 'Local workspace', enabled: true, cadence: 'Nightly' },
    { name: 'Client delivery', target: 'Google Drive', enabled: true, cadence: 'On demand' },
    { name: 'Media cleanup', target: 'Dropbox', enabled: false, cadence: 'Weekly' },
  ],
  queuedTasks: ['Encrypt & zip assets', 'Watch downloads folder', 'Sync changelog with Drive'],
}))

function useCompressionCapabilities() {
  return useQuery({
    queryKey: ['compression-capabilities'],
    queryFn: async () => [
      { label: '7zip/Zip/Tar', detail: 'Archive creation and extraction' },
      { label: 'RAR (read-only)', detail: 'Inspect and extract legacy archives' },
      { label: 'Smart profiles', detail: 'Rules to auto-select formats and destinations' },
      { label: 'Checksum & metadata', detail: 'Integrity checks plus optional EXIF stripping' },
    ],
  })
}

const cardHover = {
  whileHover: { y: -4, scale: 1.01 },
  transition: { type: 'spring', stiffness: 260, damping: 20 },
}

function App() {
  const { profiles, queuedTasks } = useWorkspaceStore()
  const {
    privacyMode,
    stripMetadata,
    telemetryLevel,
    rememberSecrets,
    togglePrivacyMode,
    setStripMetadata,
    toggleRememberSecrets,
    setTelemetryLevel,
  } = usePrivacyStore()
  const { data: capabilities = [] } = useCompressionCapabilities()
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('archive')
  const [archiveName, setArchiveName] = useState('project-assets')
  const [archiveFormat, setArchiveFormat] = useState('7z')
  const [sourceFolder, setSourceFolder] = useState('~/Downloads/drops')
  const [compressionLevel, setCompressionLevel] = useState(7)
  const [includeChecksum, setIncludeChecksum] = useState(true)
  const [automationDestination, setAutomationDestination] = useState('Google Drive')
  const [automationCadence, setAutomationCadence] = useState('Nightly')
  const [automationEncrypted, setAutomationEncrypted] = useState(true)
  const tabs = useMemo(
    () => [
      { id: 'archive' as const, label: 'Archive plan', hint: 'Create + harden outputs', icon: <FiArchive /> },
      { id: 'automation' as const, label: 'Automation', hint: 'Profiles & cadence', icon: <FiPlayCircle /> },
      { id: 'privacy' as const, label: 'Privacy', hint: 'EXIF + telemetry', icon: <FiShield /> },
    ],
    [],
  )

  useEffect(() => {
    const cleanup = window.electronAPI?.on('main-process-message', (_event, payload) => {
      if (typeof payload === 'string') {
        setLastMessage(payload)
      }
    })

    return () => cleanup?.()
  }, [])

  const automationSummary = useMemo(
    () => ({
      enabled: profiles.filter((profile) => profile.enabled).length,
      total: profiles.length,
    }),
    [profiles],
  )

  const privacySummary = useMemo(
    () => buildPrivacySummary({ privacyMode, stripMetadata, telemetryLevel }),
    [privacyMode, stripMetadata, telemetryLevel],
  )

  const sanitizedSecrets = useMemo(
    () =>
      redactPayload({
        token: 'gdrive-secret-token-abc123',
        password: 'super-secret-password',
        bucket: 'forgezip-private',
      }),
    [],
  )

  const renderTabPanel = () => {
    if (activeTab === 'archive') {
      return (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-4 rounded-xl bg-slate-950/50 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-200">Archive plan</p>
                <h3 className="text-xl font-semibold text-white">Define the run</h3>
              </div>
              <FiSettings className="text-indigo-300" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-200">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">Archive name</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-1 ring-transparent transition focus:ring-indigo-400/60"
                  value={archiveName}
                  onChange={(event) => setArchiveName(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                  <FiFolder className="text-indigo-300" /> Source folder
                </span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-1 ring-transparent transition focus:ring-indigo-400/60"
                  value={sourceFolder}
                  onChange={(event) => setSourceFolder(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">Format</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-1 ring-transparent transition focus:ring-indigo-400/60"
                  value={archiveFormat}
                  onChange={(event) => setArchiveFormat(event.target.value)}
                >
                  <option value="7z">7z (solid)</option>
                  <option value="zip">ZIP (compatibility)</option>
                  <option value="tar.gz">tar.gz (stream)</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                  <FiSliders className="text-indigo-300" /> Compression level
                </span>
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2">
                  <input
                    type="range"
                    min={1}
                    max={9}
                    value={compressionLevel}
                    onChange={(event) => setCompressionLevel(Number(event.target.value))}
                    className="h-2 flex-1 appearance-none rounded-full bg-slate-700 accent-indigo-400"
                  />
                  <span className="w-8 rounded-md bg-white/10 py-1 text-center text-xs font-semibold text-white">
                    {compressionLevel}
                  </span>
                </div>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div>
                  <p className="font-medium text-white">Strip EXIF on export</p>
                  <p className="text-xs text-slate-400">Removes GPS/camera metadata before upload</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-400"
                  checked={stripMetadata}
                  onChange={(event) => setStripMetadata(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div>
                  <p className="font-medium text-white">Generate checksum</p>
                  <p className="text-xs text-slate-400">SHA-256 manifest to verify restores</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-400"
                  checked={includeChecksum}
                  onChange={(event) => setIncludeChecksum(event.target.checked)}
                />
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-slate-950/60 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Plan summary</h4>
              <FiCheckCircle className="text-emerald-300" />
            </div>
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <FiArchive className="text-indigo-300" />
                <span>
                  {archiveName}.{archiveFormat} → {sourceFolder}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <FiSettings className="text-indigo-300" />
                <span>
                  Level {compressionLevel} with {includeChecksum ? 'checksum' : 'no checksum'}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <FiShield className="text-emerald-300" />
                <span>{stripMetadata ? 'EXIF stripped for uploads' : 'Keep original metadata'}</span>
              </div>
              <p className="text-xs text-slate-400">
                Next step: bind this plan to <code className="rounded bg-white/10 px-1">src/core/compression</code>,
                <code className="rounded bg-white/10 px-1">src/core/compression/exif.ts</code>, and
                <code className="rounded bg-white/10 px-1">src/core/cloud</code> to execute.
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'automation') {
      return (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4 rounded-xl bg-slate-950/50 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-200">Automation</p>
                <h3 className="text-xl font-semibold text-white">Profile composer</h3>
              </div>
              <FiPlayCircle className="text-emerald-300" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-200">
                <span className="text-xs uppercase tracking-wide text-slate-400">Destination</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-1 ring-transparent transition focus:ring-emerald-400/60"
                  value={automationDestination}
                  onChange={(event) => setAutomationDestination(event.target.value)}
                >
                  <option>Google Drive</option>
                  <option>Dropbox</option>
                  <option>Local workspace</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                <span className="text-xs uppercase tracking-wide text-slate-400">Cadence</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none ring-1 ring-transparent transition focus:ring-emerald-400/60"
                  value={automationCadence}
                  onChange={(event) => setAutomationCadence(event.target.value)}
                >
                  <option>Nightly</option>
                  <option>Hourly</option>
                  <option>On demand</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div>
                  <p className="font-medium text-white">Encrypt before upload</p>
                  <p className="text-xs text-slate-400">Uses workspace key material</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-400"
                  checked={automationEncrypted}
                  onChange={(event) => setAutomationEncrypted(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <div>
                  <p className="font-medium text-white">Remember secrets</p>
                  <p className="text-xs text-slate-400">Stores tokens in encrypted vault</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-400"
                  checked={rememberSecrets}
                  onChange={toggleRememberSecrets}
                />
              </label>
            </div>

            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
              <p className="font-semibold">Smart profile preview</p>
              <p className="text-emerald-100/80">
                {automationCadence} sync to {automationDestination} with {automationEncrypted ? 'encrypted payloads' : 'plaintext payloads'} and{' '}
                {rememberSecrets ? 'cached credentials.' : 'ad-hoc credentials.'}
              </p>
              <p className="text-xs text-emerald-200/80">
                Wire this to <code className="rounded bg-emerald-200/20 px-1 text-emerald-100">src/core/automation</code> to persist and
                schedule with chokidar watchers.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-slate-950/60 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Active profiles</h4>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                {automationSummary.enabled}/{automationSummary.total} enabled
              </span>
            </div>
            <div className="space-y-2 text-sm text-slate-200">
              {profiles.map((profile) => (
                <div key={profile.name} className="flex items-start justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div>
                    <p className="font-semibold text-white">{profile.name}</p>
                    <p className="text-xs text-slate-400">{profile.target}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      profile.enabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {profile.enabled ? profile.cadence : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-slate-900/70 px-3 py-3 text-xs text-slate-300">
              <p className="flex items-center gap-2 font-semibold text-slate-200">
                <FiZap className="text-amber-300" /> Queued tasks
              </p>
              <ul className="mt-2 space-y-1">
                {queuedTasks.map((task) => (
                  <li key={task} className="rounded bg-white/5 px-2 py-1">{task}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4 rounded-xl bg-slate-950/50 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-indigo-200">Privacy</p>
              <h3 className="text-xl font-semibold text-white">EXIF & telemetry controls</h3>
            </div>
            <FiShield className="text-emerald-300" />
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <div>
                <p className="font-semibold text-white">Privacy mode</p>
                <p className="text-xs text-slate-400">Prevents extra logging and scopes IPC payloads</p>
              </div>
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  privacyMode ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-300/60' : 'bg-white/10 text-slate-200'
                }`}
              >
                {privacyMode ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p className="font-medium text-white">Strip EXIF data</p>
                <p className="text-xs text-slate-400">Applies to previews and uploads</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-400"
                checked={stripMetadata}
                onChange={(event) => setStripMetadata(event.target.checked)}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['minimal', 'full'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setTelemetryLevel(level)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                    telemetryLevel === level
                      ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-200'
                  }`}
                >
                  <span className="capitalize">{level} telemetry</span>
                  <FiShield className="text-emerald-300" />
                </button>
              ))}
            </div>
            <div className="grid gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300">
              <div className="flex items-center justify-between text-sm text-white">
                <span>{privacySummary.modeLabel}</span>
                <span className="text-emerald-200">{privacySummary.telemetryAllowed ? 'Telemetry on' : 'Telemetry limited'}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Secrets are redacted before logging or IPC dispatch. Example payload:
              </p>
              <code className="block rounded-md bg-slate-800/80 p-2 text-[11px] text-emerald-100">
                {JSON.stringify(sanitizedSecrets)}
              </code>
              <p className="text-[11px] text-slate-400">
                Strip metadata: {privacySummary.strippingMetadata ? 'enabled for exports' : 'disabled'}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Route settings through <code className="rounded bg-white/10 px-1">src/core/analytics</code> and <code className="rounded bg-white/10 px-1">src/core/cloud</code>
              to ensure secrets stay local unless a user opts in.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-950/60 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Safeguards</h4>
            <FiLock className="text-emerald-300" />
          </div>
          <ul className="space-y-2 text-sm text-slate-200">
            <li className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
              <FiCheckCircle className="mt-0.5 text-emerald-300" />
              <span>Context isolation and sandboxed renderer</span>
            </li>
            <li className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
              <FiCheckCircle className="mt-0.5 text-emerald-300" />
              <span>IPC surface limited to preload helpers</span>
            </li>
            <li className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
              <FiCheckCircle className="mt-0.5 text-emerald-300" />
              <span>{includeChecksum ? 'Checksum manifests enabled' : 'Checksum manifests skipped for speed'}</span>
            </li>
            <li className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
              <FiCheckCircle className="mt-0.5 text-emerald-300" />
              <span>Telemetry level: {telemetryLevel}</span>
            </li>
            <li className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
              <FiCheckCircle className="mt-0.5 text-emerald-300" />
              <span>Secrets redacted in logs; encrypted vault only when "Remember" is on</span>
            </li>
          </ul>
          <div className="rounded-lg bg-slate-900/80 px-3 py-3 text-xs text-slate-300">
            <p className="flex items-center gap-2 font-semibold text-slate-100">
              <FiLock className="text-emerald-300" /> Secure storage note
            </p>
            <p>
              When <span className="font-semibold text-white">Remember secrets</span> is enabled, persist tokens with the
              encrypted vault in <code className="rounded bg-white/10 px-1">src/core/security/vault.ts</code> (no plain-text
              logging). Otherwise, request credentials per run.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-indigo-600/20 via-slate-900 to-slate-950 p-8 shadow-xl ring-1 ring-white/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-indigo-300/80">Compression Forge</p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Archive automation without the guesswork.</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                Electron + React + Tailwind scaffold with opinionated structure for compression, automation, and cloud sync.
                Start extending the core folders to wire up real engines, watchers, and analytics.
              </p>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-10 w-20 items-center rounded-full border border-white/10 bg-slate-800/70 p-1 text-xs font-medium transition ${
                privacyMode ? 'ring-2 ring-emerald-400/60' : 'ring-1 ring-white/10'
              }`}
              onClick={togglePrivacyMode}
            >
              <span
                className={`inline-block h-8 w-8 rounded-full bg-white shadow-lg transition ${privacyMode ? 'translate-x-10' : 'translate-x-0'}`}
              />
              <span className="absolute left-3 text-slate-400">Public</span>
              <span className="absolute right-3 text-emerald-300">Private</span>
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatusPill
              icon={<FiLock className="text-emerald-300" />}
              label="Privacy mode"
              value={privacyMode ? 'Enabled' : 'Disabled'}
              hint="Context isolation + opt-out telemetry defaults"
            />
            <StatusPill
              icon={<FiCloud className="text-sky-300" />}
              label="Cloud connectors"
              value="Google Drive, Dropbox"
              hint="Scaffolded for future OAuth and sync"
            />
            <StatusPill
              icon={<FiCpu className="text-indigo-300" />}
              label="Compression engines"
              value="7zip, archiver, yauzl"
              hint="Swap in real handlers per format"
            />
          </div>
        </header>

        <section className="rounded-2xl bg-slate-900/60 p-6 shadow-lg ring-1 ring-white/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Workbench</p>
              <h2 className="text-2xl font-semibold text-white">Tabbed forms</h2>
              <p className="text-sm text-slate-300">Prototype archive, automation, and privacy flows.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-indigo-500/20 text-white ring-1 ring-indigo-400/60'
                      : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span className="text-xs text-slate-400">{tab.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">{renderTabPanel()}</div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <motion.div
            className="rounded-xl bg-slate-900/70 p-6 shadow-lg ring-1 ring-white/5"
            {...cardHover}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Workspace</h2>
              <FiArchive className="text-indigo-300" />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Use <code className="rounded bg-white/5 px-1">src/core/workspace</code> to coordinate local roots,
              chokidar watchers, and profile-aware actions.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              {queuedTasks.map((task) => (
                <div key={task} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <FiZap className="text-amber-300" />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="rounded-xl bg-slate-900/70 p-6 shadow-lg ring-1 ring-white/5"
            {...cardHover}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Automation</h2>
              <FiPlayCircle className="text-emerald-300" />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Configure smart profiles in <code className="rounded bg-white/5 px-1">src/core/automation</code> to
              orchestrate triggers, destinations, and encryption.
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-200">
              {automationSummary.enabled}/{automationSummary.total} profiles active
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              {profiles.map((profile) => (
                <div key={profile.name} className="flex items-start justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div>
                    <p className="font-medium text-white">{profile.name}</p>
                    <p className="text-xs text-slate-400">{profile.target}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      profile.enabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {profile.enabled ? profile.cadence : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="rounded-xl bg-slate-900/70 p-6 shadow-lg ring-1 ring-white/5"
            {...cardHover}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Data & Analytics</h2>
              <FiDatabase className="text-sky-300" />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Seed <code className="rounded bg-white/5 px-1">src/core/db</code> and <code className="rounded bg-white/5 px-1">src/core/analytics</code>
              with better-sqlite3 models plus metrics for throughput and success rates.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {capabilities.map((capability) => (
                <li key={capability.label} className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-300" />
                  <div>
                    <p className="font-semibold text-white">{capability.label}</p>
                    <p className="text-xs text-slate-400">{capability.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <motion.div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 ring-1 ring-white/10" {...cardHover}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Security</p>
                <h3 className="text-2xl font-semibold text-white">Hardened renderer & preload</h3>
              </div>
              <FiLock className="text-emerald-300" size={28} />
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li>contextIsolation enabled with narrow IPC surface</li>
              <li>nodeIntegration disabled for renderer safety</li>
              <li>Preload exports typed helpers only</li>
            </ul>
          </motion.div>

          <motion.div className="rounded-2xl bg-slate-900/80 p-6 ring-1 ring-white/10" {...cardHover}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">Runtime signal</p>
                <h3 className="text-2xl font-semibold text-white">Main process heartbeat</h3>
              </div>
              <FiCloud className="text-sky-300" size={28} />
            </div>
            <p className="mt-4 text-sm text-slate-300">
              Messages from the main process land here via the preload bridge. Wire in progress, telemetry, or update
              notices as you expand the IPC surface.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
              {lastMessage ?? 'Waiting for main process...'}
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  )
}

interface StatusPillProps {
  icon: ReactNode
  label: string
  value: string
  hint: string
}

function StatusPill({ icon, label, value, hint }: StatusPillProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
        <p className="text-[11px] text-slate-400">{hint}</p>
      </div>
    </div>
  )
}

export default App
