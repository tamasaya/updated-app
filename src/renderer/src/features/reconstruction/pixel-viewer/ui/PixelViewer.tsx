import { JSX, useEffect, useMemo, useRef, useState } from 'react'
import { usePixelViewer } from '../model/usePixelViewer'

type Props = {
  npyPath: string | null
}

type Point = {
  x: number
  y: number
}

type Region = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function PixelViewer({ npyPath }: Props): JSX.Element {
  const {
    isLoading,
    error,
    cube,
    selectedChannel,
    setSelectedChannel,
    channelCount,
    selectedPixel,
    setSelectedPixel,
    selectedRegion,
    setSelectedRegion,
    pixelValues,
    regionValues,
    imageDataUrl
  } = usePixelViewer(npyPath)

  const [pixelX, setPixelX] = useState('')
  const [pixelY, setPixelY] = useState('')
  const [regionX1, setRegionX1] = useState('')
  const [regionY1, setRegionY1] = useState('')
  const [regionX2, setRegionX2] = useState('')
  const [regionY2, setRegionY2] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragEnd, setDragEnd] = useState<Point | null>(null)
  const imageFrameRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (selectedPixel) {
      setPixelX(selectedPixel.x.toString())
      setPixelY(selectedPixel.y.toString())
    }
  }, [selectedPixel])

  useEffect(() => {
    if (selectedRegion) {
      setRegionX1(selectedRegion.x1.toString())
      setRegionY1(selectedRegion.y1.toString())
      setRegionX2(selectedRegion.x2.toString())
      setRegionY2(selectedRegion.y2.toString())
    }
  }, [selectedRegion])

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

    const observer = new ResizeObserver(() => {
      updateSize()
    })

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
  }, [cube, frameSize.height, frameSize.width, height, width])

  const clampPoint = (point: Point): Point => ({
    x: Math.max(0, Math.min(point.x, Math.max(width - 1, 0))),
    y: Math.max(0, Math.min(point.y, Math.max(height - 1, 0)))
  })

  const clearPixelInputs = () => {
    setPixelX('')
    setPixelY('')
  }

  const clearRegionInputs = () => {
    setRegionX1('')
    setRegionY1('')
    setRegionX2('')
    setRegionY2('')
  }

  const applyPixelSelection = (point: Point) => {
    const nextPoint = clampPoint(point)
    setSelectedPixel(nextPoint)
    setSelectedRegion(null)
    setPixelX(nextPoint.x.toString())
    setPixelY(nextPoint.y.toString())
    clearRegionInputs()
  }

  const applyRegionSelection = (region: Region) => {
    const start = clampPoint({
      x: Math.min(region.x1, region.x2),
      y: Math.min(region.y1, region.y2)
    })
    const end = clampPoint({ x: Math.max(region.x1, region.x2), y: Math.max(region.y1, region.y2) })

    const nextRegion = {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    }

    setSelectedRegion(nextRegion)
    setSelectedPixel(null)
    setRegionX1(nextRegion.x1.toString())
    setRegionY1(nextRegion.y1.toString())
    setRegionX2(nextRegion.x2.toString())
    setRegionY2(nextRegion.y2.toString())
    clearPixelInputs()
  }

  const getImageCoords = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const rect = imageFrameRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0 || rect.height === 0 || !width || !height) {
      return { x: 0, y: 0 }
    }

    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top

    return clampPoint({
      x: Math.floor((localX / rect.width) * width),
      y: Math.floor((localY / rect.height) * height)
    })
  }

  const getOverlayRect = (start: Point, end: Point) => {
    if (!pixelScale) return null

    const minX = Math.min(start.x, end.x)
    const minY = Math.min(start.y, end.y)
    const maxX = Math.max(start.x, end.x)
    const maxY = Math.max(start.y, end.y)

    return {
      left: minX * pixelScale.x,
      top: minY * pixelScale.y,
      width: Math.max((maxX - minX + 1) * pixelScale.x, 1),
      height: Math.max((maxY - minY + 1) * pixelScale.y, 1)
    }
  }

  const selectedPixelRect =
    selectedPixel && pixelScale ? getOverlayRect(selectedPixel, selectedPixel) : null
  const selectedRegionRect =
    selectedRegion && pixelScale
      ? getOverlayRect(
          { x: selectedRegion.x1, y: selectedRegion.y1 },
          { x: selectedRegion.x2, y: selectedRegion.y2 }
        )
      : null
  const draggingRect =
    dragStart && dragEnd && pixelScale ? getOverlayRect(dragStart, dragEnd) : null

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const point = getImageCoords(event)
    setIsDragging(true)
    setDragStart(point)
    setDragEnd(point)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStart) return

    event.preventDefault()
    setDragEnd(getImageCoords(event))
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !dragEnd) {
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
      return
    }

    event.preventDefault()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setIsDragging(false)

    if (dragStart.x === dragEnd.x && dragStart.y === dragEnd.y) {
      applyPixelSelection(dragEnd)
    } else {
      applyRegionSelection({
        x1: dragStart.x,
        y1: dragStart.y,
        x2: dragEnd.x,
        y2: dragEnd.y
      })
    }

    setDragStart(null)
    setDragEnd(null)
  }

  const cancelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  const handleSetPixel = () => {
    const x = Number.parseInt(pixelX, 10)
    const y = Number.parseInt(pixelY, 10)

    if (!Number.isNaN(x) && !Number.isNaN(y) && x >= 0 && x < width && y >= 0 && y < height) {
      applyPixelSelection({ x, y })
    }
  }

  const handleSetRegion = () => {
    const x1 = Number.parseInt(regionX1, 10)
    const y1 = Number.parseInt(regionY1, 10)
    const x2 = Number.parseInt(regionX2, 10)
    const y2 = Number.parseInt(regionY2, 10)

    if (
      !Number.isNaN(x1) &&
      !Number.isNaN(y1) &&
      !Number.isNaN(x2) &&
      !Number.isNaN(y2) &&
      x1 >= 0 &&
      x1 < width &&
      y1 >= 0 &&
      y1 < height &&
      x2 >= 0 &&
      x2 < width &&
      y2 >= 0 &&
      y2 < height
    ) {
      applyRegionSelection({ x1, y1, x2, y2 })
    }
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div>
            Размер: {width} × {height}
          </div>
          <div>Каналов: {channels}</div>
        </div>

        <div className="space-y-2">
          <label htmlFor="channel-select" className="block text-sm font-medium text-zinc-800">
            Выберите канал
          </label>
          <select
            id="channel-select"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(Number(e.target.value))}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
          >
            {Array.from({ length: channelCount }, (_, i) => (
              <option key={i} value={i}>
                Канал {i}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-800">Изображение канала</h3>
        <div className="overflow-auto rounded-xl border border-zinc-200 bg-white p-2">
          {imageDataUrl ? (
            <div
              ref={imageFrameRef}
              className="relative w-full cursor-crosshair touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={cancelDrag}
            >
              <img
                src={imageDataUrl}
                alt={`Канал ${selectedChannel}`}
                draggable={false}
                className="block w-full"
                style={{ imageRendering: 'pixelated' }}
              />

              {selectedPixelRect && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-red-500"
                  style={selectedPixelRect}
                />
              )}

              {selectedRegionRect && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-blue-500"
                  style={selectedRegionRect}
                />
              )}

              {isDragging && draggingRect && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-green-500 opacity-60"
                  style={draggingRect}
                />
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Не удалось построить карту интенсивности.</div>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Кликните для выбора пикселя. Зажмите и перетащите для выбора области.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-800">Выбор пикселя</h3>
          <div className="mb-3 flex gap-2">
            <input
              type="number"
              placeholder="X"
              value={pixelX}
              onChange={(e) => setPixelX(e.target.value)}
              className="w-20 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Y"
              value={pixelY}
              onChange={(e) => setPixelY(e.target.value)}
              className="w-20 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
            />
            <button
              onClick={handleSetPixel}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Выбрать
            </button>
          </div>
          {selectedPixel && (
            <div className="text-sm text-zinc-700">
              Выбранный пиксель: ({selectedPixel.x}, {selectedPixel.y})
            </div>
          )}
          {pixelValues && (
            <div className="mt-3">
              <h4 className="mb-2 text-sm font-medium text-zinc-800">Значения по каналам:</h4>
              <div className="max-h-32 overflow-y-auto text-xs text-zinc-600">
                {pixelValues.map((value, idx) => (
                  <div key={idx}>
                    Канал {idx}: {value.toFixed(4)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-800">Выбор области</h3>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <input
              type="number"
              placeholder="X1"
              value={regionX1}
              onChange={(e) => setRegionX1(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Y1"
              value={regionY1}
              onChange={(e) => setRegionY1(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="X2"
              value={regionX2}
              onChange={(e) => setRegionX2(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Y2"
              value={regionY2}
              onChange={(e) => setRegionY2(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleSetRegion}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Выбрать область
          </button>
          {selectedRegion && (
            <div className="mt-3 text-sm text-zinc-700">
              Выбранная область: ({selectedRegion.x1}, {selectedRegion.y1}) - ({selectedRegion.x2},{' '}
              {selectedRegion.y2})
            </div>
          )}
          {regionValues && (
            <div className="mt-3">
              <h4 className="mb-2 text-sm font-medium text-zinc-800">Статистика по каналам:</h4>
              <div className="max-h-40 overflow-y-auto text-xs text-zinc-600">
                {regionValues.map((stat) => (
                  <div key={stat.channel}>
                    Канал {stat.channel}: mean={stat.mean.toFixed(4)}, min={stat.min.toFixed(4)},
                    max={stat.max.toFixed(4)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
