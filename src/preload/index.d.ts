import { ElectronAPI } from '@electron-toolkit/preload'

export type ChartType =
  | 'global-average'
  | 'pixel'
  | 'region-average'
  | 'overlay'
  | 'multi-selection'

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
  type: ChartType
  point?: ChartPoint
  region?: ChartRegion
  points?: ChartPoint[]
  regions?: ChartRegion[]
  showAverage?: boolean
}

declare global {
  interface Window {
    electron: ElectronAPI
    reconstructionApi: {
      ping: () => void
      runPredict: () => Promise<void>
      pickNpyFile: () => Promise<string | null>
      readNpyFile: (filePath: string) => Promise<ArrayBuffer>
      runSeabornChart: (
        npyPath: string,
        options?: ChartOptions
      ) => Promise<{
        ok: boolean
        outputPath?: string
        error?: string
        stdout?: string
        stderr?: string
      }>
      readImageFile: (filePath: string) => Promise<{ filePath: string; bytes: ArrayBuffer }>
    }
  }
}
