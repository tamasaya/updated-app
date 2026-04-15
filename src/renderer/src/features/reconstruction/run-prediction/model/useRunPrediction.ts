/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState } from 'react'

type RunPredictionState = {
  isLoading: boolean
  error: string | null
  outputPath: string | null
}

type UseRunPredictionResult = RunPredictionState & {
  runPrediction: () => Promise<string | null>
}

const OUTPUT_PATH = 'C:\\Users\\User\\repo\\saved\\test_pred_hsi.npy'

export function useRunPrediction(): UseRunPredictionResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)

  const runPrediction = async (): Promise<string | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.api.runPredict()
      console.log('RESULT', result)

      //@ts-ignore
      if (!result?.ok) {
        //@ts-ignore
        throw new Error(result?.stderr || 'Не удалось выполнить реконструкцию')
      }

      setOutputPath(OUTPUT_PATH)
      return OUTPUT_PATH
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
