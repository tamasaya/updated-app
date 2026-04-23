import { useState } from 'react'

type RunPredictResult = {
  ok: boolean
  code?: number
  stdout: string
  stderr: string
  outputPath: string | null
}

type RunPredictionState = {
  isLoading: boolean
  error: string | null
  outputPath: string | null
}

type UseRunPredictionResult = RunPredictionState & {
  runPrediction: () => Promise<string | null>
}

export function useRunPrediction(): UseRunPredictionResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)

  const runPrediction = async (): Promise<string | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = (await window.reconstructionApi.runPredict()) as unknown as RunPredictResult

      if (!result?.ok) {
        throw new Error(result?.stderr || 'Не удалось выполнить реконструкцию')
      }

      if (!result.outputPath) {
        throw new Error('Не получен путь к итоговому .npy файлу')
      }

      setOutputPath(result.outputPath)
      return result.outputPath
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    error,
    outputPath,
    runPrediction
  }
}
