import { useEffect, useMemo, useState } from 'react'
import { loadNpy, SpectralCube } from '@/shared/lib/npy/loadNpy'

type UsePixelViewerResult = {
  isLoading: boolean
  error: string | null
  cube: SpectralCube | null
  selectedChannel: number
  setSelectedChannel: (value: number) => void
  channelCount: number
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

  useEffect(() => {
    if (!npyPath) {
      setCube(null)
      setError(null)
      setSelectedChannel(0)
      return
    }

    setIsLoading(true)
    setError(null)

    loadNpy(npyPath)
      .then((loadedCube) => {
        setCube(loadedCube)
        setSelectedChannel(0)
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

  return {
    isLoading,
    error,
    cube,
    selectedChannel,
    setSelectedChannel: (value) =>
      setSelectedChannel(clamp(value, 0, Math.max(channelCount - 1, 0))),
    channelCount,
    imageDataUrl
  }
}
