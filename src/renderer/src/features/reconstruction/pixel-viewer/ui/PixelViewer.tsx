import { JSX, useEffect, useMemo, useRef, useState } from 'react'
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
import { usePixelViewer } from '../model/usePixelViewer'

type Props = {
  npyPath: string | null
}

type Point = {
  id: string
  x: number
  y: number
}

type Region = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

type DraftSelection = {
  startX: number
  startY: number
  currentX: number
  currentY: number
  additive: boolean
} | null

type SeriesKind = 'point' | 'region-sample' | 'region-mean' | 'global-mean'

type Series = {
  id: string
  label: string
  color: string
  values: number[]
  kind: SeriesKind
  strokeWidth: number
  strokeOpacity: number
  showInTooltip: boolean
  showInLegend: boolean
  strokeDasharray?: string
}

type TableRow = {
  id: string
  sourceId: string
  sourceLabel: string
  sourceColor: string
  values: number[]
  comment: string
}

const REGION_THRESHOLD = 3
const WAVELENGTH_START_NM = 400
const WAVELENGTH_END_NM = 700
const MAX_REGION_LINES = 64

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function buildWavelengths(channelCount: number): number[] {
  if (channelCount <= 1) return [WAVELENGTH_START_NM]

  return Array.from({ length: channelCount }, (_, index) => {
    const ratio = index / (channelCount - 1)
    return WAVELENGTH_START_NM + ratio * (WAVELENGTH_END_NM - WAVELENGTH_START_NM)
  })
}

function getRegionMeanSpectrum(
  cube: NonNullable<ReturnType<typeof usePixelViewer>['cube']>,
  region: Region
): number[] {
  const [, width, channels] = cube.shape
  const sums = new Array(channels).fill(0)

  let count = 0

  for (let y = region.y1; y <= region.y2; y += 1) {
    for (let x = region.x1; x <= region.x2; x += 1) {
      const offset = (y * width + x) * channels

      for (let c = 0; c < channels; c += 1) {
        sums[c] += Number(cube.data[offset + c])
      }

      count += 1
    }
  }

  if (count === 0) {
    return new Array(channels).fill(0)
  }

  for (let c = 0; c < channels; c += 1) {
    sums[c] /= count
  }

  return sums
}

function getSpectrumAtPoint(
  cube: NonNullable<ReturnType<typeof usePixelViewer>['cube']>,
  x: number,
  y: number
): number[] {
  const [height, width, channels] = cube.shape
  if (!height || !width || !channels) return []

  const safeX = clamp(x, 0, width - 1)
  const safeY = clamp(y, 0, height - 1)
  const offset = (safeY * width + safeX) * channels

  return Array.from({ length: channels }, (_, channelIndex) =>
    Number(cube.data[offset + channelIndex])
  )
}

function averageSpectra(spectra: number[][]): number[] {
  if (spectra.length === 0) return []

  const channelCount = spectra[0].length
  const result = new Array(channelCount).fill(0)

  for (const spectrum of spectra) {
    for (let i = 0; i < channelCount; i += 1) {
      result[i] += spectrum[i] ?? 0
    }
  }

  for (let i = 0; i < channelCount; i += 1) {
    result[i] /= spectra.length
  }

  return result
}

function sampleRegionPoints(region: Region, maxPoints: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []

  for (let y = region.y1; y <= region.y2; y += 1) {
    for (let x = region.x1; x <= region.x2; x += 1) {
      points.push({ x, y })
    }
  }

  if (points.length <= maxPoints) {
    return points
  }

  const step = Math.ceil(points.length / maxPoints)
  return points.filter((_, index) => index % step === 0)
}

