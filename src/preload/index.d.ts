import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    reconstructionApi: {
      ping: () => void
      runPredict: () => Promise<void>
      pickNpyFile: () => Promise<string | null>
      readNpyFile: (filePath: string) => Promise<ArrayBuffer>
    }
  }
}
