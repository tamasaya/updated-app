import { JSX, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { jsPDF } from 'jspdf'
import { useChannelViewer, RgbMode, Normalization, Contrast } from '../model/useChannelViewer'

type Props = {
  npyPath: string | null
}

const WAVELENGTH_START_NM = 400
const WAVELENGTH_END_NM = 700

function buildAverageSpectrumRows(
  cube: NonNullable<ReturnType<typeof useChannelViewer>['cube']>,
  wavelengthStartNm: number,
  wavelengthEndNm: number
): Array<{ wavelength: number; intensity: number }> {
  const [height, width, channels] = cube.shape
  if (!height || !width || !channels) return []

  const sums = new Array(channels).fill(0)
  const pixelCount = height * width

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels

      for (let c = 0; c < channels; c += 1) {
        sums[c] += Number(cube.data[offset + c])
      }
    }
  }

  return sums.map((sum, index) => {
    const wavelength =
      channels === 1
        ? wavelengthStartNm
        : wavelengthStartNm + (index / (channels - 1)) * (wavelengthEndNm - wavelengthStartNm)

    return {
      wavelength,
      intensity: sum / Math.max(pixelCount, 1)
    }
  })
}

function buildSelectedChannelAverageRows(
  cube: NonNullable<ReturnType<typeof useChannelViewer>['cube']>,
  selectedChannel: number,
  wavelengthStartNm: number,
  wavelengthEndNm: number
): Array<{ wavelength: number; intensity: number }> {
  const [height, width, channels] = cube.shape
  if (!height || !width || !channels) return []

  const safeChannel = Math.max(0, Math.min(selectedChannel, channels - 1))
  const pixelCount = height * width

  let sum = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels
      sum += Number(cube.data[offset + safeChannel])
    }
  }

  const wavelength =
    channels === 1
      ? wavelengthStartNm
      : wavelengthStartNm + (safeChannel / (channels - 1)) * (wavelengthEndNm - wavelengthStartNm)

  return [
    {
      wavelength,
      intensity: sum / Math.max(pixelCount, 1)
    }
  ]
}

function getTimestampForFilename(date: Date): string {
  // Windows-safe ISO-ish string: replace ":" with "-"
  return date.toISOString().slice(0, 19).replaceAll(':', '-')
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function escapeCsvCell(value: string): string {
  const mustQuote = value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')
  if (!mustQuote) return value
  return `"${value.replaceAll('"', '""')}"`
}

function getSvgSize(svgEl: SVGSVGElement): { width: number; height: number } {
  const rect = svgEl.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height }

  const viewBox = svgEl.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map((v) => Number(v))
    // "minX minY width height"
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] }
    }
  }

  const widthAttr = Number(svgEl.getAttribute('width') ?? 0)
  const heightAttr = Number(svgEl.getAttribute('height') ?? 0)
  if (widthAttr > 0 && heightAttr > 0) return { width: widthAttr, height: heightAttr }

  return { width: 800, height: 360 }
}

