import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type IpcHandler = (event: IpcRendererEvent, ...args: unknown[]) => void

type ElectronAPI = {
  on: (channel: string, listener: IpcHandler) => () => void
  off: (channel: string, listener: IpcHandler) => void
  send: (channel: string, ...args: unknown[]) => void
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
}

const electronAPI: ElectronAPI = {
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.off(channel, listener)
  },
  off: (channel, listener) => ipcRenderer.off(channel, listener),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
