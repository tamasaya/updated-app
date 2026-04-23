import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    reconstructionApi: {
      ping: () => void
      runPredict: () => Promise<{
        ok: boolean
        code?: number
        stdout: string
        stderr: string
        outputPath: string | null
      }>
      pickNpyFile: () => Promise<string | null>
      readNpyFile: (filePath: string) => Promise<ArrayBuffer>
    }
  }
}

export {}
