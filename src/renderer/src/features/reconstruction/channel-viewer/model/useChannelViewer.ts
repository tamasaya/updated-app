import { useEffect, useMemo, useState } from 'react'
import { loadNpy, SpectralCube } from '@/shared/lib/npy/loadNpy'

export type RgbMode = 'standard' | 'custom'
export type Normalization = 'auto' | 'fixed'
export type Contrast = 'none' | 'gamma'

type UseChannelViewerResult = {
  isLoading: boolean
  error: string | null
  cube: SpectralCube | null
  selectedChannel: number
  setSelectedChannel: (value: number) => void
  channelCount: number
  imageDataUrl: string | null
  rgbMode: RgbMode
  setRgbMode: (mode: RgbMode) => void
  customChannels: { r: number; g: number; b: number }
  setCustomChannels: (channels: { r: number; g: number; b: number }) => void
  normalization: Normalization
  setNormalization: (norm: Normalization) => void
  contrast: Contrast
  setContrast: (cont: Contrast) => void
  rgbImageDataUrl: string | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function extractChannelImageDataUrl(cube: SpectralCube, channelIndex: number): string | null {
  const [height, width, channels] = cube.shape

  if (!height || !width || !channels) return null

  const safeChannel = clamp(channelIndex, 0, channels - 1)
  const pixels = new Uint8ClampedArray(width * height * 4)

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width * channels + x * channels + safeChannel
      const value = Number(cube.data[idx])

      if (value < min) min = value
      if (value > max) max = value
    }
  }

  const range = max - min || 1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = y * width * channels + x * channels + safeChannel
      const raw = Number(cube.data[srcIdx])
      const normalized = Math.round(((raw - min) / range) * 255)

      const dstIdx = (y * width + x) * 4
      pixels[dstIdx] = normalized
      pixels[dstIdx + 1] = normalized
      pixels[dstIdx + 2] = normalized
      pixels[dstIdx + 3] = 255
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const imageData = new ImageData(pixels, width, height)
  ctx.putImageData(imageData, 0, 0)

  return canvas.toDataURL()
}

function extractRgbImageDataUrl(
  cube: SpectralCube,
  rChannel: number,
  gChannel: number,
  bChannel: number,
  normalization: Normalization,
  contrast: Contrast
): string | null {
  const [height, width, channels] = cube.shape

  if (!height || !width || !channels) return null

  const safeR = clamp(rChannel, 0, channels - 1)
  const safeG = clamp(gChannel, 0, channels - 1)
  const safeB = clamp(bChannel, 0, channels - 1)

  const pixels = new Uint8ClampedArray(width * height * 4)

  let rMin = Number.POSITIVE_INFINITY
  let rMax = Number.NEGATIVE_INFINITY
  let gMin = Number.POSITIVE_INFINITY
  let gMax = Number.NEGATIVE_INFINITY
  let bMin = Number.POSITIVE_INFINITY
  let bMax = Number.NEGATIVE_INFINITY

  if (normalization === 'auto') {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width * channels + x * channels
        const rVal = Number(cube.data[idx + safeR])
        const gVal = Number(cube.data[idx + safeG])
        const bVal = Number(cube.data[idx + safeB])

        if (rVal < rMin) rMin = rVal
        if (rVal > rMax) rMax = rVal
        if (gVal < gMin) gMin = gVal
        if (gVal > gMax) gMax = gVal
        if (bVal < bMin) bMin = bVal
        if (bVal > bMax) bMax = bVal
      }
    }
  } else {
    // Fixed normalization, assume 0-1 or something, but since no info, use auto for now
    rMin = 0
    rMax = 1
    gMin = 0
    gMax = 1
    bMin = 0
    bMax = 1
  }

  const rRange = rMax - rMin || 1
  const gRange = gMax - gMin || 1
  const bRange = bMax - bMin || 1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width * channels + x * channels
      let rRaw = Number(cube.data[idx + safeR])
      let gRaw = Number(cube.data[idx + safeG])
      let bRaw = Number(cube.data[idx + safeB])

      let rNorm = (rRaw - rMin) / rRange
      let gNorm = (gRaw - gMin) / gRange
      let bNorm = (bRaw - bMin) / bRange

      if (contrast === 'gamma') {
        // Simple gamma correction, gamma=2.2
        rNorm = Math.pow(rNorm, 1 / 2.2)
        gNorm = Math.pow(gNorm, 1 / 2.2)
        bNorm = Math.pow(bNorm, 1 / 2.2)
      }

      const r = Math.round(rNorm * 255)
      const g = Math.round(gNorm * 255)
      const b = Math.round(bNorm * 255)

      const dstIdx = (y * width + x) * 4
      pixels[dstIdx] = r
      pixels[dstIdx + 1] = g
      pixels[dstIdx + 2] = b
      pixels[dstIdx + 3] = 255
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const imageData = new ImageData(pixels, width, height)
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}

export function useChannelViewer(npyPath: string | null): UseChannelViewerResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cube, setCube] = useState<SpectralCube | null>(null)
  const [selectedChannel, setSelectedChannel] = useState(0)
  const [rgbMode, setRgbMode] = useState<RgbMode>('standard')
  const [customChannels, setCustomChannels] = useState({ r: 0, g: 0, b: 0 })
  const [normalization, setNormalization] = useState<Normalization>('auto')
  const [contrast, setContrast] = useState<Contrast>('none')

  useEffect(() => {
    if (!npyPath) {
      setCube(null)
      setSelectedChannel(0)
      return
    }

    let isMounted = true

    const load = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      try {
        const nextCube = await loadNpy(npyPath)

        if (!isMounted) return

        setCube(nextCube)
        setSelectedChannel(0)
      } catch (err) {
        if (!isMounted) return

        const message = err instanceof Error ? err.message : 'Не удалось загрузить NPY'
        setError(message)
        setCube(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [npyPath])

  const channelCount = cube?.shape?.[2] ?? 0

  const imageDataUrl = useMemo(() => {
    if (!cube) return null
    return extractChannelImageDataUrl(cube, selectedChannel)
  }, [cube, selectedChannel])

  const rgbImageDataUrl = useMemo(() => {
    if (!cube) return null
    let rCh, gCh, bCh
    if (rgbMode === 'standard') {
      // Assume channels are wavelengths from ~400nm to ~1000nm, roughly
      const totalChannels = cube.shape[2]
      // Approximate: 450nm ~ 0.2, 550nm ~ 0.4, 650nm ~ 0.6 of total
      rCh = Math.floor(0.6 * (totalChannels - 1))
      gCh = Math.floor(0.4 * (totalChannels - 1))
      bCh = Math.floor(0.2 * (totalChannels - 1))
    } else {
      rCh = customChannels.r
      gCh = customChannels.g
      bCh = customChannels.b
    }
    return extractRgbImageDataUrl(cube, rCh, gCh, bCh, normalization, contrast)
  }, [cube, rgbMode, customChannels, normalization, contrast])

  return {
    isLoading,
    error,
    cube,
    selectedChannel,
    setSelectedChannel,
    channelCount,
    imageDataUrl,
    rgbMode,
    setRgbMode,
    customChannels,
    setCustomChannels,
    normalization,
    setNormalization,
    contrast,
    setContrast,
    rgbImageDataUrl
  }
}
