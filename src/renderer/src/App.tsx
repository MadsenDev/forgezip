import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { create } from 'zustand'
import {
  FiArchive,
  FiCloud,
  FiCpu,
  FiDatabase,
  FiLock,
  FiPlayCircle,
  FiZap,
} from 'react-icons/fi'

interface AutomationProfile {
  name: string
  target: string
  enabled: boolean
  cadence: string
}

interface WorkspaceState {
  privacyMode: boolean
  profiles: AutomationProfile[]
  queuedTasks: string[]
  togglePrivacyMode: () => void
}

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  privacyMode: false,
  profiles: [
    { name: 'Project backups', target: 'Local workspace', enabled: true, cadence: 'Nightly' },
    { name: 'Client delivery', target: 'Google Drive', enabled: true, cadence: 'On demand' },
    { name: 'Media cleanup', target: 'Dropbox', enabled: false, cadence: 'Weekly' },
  ],
  queuedTasks: ['Encrypt & zip assets', 'Watch downloads folder', 'Sync changelog with Drive'],
  togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
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
  const { privacyMode, profiles, queuedTasks, togglePrivacyMode } = useWorkspaceStore()
  const { data: capabilities = [] } = useCompressionCapabilities()
  const [lastMessage, setLastMessage] = useState<string | null>(null)

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