async function renderSvgToCanvas(svgEl: SVGSVGElement, scale: number): Promise<HTMLCanvasElement> {
  const size = getSvgSize(svgEl)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is not available')

  canvas.width = Math.max(1, Math.round(size.width * scale))
  canvas.height = Math.max(1, Math.round(size.height * scale))

  const cloned = svgEl.cloneNode(true) as SVGSVGElement
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  const serialized = new XMLSerializer().serializeToString(cloned)
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`

  const img = new Image()
  img.decoding = 'async'

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load serialized SVG'))
    img.src = svgDataUrl
  })

  // Ensure white background for PNG/PDF
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas
}

async function exportSvgAsPng(svgEl: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const canvas = await renderSvgToCanvas(svgEl, scale)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
  if (blob) {
    downloadBlob(blob, filename)
    return
  }

  const dataUrl = canvas.toDataURL('image/png')
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function exportSvgAsPdf(svgEl: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const canvas = await renderSvgToCanvas(svgEl, scale)
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const padding = 16

  const imgW = canvas.width
  const imgH = canvas.height
  const imgAspect = imgW / Math.max(1, imgH)

  let renderW = pageW - padding * 2
  let renderH = renderW / imgAspect

  if (renderH > pageH - padding * 2) {
    renderH = pageH - padding * 2
    renderW = renderH * imgAspect
  }

  const x = (pageW - renderW) / 2
  const y = (pageH - renderH) / 2

  pdf.addImage(imgData, 'PNG', x, y, renderW, renderH)
  pdf.save(filename)
}

export function ChannelViewer({ npyPath }: Props): JSX.Element {
  const {
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
  } = useChannelViewer(npyPath)

  const [showWholeCubeSpectrum, setShowWholeCubeSpectrum] = useState(true)

  const spectrumRows = useMemo(() => {
    if (!cube) return []

    if (showWholeCubeSpectrum) {
      return buildAverageSpectrumRows(cube, WAVELENGTH_START_NM, WAVELENGTH_END_NM)
    }

    return buildSelectedChannelAverageRows(
      cube,
      selectedChannel,
      WAVELENGTH_START_NM,
      WAVELENGTH_END_NM
    )
  }, [cube, selectedChannel, showWholeCubeSpectrum])

  const chartContainerRef = useRef<HTMLDivElement>(null)

  const handleExportPng = async (): Promise<void> => {
    if (!spectrumRows.length) return
    const svgEl = chartContainerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return

    const filename = `channel-viewer-graph-${getTimestampForFilename(new Date())}.png`
    await exportSvgAsPng(svgEl, filename, 2)
  }

  const handleExportPdf = async (): Promise<void> => {
    if (!spectrumRows.length) return
    const svgEl = chartContainerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return

    const filename = `channel-viewer-graph-${getTimestampForFilename(new Date())}.pdf`
    await exportSvgAsPdf(svgEl, filename, 2)
  }

  const handleExportCsv = (): void => {
    if (!spectrumRows.length) return

    const filename = `channel-viewer-graph-${getTimestampForFilename(new Date())}.csv`
    const header = ['wavelength_nm', 'intensity'].join(',')

    const lines = spectrumRows.map((row) => {
      const wavelength = escapeCsvCell(String(row.wavelength))
      const intensity = escapeCsvCell(String(row.intensity))
      return `${wavelength},${intensity}`
    })

    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, filename)
  }

  if (!npyPath) {
    return <div className="text-sm text-zinc-500">Сначала запустите реконструкцию.</div>
  }

  if (isLoading) {
    return <div className="text-sm text-zinc-500">Загрузка .npy...</div>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!cube) {
    return <div className="text-sm text-zinc-500">Данные не загружены.</div>
  }

  const [height, width, channels] = cube.shape

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              <div>
                Размер: {width} × {height}
              </div>
              <div>Каналов: {channels}</div>
              <div>Текущий канал: {selectedChannel}</div>
            </div>

            <div className="space-y-2">
              <label htmlFor="channel-range" className="block text-sm font-medium text-zinc-800">
                Индекс канала
              </label>

              <input
                id="channel-range"
                type="range"
                min={0}
                max={Math.max(channelCount - 1, 0)}
                step={1}
                value={selectedChannel}
                onChange={(event) => setSelectedChannel(Number(event.target.value))}
                className="w-full"
              />

              <input
                type="number"
                min={0}
                max={Math.max(channelCount - 1, 0)}
                value={selectedChannel}
                onChange={(event) => setSelectedChannel(Number(event.target.value))}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="h-15" />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-800">Спектральный канал</h3>

            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt={`Канал ${selectedChannel}`}
                className="max-h-[520px] w-full rounded-lg border border-zinc-200 bg-white object-contain"
              />
            ) : (
              <div className="text-sm text-zinc-500">Не удалось построить карту интенсивности.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-800">Псевдо-RGB представление</h3>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-800">Режим</label>
              <select
                value={rgbMode}
                onChange={(e) => setRgbMode(e.target.value as RgbMode)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="standard">Стандартный (R≈650, G≈550, B≈450 нм)</option>
                <option value="custom">Пользовательский выбор</option>
              </select>
            </div>

            {rgbMode === 'custom' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-600">R канал</label>
                  <input
                    type="number"
                    min={0}
                    max={channelCount - 1}
                    value={customChannels.r}
                    onChange={(e) =>
                      setCustomChannels({ ...customChannels, r: Number(e.target.value) })
                    }
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-600">G канал</label>
                  <input
                    type="number"
                    min={0}
                    max={channelCount - 1}
                    value={customChannels.g}
                    onChange={(e) =>
                      setCustomChannels({ ...customChannels, g: Number(e.target.value) })
                    }
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-600">B канал</label>
                  <input
                    type="number"
                    min={0}
                    max={channelCount - 1}
                    value={customChannels.b}
                    onChange={(e) =>
                      setCustomChannels({ ...customChannels, b: Number(e.target.value) })
                    }
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">Нормализация</label>
                <select
                  value={normalization}
                  onChange={(e) => setNormalization(e.target.value as Normalization)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="auto">Авто</option>
                  <option value="fixed">Фиксированная</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">Контраст</label>
                <select
                  value={contrast}
                  onChange={(e) => setContrast(e.target.value as Contrast)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="none">Без усиления</option>
                  <option value="gamma">Гамма коррекция</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-800">Псевдо-RGB</h3>

            {rgbImageDataUrl ? (
              <img
                src={rgbImageDataUrl}
                alt="Псевдо-RGB"
                className="max-h-[520px] w-full rounded-lg border border-zinc-200 bg-white object-contain"
              />
            ) : (
              <div className="text-sm text-zinc-500">Не удалось построить RGB изображение.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-800">График спектра</h3>
            <p className="mt-1 text-sm text-zinc-600">
              {showWholeCubeSpectrum
                ? 'Средний спектр по всему спектральному кубу'
                : `Средняя интенсивность для выбранного канала ${selectedChannel}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportPng()}
              disabled={!spectrumRows.length}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              PNG
            </button>
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={!spectrumRows.length}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!spectrumRows.length}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              CSV
            </button>
          </div>
        </div>

        {spectrumRows.length ? (
          <div ref={chartContainerRef} className="h-[360px] rounded-xl border border-zinc-200 bg-white p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spectrumRows} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
                <XAxis
                  dataKey="wavelength"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${Math.round(Number(value))} нм`}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [Number(value).toFixed(6), 'Интенсивность']}
                  labelFormatter={(label) => `${Math.round(Number(label))} нм`}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e4e4e7',
                    backgroundColor: '#ffffff'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="intensity"
                  stroke="#111827"
                  strokeWidth={2.5}
                  dot={showWholeCubeSpectrum ? false : { r: 5, fill: '#111827' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-sm text-zinc-500">
            Нет данных для построения среднего спектра.
          </div>
        )}
      </div>
    </div>
  )
}
