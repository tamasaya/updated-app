import { JSX, useState } from 'react'
import { useChannelViewer, RgbMode, Normalization, Contrast } from '../model/useChannelViewer'

type Props = {
  npyPath: string | null
}

const WAVELENGTH_START_NM = 400
const WAVELENGTH_END_NM = 700

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

  const [chartDataUrl, setChartDataUrl] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const handleBuildChart = async () => {
    if (!npyPath) return

    setChartLoading(true)
    setChartError(null)

    try {
      const result = await window.reconstructionApi.runSeabornChart(npyPath, {
        type: 'global-average',
        wavelengthStartNm: WAVELENGTH_START_NM,
        wavelengthEndNm: WAVELENGTH_END_NM
      })

      if (!result?.ok || !result.outputPath) {
        setChartDataUrl(null)
        setChartError(result?.error ?? 'Не удалось построить график')
        return
      }

      const file = await window.reconstructionApi.readImageFile(result.outputPath)
      const dataUrl = arrayBufferToPngDataUrl(file.bytes)

      setChartDataUrl(dataUrl)
      setChartError(null)
    } catch (nextError) {
      setChartDataUrl(null)
      setChartError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setChartLoading(false)
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-800">График среднего спектра</h3>
            <p className="mt-1 text-sm text-zinc-600">Средний спектр по всему спектральному кубу</p>
          </div>

          <button
            onClick={handleBuildChart}
            disabled={chartLoading}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {chartLoading ? 'Построение...' : 'Построить спектр'}
          </button>
        </div>

        {chartError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {chartError}
          </div>
        )}

        {chartDataUrl ? (
          <img
            src={chartDataUrl}
            alt="Средний спектр по всему кубу"
            className="block w-full rounded-xl border border-zinc-200 bg-white"
          />
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-sm text-zinc-500">
            Нажмите «Построить спектр», чтобы построить средний спектр по всему кубу.
          </div>
        )}
      </div>
    </div>
  )
}
