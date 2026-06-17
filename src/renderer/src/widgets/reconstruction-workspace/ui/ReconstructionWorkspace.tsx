import { JSX, useState } from 'react'
import { RunPredictionButton } from '@/features/reconstruction/run-prediction'
import { ChannelViewer } from '@/features/reconstruction/channel-viewer'
import { PixelViewer } from '@/features/reconstruction/pixel-viewer'

export function ReconstructionWorkspace(): JSX.Element {
  const [npyPath, setNpyPath] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'channels' | 'pixels'>('channels')

  const handlePickNpy = async (): Promise<void> => {
    try {
      const selectedPath = await window.reconstructionApi.pickNpyFile()
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
          <h2 className="text-lg font-semibold text-zinc-900">Модули анализа</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Выберите модуль для анализа спектральных данных
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
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

        <div className="mt-6">
          <div className="border-b border-zinc-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('channels')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'channels'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Просмотр каналов
              </button>
              <button
                onClick={() => setActiveTab('pixels')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'pixels'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Просмотр пикселей
              </button>
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === 'channels' && <ChannelViewer npyPath={npyPath} />}
            {activeTab === 'pixels' && <PixelViewer npyPath={npyPath} />}
          </div>
        </div>
      </div>

    </div>
  )
}
