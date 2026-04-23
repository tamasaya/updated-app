import { JSX, useState } from 'react'
import { RunPredictionButton } from '@/features/reconstruction/run-prediction'
import { ChannelViewer } from '@/features/reconstruction/channel-viewer'

export function ReconstructionWorkspace(): JSX.Element {
  const [npyPath, setNpyPath] = useState<string | null>(null)

  // const [npyPath, setNpyPath] = useState<string | null>(null)

  const handlePickNpy = async () => {
    try {
      const selectedPath = await window.api.pickNpyFile()
      if (!selectedPath) return
      setNpyPath(selectedPath)
    } catch (error) {
      console.error('NPY pick error:', error)
    }
  }

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
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePickNpy}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Выбрать NPY
          </button>

          {npyPath ? (
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Файл выбран
            </span>
          ) : (
            <span className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
              Файл не выбран
            </span>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Путь к выбранному файлу
          </p>
          <p className="mt-2 break-all text-sm leading-6 text-zinc-700">
            {npyPath ?? 'Пока ничего не выбрано'}
          </p>
        </div>

        <ChannelViewer npyPath={npyPath} />
      </div>
    </div>
  )
}
