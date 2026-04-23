import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    reconstructionApi: {
      ping: () => void
      runPredict: () => Promise<void>
      pickNpyFile: () => Promise<string | null>
      readNpyFile: (filePath: string) => Promise<ArrayBuffer>
      runSeabornChart: (npyPath: string) => Promise<void>
      readImageFile: (filePath: string) => Promise<{ filePath: string; bytes: ArrayBuffer }>
    }
  }
}
