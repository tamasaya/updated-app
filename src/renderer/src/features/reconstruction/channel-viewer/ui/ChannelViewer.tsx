import { JSX } from 'react'
import { useChannelViewer } from '../model/useChannelViewer'

type Props = {
  npyPath: string | null
}

export function ChannelViewer({ npyPath }: Props): JSX.Element {
  const {
    isLoading,
    error,
    cube,
    selectedChannel,
    setSelectedChannel,
    channelCount,
    imageDataUrl
  } = useChannelViewer(npyPath)

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
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
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
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        {imageDataUrl ? (
          <img
            src={imageDataUrl}
            alt={`Канал ${selectedChannel}`}
            className="max-h-130 rounded-lg border border-zinc-200 bg-white object-contain"
          />
        ) : (
          <div className="text-sm text-zinc-500">Не удалось построить карту интенсивности.</div>
        )}
      </div>
    </div>
  )
}
