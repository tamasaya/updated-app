import { JSX, useState } from 'react'
import { RunPredictionButton } from '@/features/reconstruction/run-prediction'
import { ChannelViewer } from '@/features/reconstruction/channel-viewer'

export function ReconstructionWorkspace(): JSX.Element {
  const [npyPath, setNpyPath] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Запуск реконструкции</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Запускает модель и сохраняет спектральный куб в файл .npy
          </p>
        </div>

        <RunPredictionButton onSuccess={setNpyPath} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Просмотр спектральных каналов</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Выберите индекс канала и посмотрите 2D-карту интенсивности
          </p>
        </div>

        <ChannelViewer npyPath={npyPath} />
      </div>
    </div>
  )
}
