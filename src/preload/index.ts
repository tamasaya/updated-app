import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  ping: () => ipcRenderer.send('ping'),

  runPredict: () => ipcRenderer.invoke('run-predict')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('spotread', {
      start: (payload: { argyllBinDir: string; instrumentPort: number }) =>
        ipcRenderer.invoke('spotread:start', payload),
      stop: () => ipcRenderer.invoke('spotread:stop'),
      calibrate: () => ipcRenderer.invoke('spotread:calibrate'),
      measure: () => ipcRenderer.invoke('spotread:measure'),
      saveSpectrum: () => ipcRenderer.invoke('spotread:saveSpectrum'),
      setReference: () => ipcRenderer.invoke('spotread:setReference'),

      onState: (callback: (state: string) => void) => {
        const listener = (_event: unknown, state: string) => callback(state)
        ipcRenderer.on('spotread:state', listener)
        return () => ipcRenderer.removeListener('spotread:state', listener)
      },

      onRaw: (callback: (chunk: string) => void) => {
        const listener = (_event: unknown, chunk: string) => callback(chunk)
        ipcRenderer.on('spotread:raw', listener)
        return () => ipcRenderer.removeListener('spotread:raw', listener)
      },

      onMeasurement: (callback: (measurement: unknown) => void) => {
        const listener = (_event: unknown, measurement: unknown) => callback(measurement)
        ipcRenderer.on('spotread:measurement', listener)
        return () => ipcRenderer.removeListener('spotread:measurement', listener)
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
