import { JSX } from 'react'
import { useRunPrediction } from '../model/useRunPrediction'

type Props = {
  onSuccess: (npyPath: string) => void
}

export function RunPredictionButton({ onSuccess }: Props): JSX.Element {
  const { isLoading, error, outputPath, runPrediction } = useRunPrediction()

  const handleClick = async (): Promise<void> => {
    const path = await runPrediction()

    if (path) {
      onSuccess(path)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Реконструкция...' : 'Запустить реконструкцию'}
      </button>

      {outputPath ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Файл сохранён: {outputPath}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  )
}
