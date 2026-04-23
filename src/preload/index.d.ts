import { ElectronAPI } from '@electron-toolkit/preload'

type ChartPoint = {
  x: number
  y: number
}

type ChartRegion = {
  x1: number
  y1: number
  x2: number
  y2: number
}

type ChartOptions = {
  points: ChartPoint[]
  regions: ChartRegion[]
  showAverage: boolean
  wavelengthStartNm?: number
  wavelengthEndNm?: number
  maxRegionLines?: number
}

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
      runSeabornChart: (
        npyPath: string,
        options: ChartOptions
      ) => Promise<{
        ok: boolean
        outputPath: string | null
        error?: string
        stdout?: string
        stderr?: string
      }>
      readImageFile: (filePath: string) => Promise<{ filePath: string; bytes: ArrayBuffer }>
    }
  }
}

export {}