function buildChartRows(wavelengths: number[], series: Series[]): Record<string, number>[] {
  return wavelengths.map((wavelength, index) => {
    const row: Record<string, number> = { wavelength }

    for (const line of series) {
      row[line.id] = line.values[index] ?? 0
    }

    return row
  })
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

  return { width: 800, height: 420 }
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

  // Some charts rely on styles computed by the browser; serializing SVG directly is usually enough for Recharts.
  const serialized = new XMLSerializer().serializeToString(cloned)
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`

  const img = new Image()
  img.decoding = 'async'

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load serialized SVG'))
    img.src = svgDataUrl
  })

  // Ensure white background (PDF/PNG viewers usually expect it)
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

const POINT_COLORS = ['#0ea5e9', '#f97316', '#ef4444', '#14b8a6', '#eab308']
const REGION_COLORS = ['#22c55e', '#a855f7', '#ec4899', '#84cc16', '#06b6d4']
const GLOBAL_MEAN_COLOR = '#111827'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean

  const value = Number.parseInt(full, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  }
}

function mixWithWhite(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)

  const mixedR = Math.round(r + (255 - r) * amount)
  const mixedG = Math.round(g + (255 - g) * amount)
  const mixedB = Math.round(b + (255 - b) * amount)

  return `rgb(${mixedR}, ${mixedG}, ${mixedB})`
}

export function PixelViewer({ npyPath }: Props): JSX.Element {
  const {
    isLoading,
    error,
    cube,
    selectedChannel,
    setSelectedChannel,
    channelCount,
    imageDataUrl
  } = usePixelViewer(npyPath)

  const [points, setPoints] = useState<Point[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [enabledSelectionIds, setEnabledSelectionIds] = useState<Set<string>>(() => new Set())
  const [tableRows, setTableRows] = useState<TableRow[]>([])
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    selectionId: string
  } | null>(null)
  const [draftSelection, setDraftSelection] = useState<DraftSelection>(null)
  const [averageMode, setAverageMode] = useState<'show' | 'hide'>('show')

  const imageFrameRef = useRef<HTMLDivElement>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    setPoints([])
    setRegions([])
    setEnabledSelectionIds(new Set())
    setTableRows([])
    setContextMenu(null)
    setDraftSelection(null)
    setAverageMode('show')
  }, [npyPath])

  useEffect(() => {
    const element = imageFrameRef.current
    if (!element) return

    const updateSize = (): void => {
      setFrameSize({
        width: element.clientWidth,
        height: element.clientHeight
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [imageDataUrl, cube])

  useEffect(() => {
    const closeContextMenu = (): void => setContextMenu(null)
    window.addEventListener('click', closeContextMenu)
    window.addEventListener('contextmenu', closeContextMenu)
    window.addEventListener('scroll', closeContextMenu, true)

    return () => {
      window.removeEventListener('click', closeContextMenu)
      window.removeEventListener('contextmenu', closeContextMenu)
      window.removeEventListener('scroll', closeContextMenu, true)
    }
  }, [])

  const [height, width, channels] = cube?.shape ?? [0, 0, 0]

  const pixelScale = useMemo(() => {
    if (!cube || !frameSize.width || !frameSize.height || !width || !height) {
      return null
    }

    return {
      x: frameSize.width / width,
      y: frameSize.height / height
    }
  }, [cube, frameSize.width, frameSize.height, width, height])

  const selectionLegend = useMemo(() => {
    return [
      ...points.map((point, index) => ({
        id: point.id,
        label: `Точка ${index + 1} (${point.x}, ${point.y})`,
        color: POINT_COLORS[index % POINT_COLORS.length]
      })),
      ...regions.map((region, index) => ({
        id: region.id,
        label: `Область ${index + 1} (${region.x1},${region.y1})–(${region.x2},${region.y2})`,
        color: REGION_COLORS[index % REGION_COLORS.length]
      }))
    ]
  }, [points, regions])

  const getSelectionColor = (id: string): string => {
    const item = selectionLegend.find((entry) => entry.id === id)
    return item?.color ?? '#38bdf8'
  }

  const enabledPointsCount = points.reduce(
    (acc, point) => acc + (enabledSelectionIds.has(point.id) ? 1 : 0),
    0
  )

  const enabledRegionsCount = regions.reduce(
    (acc, region) => acc + (enabledSelectionIds.has(region.id) ? 1 : 0),
    0
  )

  const toggleSelection = (id: string): void => {
    setEnabledSelectionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getImageCoords = (event: React.PointerEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = imageFrameRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0 || rect.height === 0 || !width || !height) {
      return { x: 0, y: 0 }
    }

    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top

    return {
      x: clamp(Math.floor((localX / rect.width) * width), 0, width - 1),
      y: clamp(Math.floor((localY / rect.height) * height), 0, height - 1)
    }
  }

  const commitDraftSelection = (selection: NonNullable<DraftSelection>): void => {
    const dx = Math.abs(selection.currentX - selection.startX)
    const dy = Math.abs(selection.currentY - selection.startY)

    if (dx <= REGION_THRESHOLD && dy <= REGION_THRESHOLD) {
      const point: Point = {
        id: createId('point'),
        x: selection.startX,
        y: selection.startY
      }

      if (selection.additive) {
        setPoints((prev) => [...prev, point])
        setEnabledSelectionIds((prev) => {
          const next = new Set(prev)
          next.add(point.id)
          return next
        })
      } else {
        setPoints([point])
        setRegions([])
        setEnabledSelectionIds(new Set([point.id]))
      }

      return
    }

    const region: Region = {
      id: createId('region'),
      x1: Math.min(selection.startX, selection.currentX),
      y1: Math.min(selection.startY, selection.currentY),
      x2: Math.max(selection.startX, selection.currentX),
      y2: Math.max(selection.startY, selection.currentY)
    }

    if (selection.additive) {
      setRegions((prev) => [...prev, region])
      setEnabledSelectionIds((prev) => {
        const next = new Set(prev)
        next.add(region.id)
        return next
      })
    } else {
      setRegions([region])
      setPoints([])
      setEnabledSelectionIds(new Set([region.id]))
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()

    const point = getImageCoords(event)
    setDraftSelection({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      additive: event.ctrlKey || event.metaKey
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!draftSelection) return

    event.preventDefault()
    const point = getImageCoords(event)

    setDraftSelection((prev) =>
      prev
        ? {
            ...prev,
            currentX: point.x,
            currentY: point.y
          }
        : prev
    )
  }

  const handlePointerUp = (): void => {
    if (!draftSelection) return
    commitDraftSelection(draftSelection)
    setDraftSelection(null)
  }

  const handlePointerLeave = (): void => {
    if (!draftSelection) return
    commitDraftSelection(draftSelection)
    setDraftSelection(null)
  }

  const clearSelection = (): void => {
    setPoints([])
    setRegions([])
    setEnabledSelectionIds(new Set())
    setContextMenu(null)
    setDraftSelection(null)
  }

  const handleLegendContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    selectionId: string
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      selectionId
    })
  }

  const addSelectionToTable = (selectionId: string): void => {
    if (!cube) return

    const point = points.find((entry) => entry.id === selectionId)
    const region = regions.find((entry) => entry.id === selectionId)
    const legendItem = selectionLegend.find((entry) => entry.id === selectionId)
    if (!legendItem) return

    let values: number[] | null = null
    let sourceLabel = legendItem.label

    if (point) {
      values = getSpectrumAtPoint(cube, point.x, point.y)
      sourceLabel = `${legendItem.label} (точка)`
    } else if (region) {
      values = getRegionMeanSpectrum(cube, region)
      sourceLabel = `${legendItem.label} (средняя области)`
    }

    if (!values || values.length === 0) return

    const nextRow: TableRow = {
      id: createId('table-row'),
      sourceId: selectionId,
      sourceLabel,
      sourceColor: legendItem.color,
      values,
      comment: ''
    }

    setTableRows((prev) => [...prev, nextRow])
    setContextMenu(null)
  }

  const handleCommentChange = (rowId: string, value: string): void => {
    setTableRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, comment: value } : row))
    )
  }

  const chartModel = useMemo(() => {
    if (!cube) return null

    const enabledPoints = points.filter((point) => enabledSelectionIds.has(point.id))
    const enabledRegions = regions.filter((region) => enabledSelectionIds.has(region.id))

    if (enabledPoints.length === 0 && enabledRegions.length === 0) return null

    const wavelengths = buildWavelengths(channels)

    const pointSeries: Series[] = enabledPoints.map((point, index) => {
      const baseColor = POINT_COLORS[index % POINT_COLORS.length]

      return {
        id: point.id,
        label: `Точка ${index + 1} (${point.x}, ${point.y})`,
        color: baseColor,
        values: getSpectrumAtPoint(cube, point.x, point.y),
        kind: 'point',
        strokeWidth: 1.5,
        strokeOpacity: 0.95,
        showInTooltip: true,
        showInLegend: false
      }
    })

    const regionSampleSeries: Series[] = enabledRegions.flatMap((region, regionIndex) => {
      const sampledPoints = sampleRegionPoints(region, MAX_REGION_LINES)
      const baseColor = REGION_COLORS[regionIndex % REGION_COLORS.length]
      const sampleColor = mixWithWhite(baseColor, 0.45)

      return sampledPoints.map((point, pointIndex) => ({
        id: `${region.id}-sample-${pointIndex}`,
        label: `Область ${regionIndex + 1} · P${pointIndex + 1}`,
        color: sampleColor,
        values: getSpectrumAtPoint(cube, point.x, point.y),
        kind: 'region-sample' as const,
        strokeWidth: 1,
        strokeOpacity: 0.7,
        showInTooltip: false,
        showInLegend: false
      }))
    })

    const regionMeanSeries: Series[] = enabledRegions.map((region, regionIndex) => {
      const baseColor = REGION_COLORS[regionIndex % REGION_COLORS.length]

      return {
        id: `${region.id}-mean`,
        label: `Средняя области ${regionIndex + 1}`,
        color: baseColor,
        values: getRegionMeanSpectrum(cube, region),
        kind: 'region-mean',
        strokeWidth: 3,
        strokeOpacity: 1,
        showInTooltip: true,
        showInLegend: true
      }
    })

    const shouldShowGlobalMean =
      averageMode === 'show' && enabledPoints.length > 0 && enabledRegions.length === 0

    const globalMeanSeries: Series[] = shouldShowGlobalMean
      ? [
          {
            id: 'global-mean',
            label: 'Средняя всех точек',
            color: GLOBAL_MEAN_COLOR,
            values: averageSpectra(pointSeries.map((item) => item.values)),
            kind: 'global-mean',
            strokeWidth: 3,
            strokeOpacity: 1,
            showInTooltip: true,
            showInLegend: true
          }
        ]
      : []

    const allSeries = [
      ...pointSeries,
      ...regionSampleSeries,
      ...regionMeanSeries,
      ...globalMeanSeries
    ]

    return {
      rows: buildChartRows(wavelengths, allSeries),
      series: allSeries
    }
  }, [cube, points, regions, enabledSelectionIds, averageMode, channels])

  const handleExportPng = async (): Promise<void> => {
    if (!chartModel) return
    const svgEl = chartContainerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return

    const filename = `pixel-viewer-graph-${getTimestampForFilename(new Date())}.png`
    await exportSvgAsPng(svgEl, filename, 2)
  }

  const handleExportPdf = async (): Promise<void> => {
    if (!chartModel) return
    const svgEl = chartContainerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return

    const filename = `pixel-viewer-graph-${getTimestampForFilename(new Date())}.pdf`
    await exportSvgAsPdf(svgEl, filename, 2)
  }

  const handleExportCsv = (): void => {
    if (!chartModel) return

    const stamp = getTimestampForFilename(new Date())
    const filename = `pixel-viewer-graph-${stamp}.csv`

    const series = chartModel.series
    const columns: Array<{ key: string; label: string }> = [
      { key: 'wavelength', label: 'wavelength_nm' },
      ...series.map((s) => ({ key: s.id, label: s.label }))
    ]

    const header = columns.map((c) => escapeCsvCell(c.label)).join(',')
    const lines = chartModel.rows.map((row) => {
      const wavelength = Number((row as Record<string, number>).wavelength)
      const cells = columns.map((c) => {
        if (c.key === 'wavelength') return escapeCsvCell(String(wavelength))
        const value = Number((row as Record<string, number>)[c.key] ?? 0)
        return escapeCsvCell(String(value))
      })
      return cells.join(',')
    })

    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, filename)
  }

  const selectedRects =
    pixelScale &&
    regions.map((region) => ({
      id: region.id,
      left: region.x1 * pixelScale.x,
      top: region.y1 * pixelScale.y,
      width: Math.max((region.x2 - region.x1 + 1) * pixelScale.x, 1),
      height: Math.max((region.y2 - region.y1 + 1) * pixelScale.y, 1)
    }))

  const pointDots =
    pixelScale &&
    points.map((point, index) => ({
      id: point.id,
      label: index + 1,
      left: point.x * pixelScale.x,
      top: point.y * pixelScale.y,
      color: getSelectionColor(point.id)
    }))

  const draftRect =
    pixelScale && draftSelection
      ? {
          left: Math.min(draftSelection.startX, draftSelection.currentX) * pixelScale.x,
          top: Math.min(draftSelection.startY, draftSelection.currentY) * pixelScale.y,
          width:
            Math.max(Math.abs(draftSelection.currentX - draftSelection.startX) + 1, 1) *
            pixelScale.x,
          height:
            Math.max(Math.abs(draftSelection.currentY - draftSelection.startY) + 1, 1) *
            pixelScale.y
        }
      : null

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

  const hasAnySelection = points.length > 0 || regions.length > 0
  const wavelengthColumns = buildWavelengths(channels)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div>
            Размер: {width} × {height}
          </div>
          <div>Каналов: {channels}</div>
          <div>Выбранный канал: {selectedChannel}</div>

          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="channel-range"
                className="mb-1 block text-sm font-medium text-zinc-800"
              >
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
                className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={clearSelection}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              Очистить
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-white p-3 text-xs leading-6 text-zinc-500">
            Клик — одна точка.
            <br />
            Ctrl + клик — добавить точку.
            <br />
            Drag — выбрать область.
            <br />
            Ctrl + drag — добавить область.
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Изображение канала</h3>

          <div className="overflow-auto rounded-xl border border-zinc-200 bg-white p-2">
            {imageDataUrl ? (
              <div
                ref={imageFrameRef}
                className="relative w-full cursor-crosshair touch-none select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
              >
                <img
                  src={imageDataUrl}
                  alt={`Канал ${selectedChannel}`}
                  draggable={false}
                  className="block w-full"
                  style={{ imageRendering: 'pixelated' }}
                />

                {selectedRects &&
                  selectedRects.map((rect) => (
                    <div
                      key={rect.id}
                      className="pointer-events-none absolute border-2 border-dashed"
                      style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        borderColor: getSelectionColor(rect.id),
                        backgroundColor: `${getSelectionColor(rect.id)}22`
                      }}
                    />
                  ))}

                {pointDots &&
                  pointDots.map((point) => (
                    <div
                      key={point.id}
                      className="pointer-events-none absolute"
                      style={{
                        left: point.left - 5,
                        top: point.top - 5
                      }}
                    >
                      <div
                        className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: point.color }}
                      />
                    </div>
                  ))}

                {draftRect && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10"
                    style={draftRect}
                  />
                )}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Не удалось построить карту интенсивности.</div>
            )}
          </div>
        </div>
      </div>

      {selectionLegend.length ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-zinc-900">Текущие выделения</div>

          <div className="flex flex-wrap gap-2">
            {selectionLegend.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleSelection(item.id)}
                onContextMenu={(event) => handleLegendContextMenu(event, item.id)}
                aria-pressed={enabledSelectionIds.has(item.id)}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                  enabledSelectionIds.has(item.id)  
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                    : 'border-zinc-200 bg-zinc-100 text-zinc-400 opacity-70'
                ].join(' ')}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className={enabledSelectionIds.has(item.id) ? '' : 'line-through'}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className="fixed z-50 min-w-56 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => addSelectionToTable(contextMenu.selectionId)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            Добавить данные в таблицу
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Спектральные графики</h3>
            <p className="mt-1 text-xs text-zinc-500">
              График перестраивается автоматически при выборе точек и областей
            </p>
          </div>

          <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
              <label className="mb-1 block text-sm font-medium text-zinc-800">
                Усреднённая линия
              </label>

              <select
                value={averageMode}
                onChange={(event) => setAverageMode(event.target.value as 'show' | 'hide')}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="show">Показывать</option>
                <option value="hide">Скрывать</option>
              </select>
            </div>
            <div className="text-xs text-zinc-500">
              Точек: {enabledPointsCount} · Областей: {enabledRegionsCount}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportPng()}
                disabled={!chartModel}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                PNG
              </button>
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={!chartModel}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!chartModel}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                CSV
              </button>
            </div>
          </div>
        </div>

        {!chartModel ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            {hasAnySelection
              ? 'Ни одно выделение не включено. Включите хотя бы одну точку или область.'
              : 'Выберите хотя бы одну точку или область на изображении.'}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div ref={chartContainerRef} className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartModel.rows}
                  margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid stroke="#e4e4e7" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="wavelength"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${Math.round(value)} nm`}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !chartModel) return null

                      const visibleItems = payload
                        .map((item) => {
                          const series = chartModel.series.find(
                            (entry) => entry.id === item.dataKey
                          )
                          if (!series || !series.showInTooltip) return null

                          return {
                            label: series.label,
                            color: series.color,
                            value: Number(item.value)
                          }
                        })
                        .filter(Boolean) as Array<{ label: string; color: string; value: number }>

                      if (!visibleItems.length) return null

                      return (
                        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                          <div className="text-xs text-zinc-500">
                            {Math.round(Number(label))} нм
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {visibleItems.map((item) => (
                              <div key={item.label} className="flex items-center gap-2 text-sm">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-zinc-700">{item.label}:</span>
                                <span className="font-medium text-zinc-900">
                                  {item.value.toFixed(6)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }}
                  />

                  {chartModel.series.map((series) => (
                    <Line
                      key={series.id}
                      type="monotone"
                      dataKey={series.id}
                      stroke={series.color}
                      strokeWidth={series.strokeWidth}
                      strokeOpacity={series.strokeOpacity}
                      strokeDasharray={series.strokeDasharray}
                      dot={false}
                      activeDot={series.showInTooltip ? { r: 3 } : false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-zinc-900">Таблица данных</h3>
          <p className="mt-1 text-xs text-zinc-500">
            ПКМ по выделению → добавить точку или среднюю линии области в таблицу
          </p>
        </div>

        {!tableRows.length ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
            Таблица пустая. Добавьте строки через контекстное меню по правому клику на выделении.
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-200">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="w-44 border-b border-zinc-200 px-3 py-2 text-left font-semibold">№</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-left font-semibold">
                    Комментарий
                  </th>
                  {wavelengthColumns.map((wavelength, index) => (
                    <th
                      key={`wl-${index}`}
                      className="border-b border-zinc-200 px-2 py-2 text-right font-semibold whitespace-nowrap"
                    >
                      {Math.round(wavelength)} нм
                    </th> 
                  ))}
                </tr>
              </thead>

              <tbody>
                {tableRows.map((row, rowIndex) => (
                  <tr key={row.id} className="odd:bg-white even:bg-zinc-50/40">
                    <td className="w-44 border-b border-zinc-100 px-3 py-2 align-top text-zinc-700">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm border border-zinc-300"
                          style={{ backgroundColor: row.sourceColor }}
                        />
                        <span className="font-medium">{rowIndex + 1}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">{row.sourceLabel}</div>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2 align-top">
                      <input
                        value={row.comment}
                        onChange={(event) => handleCommentChange(row.id, event.target.value)}
                        placeholder="Введите комментарий"
                        className="w-56 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                      />
                    </td>
                    {wavelengthColumns.map((_, index) => (
                      <td
                        key={`${row.id}-val-${index}`}
                        className="border-b border-zinc-100 px-2 py-2 text-right text-zinc-700 whitespace-nowrap"
                      >
                        {(row.values[index] ?? 0).toFixed(6)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
