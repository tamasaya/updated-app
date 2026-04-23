import { useEffect, useMemo, useState } from 'react'
import { loadNpy, SpectralCube } from '@/shared/lib/npy/loadNpy'

type UsePixelViewerResult = {
  isLoading: boolean
  error: string | null
  cube: SpectralCube | null
  selectedChannel: number
  setSelectedChannel: (value: number) => void
  channelCount: number
  selectedPixel: { x: number; y: number } | null
  setSelectedPixel: (pixel: { x: number; y: number } | null) => void
  selectedRegion: { x1: number; y1: number; x2: number; y2: number } | null
  setSelectedRegion: (region: { x1: number; y1: number; x2: number; y2: number } | null) => void
  pixelValues: number[] | null
  regionValues: { channel: number; mean: number; min: number; max: number }[] | null
  imageDataUrl: string | null
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

  const imageData = new ImageData(pixels, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}

export function usePixelViewer(npyPath: string | null): UsePixelViewerResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cube, setCube] = useState<SpectralCube | null>(null)
  const [selectedChannel, setSelectedChannel] = useState(0)
  const [selectedPixel, setSelectedPixel] = useState<{ x: number; y: number } | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<{
    x1: number
    y1: number
    x2: number
    y2: number
  } | null>(null)

  useEffect(() => {
    if (!npyPath) {
      setCube(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    loadNpy(npyPath)
      .then((loadedCube) => {
        setCube(loadedCube)
        setSelectedChannel(0)
        setSelectedPixel(null)
        setSelectedRegion(null)
      })
      .catch((err) => {
        setError(`Ошибка загрузки NPY: ${err.message}`)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [npyPath])

  const channelCount = cube ? cube.shape[2] : 0

  const imageDataUrl = useMemo(() => {
    if (!cube) return null
    return extractChannelImageDataUrl(cube, selectedChannel)
  }, [cube, selectedChannel])

  const pixelValues = useMemo(() => {
    if (!cube || !selectedPixel) return null
    const [height, width, channels] = cube.shape
    const { x, y } = selectedPixel
    if (x < 0 || x >= width || y < 0 || y >= height) return null

    const values: number[] = []
    for (let c = 0; c < channels; c++) {
      const idx = y * width * channels + x * channels + c
      values.push(Number(cube.data[idx]))
    }
    return values
  }, [cube, selectedPixel])

  const regionValues = useMemo(() => {
    if (!cube || !selectedRegion) return null
    const [height, width, channels] = cube.shape
    const { x1, y1, x2, y2 } = selectedRegion
    const startX = Math.min(x1, x2)
    const endX = Math.max(x1, x2)
    const startY = Math.min(y1, y2)
    const endY = Math.max(y1, y2)

    if (startX < 0 || endX >= width || startY < 0 || endY >= height) return null

    const values: { channel: number; mean: number; min: number; max: number }[] = []

    for (let c = 0; c < channels; c++) {
      let sum = 0
      let count = 0
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const idx = y * width * channels + x * channels + c
          const value = Number(cube.data[idx])
          sum += value
          count++
          if (value < min) min = value
          if (value > max) max = value
        }
      }

      values.push({
        channel: c,
        mean: sum / count,
        min,
        max
      })
    }

    return values
  }, [cube, selectedRegion])

  return {
    isLoading,
    error,
    cube,
    selectedChannel,
    setSelectedChannel: (value) =>
      setSelectedChannel(clamp(value, 0, Math.max(channelCount - 1, 0))),
    channelCount,
    selectedPixel,
    setSelectedPixel,
    selectedRegion,
    setSelectedRegion,
    pixelValues,
    regionValues,
    imageDataUrl
  }
}
