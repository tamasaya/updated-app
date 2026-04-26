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
    spotreadApi: {
      start: (payload: { argyllBinDir: string; instrumentPort: number }) => Promise<void>
      stop: () => Promise<void>
      calibrate: () => Promise<void>
      measure: () => Promise<void>
      saveSpectrum: () => Promise<void>
      setReference: () => Promise<void>

      onState: (callback: (state: string) => void) => () => void
      onRaw: (callback: (chunk: string) => void) => () => void
      onMeasurement: (callback: (measurement: unknown) => void) => () => void
    }
  }
}

export {}
