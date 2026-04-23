import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => void
      runPredict: () => Promise<void>
      pickNpyFile: () => Promise<string | null>
    }
  }
}
