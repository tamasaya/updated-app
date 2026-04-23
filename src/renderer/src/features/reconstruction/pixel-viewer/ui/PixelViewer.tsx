import { JSX, useEffect, useMemo, useRef, useState } from 'react'
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

const REGION_THRESHOLD = 3
const WAVELENGTH_START_NM = 400
const WAVELENGTH_END_NM = 700
const MAX_REGION_LINES = 64
const OVERLAY_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#eab308']

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function arrayBufferToPngDataUrl(buffer: ArrayBuffer): string {
  return `data:image/png;base64,${arrayBufferToBase64(buffer)}`
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
  const [draftSelection, setDraftSelection] = useState<DraftSelection>(null)

  const [chartUrl, setChartUrl] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [averageMode, setAverageMode] = useState<'show' | 'hide'>('show')

  const imageFrameRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const requestIdRef = useRef(0)

  useEffect(() => {
    setPoints([])
    setRegions([])
    setDraftSelection(null)
    setChartUrl(null)
    setChartError(null)
    setAverageMode('show')
  }, [npyPath])

  useEffect(() => {
    const element = imageFrameRef.current
    if (!element) return

    const updateSize = () => {
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
        color: OVERLAY_COLORS[index % OVERLAY_COLORS.length]
      })),
      ...regions.map((region, index) => ({
        id: region.id,
        label: `Область ${index + 1} (${region.x1},${region.y1})–(${region.x2},${region.y2})`,
        color: OVERLAY_COLORS[(points.length + index) % OVERLAY_COLORS.length]
      }))
    ]
  }, [points, regions])

  const getSelectionColor = (id: string): string => {
    const item = selectionLegend.find((entry) => entry.id === id)
    return item?.color ?? '#38bdf8'
  }

  const getImageCoords = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const buildChart = async (
    nextPoints: Point[],
    nextRegions: Region[],
    nextShowAverage: boolean
  ) => {
    if (!npyPath || (nextPoints.length === 0 && nextRegions.length === 0)) {
      setChartUrl(null)
      setChartError(null)
      setChartLoading(false)
      return
    }

    const requestId = ++requestIdRef.current
    setChartLoading(true)
    setChartError(null)

    try {
      const result = await window.reconstructionApi.runSeabornChart(npyPath, {
        points: nextPoints.map(({ x, y }) => ({ x, y })),
        regions: nextRegions.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 })),
        showAverage: nextShowAverage,
        wavelengthStartNm: WAVELENGTH_START_NM,
        wavelengthEndNm: WAVELENGTH_END_NM,
        maxRegionLines: MAX_REGION_LINES
      })

      if (requestId !== requestIdRef.current) return

      if (!result?.ok || !result.outputPath) {
        setChartUrl(null)
        setChartError(result?.error ?? 'Не удалось построить график')
        return
      }

      const imageFile = await window.reconstructionApi.readImageFile(result.outputPath)
      if (requestId !== requestIdRef.current) return

      setChartUrl(arrayBufferToPngDataUrl(imageFile.bytes))
      setChartError(null)
    } catch (nextError) {
      if (requestId !== requestIdRef.current) return
      setChartUrl(null)
      setChartError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      if (requestId === requestIdRef.current) {
        setChartLoading(false)
      }
    }
  }

  useEffect(() => {
    void buildChart(points, regions, averageMode === 'show')
  }, [points, regions, averageMode, npyPath])

  const commitDraftSelection = (selection: NonNullable<DraftSelection>) => {
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
      } else {
        setPoints([point])
        setRegions([])
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
    } else {
      setRegions([region])
      setPoints([])
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handlePointerUp = () => {
    if (!draftSelection) return
    commitDraftSelection(draftSelection)
    setDraftSelection(null)
  }

  const handlePointerLeave = () => {
    if (!draftSelection) return
    commitDraftSelection(draftSelection)
    setDraftSelection(null)
  }

  const clearSelection = () => {
    setPoints([])
    setRegions([])
    setDraftSelection(null)
    setChartUrl(null)
    setChartError(null)
    setChartLoading(false)
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

            <div>
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

            <button
              type="button"
              onClick={clearSelection}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              Очистить выделения
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
              <span
                key={item.id}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
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

          <div className="text-xs text-zinc-500">
            Точек: {points.length} · Областей: {regions.length}
          </div>
        </div>

        {points.length === 0 && regions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            Выберите хотя бы одну точку или область на изображении.
          </div>
        ) : chartLoading ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            Построение графика...
          </div>
        ) : chartError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {chartError}
          </div>
        ) : chartUrl ? (
          <img
            src={chartUrl}
            alt="Спектральные графики"
            className="block w-full rounded-xl border border-zinc-200"
          />
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            Нет данных для построения графика.
          </div>
        )}
      </div>
    </div>
  )
}
