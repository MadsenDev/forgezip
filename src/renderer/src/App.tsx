import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import type { ArchiveEntry, ArchiveStats, CompressionFormat } from '@shared/archive'
import { buildPrivacySummary, redactPayload, type PrivacySettings } from '@core/security/privacy'
import { usePrivacyStore } from './state/privacy'
import {
  FiArchive,
  FiCheckCircle,
  FiCloud,
  FiCpu,
  FiDownload,
  FiFolder,
  FiLock,
  FiSettings,
  FiShield,
  FiSliders,
  FiUpload,
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

interface TreeNode {
  label: string
  children?: TreeNode[]
}

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
      { label: '7zip / Zip / Tar', detail: 'Create or extract mainstream archives' },
      { label: 'RAR (read-only)', detail: 'Inspect legacy archives without writing' },
      { label: 'Smart profiles', detail: 'Drive automation rules per destination' },
      { label: 'Checksum + metadata', detail: 'Integrity logs plus EXIF stripping' },
    ],
  })
}

function App() {
  const forgezip = typeof window !== 'undefined' ? window.forgezip : undefined
  const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined
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
    hydrate: hydratePrivacy,
  } = usePrivacyStore()
  const { data: capabilities = [] } = useCompressionCapabilities()

  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null)
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [archiveName, setArchiveName] = useState('project-assets')
  const [archiveFormat, setArchiveFormat] = useState<CompressionFormat>('7z')
  const [sourceFolder, setSourceFolder] = useState('~/Downloads/drops')
  const [compressionLevel, setCompressionLevel] = useState(7)
  const [includeChecksum, setIncludeChecksum] = useState(true)
  const [statusMessage, setStatusMessage] = useState('Select an archive to get started')
  const [operationLog, setOperationLog] = useState<string[]>([])
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [automationDestination, setAutomationDestination] = useState('Google Drive')
  const [automationCadence, setAutomationCadence] = useState('Nightly')
  const [automationEncrypted, setAutomationEncrypted] = useState(true)
  const [settingsStatus, setSettingsStatus] = useState('Ready to sync settings')
  const [exportLocation, setExportLocation] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!electronAPI?.on) return
    const cleanup = electronAPI.on('main-process-message', (_event, payload) => {
      if (typeof payload === 'string') {
        setLastMessage(payload)
      }
    })

    return () => cleanup?.()
  }, [electronAPI])

  useEffect(() => {
    if (!electronAPI?.invoke) return
    electronAPI
      .invoke('settings:load')
      .then((saved) => {
        if (saved) {
          hydratePrivacy(saved as Partial<PrivacySettings & { rememberSecrets: boolean }>)
          setSettingsStatus('Settings loaded from disk')
        }
      })
      .catch(() => setSettingsStatus('Unable to load settings'))
  }, [electronAPI, hydratePrivacy])

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

  const currentSettings = useMemo(
    () => ({ privacyMode, stripMetadata, telemetryLevel, rememberSecrets }),
    [privacyMode, rememberSecrets, stripMetadata, telemetryLevel],
  )

  const appendLog = useCallback((entry: string) => {
    setOperationLog((previous) => [entry, ...previous].slice(0, 8))
  }, [])

  const archivePath = archiveStats?.archivePath ?? null
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds.includes(entry.id)),
    [entries, selectedIds],
  )
  const folderTree = useMemo(() => buildFolderTree(entries), [entries])
  const queueItems = useMemo(() => (operationLog.length ? operationLog : queuedTasks), [operationLog, queuedTasks])

  const refreshArchive = useCallback(
    async (targetPath: string) => {
      if (!forgezip) {
        setStatusMessage('Archive bridge is unavailable outside Electron')
        return
      }

      setIsBusy(true)
      try {
        const result = await forgezip.listArchive(targetPath)
        setArchiveStats(result.stats)
        setEntries(result.entries)
        setSelectedIds([])
        setArchiveName(extractFileName(result.stats.archivePath))
        setArchiveFormat(result.stats.format)
        setSourceFolder(deriveDirectory(result.stats.archivePath))
        setStatusMessage(`Loaded ${result.entries.length} item(s)`)
        appendLog(`Listed ${result.entries.length} entries (${result.stats.format.toUpperCase()})`)
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Unable to read archive')
      } finally {
        setIsBusy(false)
      }
    },
    [appendLog, forgezip],
  )

  const handleOpenArchive = useCallback(async () => {
    if (!forgezip) return
    const filePath = await forgezip.chooseArchive()
    if (!filePath) return
    await refreshArchive(filePath)
  }, [forgezip, refreshArchive])

  const handleAddFiles = useCallback(async () => {
    if (!forgezip) return
    const files = await forgezip.chooseFiles()
    if (!files.length) return

    let targetArchive = archivePath
    if (!targetArchive) {
      const savePath = await forgezip.chooseSaveArchive(`${archiveName}.${archiveFormat}`)
      if (!savePath) return
      targetArchive = savePath
    }

    setIsBusy(true)
    try {
      const result = await forgezip.addToArchive({
        archivePath: targetArchive,
        files,
        format: archiveFormat,
        compressionLevel,
      })
      setStatusMessage(result.message)
      appendLog(result.message)
      await refreshArchive(targetArchive)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to add files')
    } finally {
      setIsBusy(false)
    }
  }, [appendLog, archiveFormat, archiveName, archivePath, compressionLevel, forgezip, refreshArchive])

  const handleExtract = useCallback(async () => {
    if (!forgezip || !archivePath) return
    const destination = await forgezip.chooseDestination()
    if (!destination) return

    setIsBusy(true)
    try {
      const entriesToExtract = selectedEntries.length ? selectedEntries.map((entry) => entry.path) : undefined
      const result = await forgezip.extractArchive({ archivePath, destination, entries: entriesToExtract })
      setStatusMessage(result.message)
      appendLog(result.message)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to extract archive')
    } finally {
      setIsBusy(false)
    }
  }, [appendLog, archivePath, forgezip, selectedEntries])

  const handleDelete = useCallback(async () => {
    if (!forgezip || !archivePath || !selectedEntries.length) return

    setIsBusy(true)
    try {
      const result = await forgezip.deleteEntries({ archivePath, entries: selectedEntries.map((entry) => entry.path) })
      setStatusMessage(result.message)
      appendLog(result.message)
      await refreshArchive(archivePath)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to delete entries')
    } finally {
      setIsBusy(false)
    }
  }, [appendLog, archivePath, forgezip, refreshArchive, selectedEntries])

  const handleTest = useCallback(async () => {
    if (!forgezip || !archivePath) return
    setIsBusy(true)
    try {
      const result = await forgezip.testArchive(archivePath)
      setStatusMessage(result.message)
      appendLog(result.logs[result.logs.length - 1] ?? result.message)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Integrity test failed')
    } finally {
      setIsBusy(false)
    }
  }, [appendLog, archivePath, forgezip])

  const handleView = useCallback(async () => {
    if (!forgezip || !archivePath || !selectedEntries.length) return
    const entry = selectedEntries[0]
    setIsBusy(true)
    try {
      const result = await forgezip.previewEntry({ archivePath, entryPath: entry.path })
      setStatusMessage(result.message)
      appendLog(`Previewed ${entry.name}`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to preview entry')
    } finally {
      setIsBusy(false)
    }
  }, [appendLog, archivePath, forgezip, selectedEntries])

  const totalSizeDisplay = formatBytes(archiveStats?.totalSize ?? 0)
  const totalCompressedDisplay = formatBytes(archiveStats?.totalCompressedSize ?? 0)

  const selectedDetails = useMemo(() => {
    if (!selectedEntries.length) return null
    const aggregateSize = selectedEntries.reduce((sum, entry) => sum + entry.size, 0)
    return {
      count: selectedEntries.length,
      size: formatBytes(aggregateSize),
      first: selectedEntries[0],
    }
  }, [selectedEntries])

  const planSummary = useMemo(
    () => [
      { label: 'Archive', value: `${archiveName}.${archiveFormat}` },
      { label: 'Source folder', value: sourceFolder },
      {
        label: 'Compression',
        value: `Level ${compressionLevel} (${includeChecksum ? 'checksum on' : 'no checksum'})`,
      },
      { label: 'Metadata', value: stripMetadata ? 'Strip EXIF on export' : 'Keep metadata' },
      { label: 'Automation', value: `${automationCadence} → ${automationDestination}` },
    ],
    [archiveName, archiveFormat, sourceFolder, compressionLevel, includeChecksum, stripMetadata, automationCadence, automationDestination],
  )

  const toolbarButtons = useMemo(
    () => [
      { label: 'Open', icon: <FiFolder />, action: handleOpenArchive, disabled: isBusy },
      { label: 'Add', icon: <FiUpload />, action: handleAddFiles, disabled: isBusy },
      {
        label: 'Extract',
        icon: <FiDownload />,
        action: handleExtract,
        disabled: isBusy || !archivePath,
      },
      {
        label: 'Test',
        icon: <FiShield />,
        action: handleTest,
        disabled: isBusy || !archivePath,
      },
      {
        label: 'View',
        icon: <FiCloud />,
        action: handleView,
        disabled: isBusy || !archivePath || !selectedEntries.length,
      },
      {
        label: 'Delete',
        icon: <FiLock />,
        action: handleDelete,
        disabled: isBusy || !selectedEntries.length,
      },
    ],
    [archivePath, handleAddFiles, handleDelete, handleExtract, handleOpenArchive, handleTest, handleView, isBusy, selectedEntries.length],
  )

  const persistSettings = async () => {
    if (!electronAPI?.invoke) {
      setSettingsStatus('Settings sync requires the Electron runtime')
      return
    }

    try {
      await electronAPI.invoke('settings:save', currentSettings)
      setSettingsStatus('Settings saved to profile')
    } catch (error) {
      console.error(error)
      setSettingsStatus('Unable to save settings')
    }
  }

  const exportSettings = async () => {
    if (!electronAPI?.invoke) {
      setSettingsStatus('Export requires the Electron runtime')
      return
    }

    try {
      const result = await electronAPI.invoke<{ canceled?: boolean; filePath?: string }>('settings:export')
      if (result?.canceled) {
        setSettingsStatus('Export canceled')
        return
      }

      setExportLocation(result?.filePath ?? null)
      setSettingsStatus('Settings exported')
    } catch (error) {
      console.error(error)
      setSettingsStatus('Export failed')
    }
  }

  const importSettings = async () => {
    if (!electronAPI?.invoke) {
      setSettingsStatus('Import requires the Electron runtime')
      return
    }

    try {
      const result = await electronAPI.invoke<{
        canceled?: boolean
        error?: string
        settings?: Partial<PrivacySettings & { rememberSecrets: boolean }>
      }>('settings:import')

      if (result?.canceled) {
        setSettingsStatus('Import canceled')
        return
      }

      if (result?.error) {
        setSettingsStatus(result.error)
        return
      }

      if (result?.settings) {
        hydratePrivacy(result.settings)
      }
      setSettingsStatus('Settings imported and applied')
    } catch (error) {
      console.error(error)
      setSettingsStatus('Import failed')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-slate-950/80 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <FiArchive className="text-indigo-300" />
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-indigo-200">ForgeZip</p>
            <h1 className="text-lg font-semibold">Archive Manager</h1>
            <p className="text-xs text-slate-400">{statusMessage}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {toolbarButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              disabled={button.disabled}
              onClick={button.action}
              className="flex min-w-[110px] items-center gap-2 rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-indigo-300">{button.icon}</span>
              {button.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-col border-r border-white/5 bg-slate-950/70 p-4 xl:flex">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Folders</p>
          <div className="mt-3 overflow-y-auto pr-2">
            {folderTree.length ? <FolderTree nodes={folderTree} /> : <p className="text-sm text-slate-500">No directories detected</p>}
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/5 bg-slate-950/60 px-4 py-2 text-sm text-slate-300">
            <span>Archive: {archivePath ?? '—'}</span>
            <span>Total compressed: {totalCompressedDisplay}</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Select</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Compressed</th>
                  <th className="px-4 py-2">Modified</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isSelected = selectedIds.includes(entry.id)
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-white/5 bg-slate-950/50 hover:bg-slate-900/70 ${isSelected ? 'bg-indigo-500/10' : ''}`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-400"
                          checked={isSelected}
                          onChange={(event) => {
                            setSelectedIds((previous) => {
                              if (event.target.checked) {
                                return Array.from(new Set([...previous, entry.id]))
                              }
                              return previous.filter((id) => id !== entry.id)
                            })
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 text-white">{entry.name}</td>
                      <td className="px-4 py-2">{formatBytes(entry.size)}</td>
                      <td className="px-4 py-2">{formatBytes(entry.compressedSize)}</td>
                      <td className="px-4 py-2">{entry.modified || '—'}</td>
                    </tr>
                  )
                })}
                {!entries.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      {archivePath ? 'Archive is empty' : 'Open or create an archive to see contents'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="w-full max-w-md space-y-4 border-l border-white/5 bg-slate-950/80 px-4 py-6 overflow-y-auto">
          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Archive status</h4>
              <span className="text-xs text-slate-500">{archiveStats?.format.toUpperCase() ?? '—'}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{statusMessage}</p>
            <p className="text-xs text-slate-500">Entries: {archiveStats?.entries ?? 0} • Size: {totalSizeDisplay}</p>
          </div>

          {selectedDetails ? (
            <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Selection</h4>
                <span className="text-xs text-slate-400">{selectedDetails.count} item(s)</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{selectedDetails.first.name}</p>
              <p className="text-xs text-slate-500">{selectedDetails.first.path}</p>
              <p className="mt-2 text-xs text-slate-400">Combined size: {selectedDetails.size}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <h4 className="text-sm font-semibold text-white">Archive settings</h4>
            <div className="mt-3 space-y-3 text-sm text-slate-200">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">Name</span>
                <input
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-400/60"
                  value={archiveName}
                  onChange={(event) => setArchiveName(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">Source folder</span>
                <input
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-400/60"
                  value={sourceFolder}
                  onChange={(event) => setSourceFolder(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">Format</span>
                <select
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-400/60"
                  value={archiveFormat}
                  onChange={(event) => setArchiveFormat(event.target.value as CompressionFormat)}
                >
                  <option value="7z">7z (solid)</option>
                  <option value="zip">ZIP (compatibility)</option>
                  <option value="tar">tar (stream)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <FiSliders /> Compression level
                </span>
                <div className="flex items-center gap-3 rounded border border-white/10 bg-slate-900/70 px-3 py-2">
                  <input
                    type="range"
                    min={1}
                    max={9}
                    value={compressionLevel}
                    onChange={(event) => setCompressionLevel(Number(event.target.value))}
                    className="h-2 flex-1 rounded-full bg-slate-700 accent-indigo-400"
                  />
                  <span className="w-8 rounded bg-white/10 py-1 text-center text-xs font-semibold text-white">{compressionLevel}</span>
                </div>
              </label>
              <label className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="font-semibold text-white">Include checksum</p>
                  <p className="text-xs text-slate-400">Adds SHA manifest for restores</p>
                </div>
                <input type="checkbox" className="h-4 w-4 accent-indigo-400" checked={includeChecksum} onChange={(event) => setIncludeChecksum(event.target.checked)} />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Automation</h4>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                {automationSummary.enabled}/{automationSummary.total} active
              </span>
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-200">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">Destination</span>
                <select
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-400/60"
                  value={automationDestination}
                  onChange={(event) => setAutomationDestination(event.target.value)}
                >
                  <option>Google Drive</option>
                  <option>Dropbox</option>
                  <option>Local workspace</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">Cadence</span>
                <select
                  className="w-full rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-400/60"
                  value={automationCadence}
                  onChange={(event) => setAutomationCadence(event.target.value)}
                >
                  <option>Nightly</option>
                  <option>Hourly</option>
                  <option>On demand</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="font-semibold text-white">Encrypt before upload</p>
                  <p className="text-xs text-slate-400">Uses workspace key material</p>
                </div>
                <input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={automationEncrypted} onChange={(event) => setAutomationEncrypted(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="font-semibold text-white">Remember secrets</p>
                  <p className="text-xs text-slate-400">Stores tokens in encrypted vault</p>
                </div>
                <input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={rememberSecrets} onChange={toggleRememberSecrets} />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <h4 className="text-sm font-semibold text-white">Queue</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {queueItems.map((task) => (
                <li key={task} className="flex items-center gap-2 rounded bg-white/5 px-3 py-2">
                  <FiZap className="text-amber-300" />
                  {task}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <h4 className="text-sm font-semibold text-white">Supported operations</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {capabilities.map((capability) => (
                <li key={capability.label} className="flex items-start gap-2 rounded bg-white/5 px-3 py-2">
                  <FiCheckCircle className="mt-0.5 text-emerald-300" />
                  <div>
                    <p className="font-semibold text-white">{capability.label}</p>
                    <p className="text-xs text-slate-400">{capability.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Plan summary</h4>
              <FiSettings className="text-indigo-300" />
            </div>
            <dl className="mt-3 space-y-2 text-sm text-slate-300">
              {planSummary.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1 last:border-b-0">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{row.label}</dt>
                  <dd className="text-right text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <h4 className="text-sm font-semibold text-white">Privacy & telemetry</h4>
            <div className="mt-3 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
                <div>
                  <p className="font-semibold text-white">Privacy mode</p>
                  <p className="text-xs text-slate-400">Limits logging and IPC payloads</p>
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
              <label className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="font-semibold text-white">Strip EXIF data</p>
                  <p className="text-xs text-slate-400">Applies to previews and uploads</p>
                </div>
                <input type="checkbox" className="h-4 w-4 accent-indigo-400" checked={stripMetadata} onChange={(event) => setStripMetadata(event.target.checked)} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['minimal', 'full'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setTelemetryLevel(level)}
                    className={`flex items-center justify-between rounded border px-3 py-2 text-left text-sm transition ${
                      telemetryLevel === level ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-200'
                    }`}
                  >
                    <span className="capitalize">{level} telemetry</span>
                    <FiShield className="text-emerald-300" />
                  </button>
                ))}
              </div>
              <div className="rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                <div className="flex items-center justify-between text-sm text-white">
                  <span>{privacySummary.modeLabel}</span>
                  <span className="text-emerald-200">{privacySummary.telemetryAllowed ? 'Telemetry on' : 'Telemetry limited'}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Sanitized payload example:</p>
                <code className="block rounded bg-slate-800/70 p-2 text-[11px] text-emerald-100">{JSON.stringify(sanitizedSecrets)}</code>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4 space-y-3 text-sm text-slate-200">
            <h4 className="text-sm font-semibold text-white">Settings & backup</h4>
            <button
              type="button"
              onClick={persistSettings}
              className="flex items-center justify-center gap-2 rounded border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300"
            >
              <FiCpu /> Save profile
            </button>
            <button
              type="button"
              onClick={exportSettings}
              className="flex items-center justify-center gap-2 rounded border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-300"
            >
              <FiDownload /> Export JSON
            </button>
            <button
              type="button"
              onClick={importSettings}
              className="flex items-center justify-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/30"
            >
              <FiUpload /> Import JSON
            </button>
            <p className="text-[11px] text-slate-400">
              {settingsStatus}
              {exportLocation && ` • Saved to ${exportLocation}`}
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <h4 className="text-sm font-semibold text-white">Safeguards</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li className="flex items-start gap-2 rounded bg-white/5 px-3 py-2">
                <FiCheckCircle className="mt-0.5 text-emerald-300" /> Context isolation + sandboxed renderer
              </li>
              <li className="flex items-start gap-2 rounded bg-white/5 px-3 py-2">
                <FiCheckCircle className="mt-0.5 text-emerald-300" /> IPC surface limited to preload helpers
              </li>
              <li className="flex items-start gap-2 rounded bg-white/5 px-3 py-2">
                <FiCheckCircle className="mt-0.5 text-emerald-300" />
                {includeChecksum ? 'Checksum manifests enabled' : 'Checksum manifests skipped for speed'}
              </li>
            </ul>
            <div className="mt-3 rounded bg-slate-900/80 px-3 py-3 text-xs text-slate-300">
              <p className="font-semibold text-white">Secure storage note</p>
              <p>
                When <span className="font-semibold text-white">Remember secrets</span> is enabled, persist tokens with the encrypted vault in
                <code className="mx-1 rounded bg-white/10 px-1">src/core/security/vault.ts</code>.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/90 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Main process heartbeat</h4>
              <FiCloud className="text-sky-300" />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Messages from the main process land here via the preload bridge. Surface progress, telemetry, or updater notices as you expand IPC.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
              {lastMessage ?? 'Waiting for main process...'}
            </div>
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center gap-4 border-t border-white/5 bg-slate-950/80 px-4 py-2 text-xs text-slate-400">
        <span>{archiveStats?.entries ?? 0} items</span>
        <span>Total size: {totalSizeDisplay}</span>
        <span>Compressed: {totalCompressedDisplay}</span>
        <span>Queue: {queueItems.length}</span>
        <span>Privacy: {privacySummary.modeLabel}</span>
      </footer>
    </div>
  )
}

function FolderTree({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={`${depth}-${node.label}`}>
          <div
            className={`flex items-center gap-2 text-sm ${depth === 0 ? 'font-semibold text-white' : 'text-slate-300'}`}
            style={{ paddingLeft: depth * 12 }}
          >
            {node.children ? <span className="text-slate-500">▸</span> : <span className="text-transparent">▸</span>}
            {node.label}
          </div>
          {node.children ? <FolderTree nodes={node.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  )
}

function buildFolderTree(entries: ArchiveEntry[]): TreeNode[] {
  type NodeMap = Record<string, TreeNode & { childrenMap?: NodeMap }>
  const root: NodeMap = {}

  for (const entry of entries) {
    const segments = entry.path.split(/[/\\]+/).filter(Boolean)
    const limit = entry.isDirectory ? segments.length : Math.max(segments.length - 1, 0)
    if (limit === 0) continue

    let currentLevel = root
    for (let index = 0; index < limit; index += 1) {
      const segment = segments[index] ?? ''
      if (!currentLevel[segment]) {
        currentLevel[segment] = { label: segment }
      }
      if (!currentLevel[segment].childrenMap) {
        currentLevel[segment].childrenMap = {}
      }
      currentLevel = currentLevel[segment].childrenMap as NodeMap
    }
  }

  const materialize = (map: NodeMap): TreeNode[] =>
    Object.values(map)
      .map(({ label, childrenMap }) => ({
        label,
        children: childrenMap ? materialize(childrenMap) : undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

  return materialize(root)
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = unitIndex === 0 ? 0 : 2
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function deriveDirectory(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/').split('/')
  normalized.pop()
  return normalized.join('/') || '/'
}

function extractFileName(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/').split('/')
  return normalized.pop() ?? filePath
}

export default App
