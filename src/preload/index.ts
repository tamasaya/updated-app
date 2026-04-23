/* eslint-disable @typescript-eslint/ban-ts-comment */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const reconstructionApi = {
  ping: () => ipcRenderer.send('ping'),
  runPredict: () => ipcRenderer.invoke('run-predict'),
  pickNpyFile: () => ipcRenderer.invoke('pick-npy-file'),
  readNpyFile: (filePath: string) => ipcRenderer.invoke('read-npy-file', filePath),
  runSeabornChart: (npyPath: string) => ipcRenderer.invoke('run-seaborn-chart', npyPath),
  readImageFile: (filePath: string) => ipcRenderer.invoke('read-image-file', filePath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('reconstructionApi', reconstructionApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.reconstructionApi = reconstructionApi
}
