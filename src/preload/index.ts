/* eslint-disable @typescript-eslint/ban-ts-comment */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const reconstructionApi = {
  ping: () => ipcRenderer.send('ping'),
  runPredict: () => ipcRenderer.invoke('run-predict'),
  pickNpyFile: () => ipcRenderer.invoke('pick-npy-file'),
  readNpyFile: (filePath: string) => ipcRenderer.invoke('read-npy-file', filePath)
}

const spotreadApi = {
  start: (payload: { argyllBinDir: string; instrumentPort: number }) =>
    ipcRenderer.invoke('spotread:start', payload),
  stop: () => ipcRenderer.invoke('spotread:stop'),
  calibrate: () => ipcRenderer.invoke('spotread:calibrate'),
  measure: () => ipcRenderer.invoke('spotread:measure'),
  saveSpectrum: () => ipcRenderer.invoke('spotread:saveSpectrum'),
  setReference: () => ipcRenderer.invoke('spotread:setReference'),

  onState: (callback: (state: string) => void) => {
    const listener = (_event: unknown, state: string): void => callback(state)
    ipcRenderer.on('spotread:state', listener)
    return () => ipcRenderer.removeListener('spotread:state', listener)
  },

  onRaw: (callback: (chunk: string) => void) => {
    const listener = (_event: unknown, chunk: string): void => callback(chunk)
    ipcRenderer.on('spotread:raw', listener)
    return () => ipcRenderer.removeListener('spotread:raw', listener)
  },

  onMeasurement: (callback: (measurement: unknown) => void) => {
    const listener = (_event: unknown, measurement: unknown): void => callback(measurement)
    ipcRenderer.on('spotread:measurement', listener)
    return () => ipcRenderer.removeListener('spotread:measurement', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('reconstructionApi', reconstructionApi)
    contextBridge.exposeInMainWorld('spotreadApi', spotreadApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.reconstructionApi = reconstructionApi
}
