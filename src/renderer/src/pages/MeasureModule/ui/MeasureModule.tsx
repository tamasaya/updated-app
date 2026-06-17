import { PageTitle } from '@/shared/ui/PageTitle/PageTitle'
import { FC, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useSharedTable } from '@/shared/model/sharedTable'
import { SharedTable } from '@/shared/ui/SharedTable/SharedTable'

const SERIES_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#84cc16'
]

type SpotreadState =
  | 'idle'
  | 'starting'
  | 'awaitingCalibration'
  | 'readyToMeasure'
  | 'measuring'
  | 'error'
  | 'exited'

type Measurement = {
  name: string
  spectrum?: number[]
  xyz?: [number, number, number]
  lab?: [number, number, number]
  rawText: string
  timestamp: string
}

const statusMap: Record<SpotreadState, { label: string; className: string; description: string }> =
  {
    idle: {
      label: 'Не запущен',
      className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
      description: 'Сессия spotread ещё не запущена'
    },
    starting: {
      label: 'Запуск',
      className: 'bg-blue-50 text-blue-700 ring-blue-200',
      description: 'Процесс spotread запускается'
    },
    awaitingCalibration: {
      label: 'Ждёт калибровку',
      className: 'bg-amber-50 text-amber-700 ring-amber-200',
      description:
        'Наденьте колпачок или поставьте прибор на чёрную поверхность, затем нажмите калибровку'
    },
    readyToMeasure: {
      label: 'Готов к измерению',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      description: 'Можно мерить из интерфейса, пробелом на клавиатуре или кнопкой на приборе'
    },
    measuring: {
      label: 'Измерение',
      className: 'bg-violet-50 text-violet-700 ring-violet-200',
      description: 'Идёт чтение спектра и расчёт XYZ/Lab'
    },
    error: {
      label: 'Ошибка',
      className: 'bg-rose-50 text-rose-700 ring-rose-200',
      description: 'Проверьте лог ниже'
    },
    exited: {
      label: 'Завершён',
      className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
      description: 'Процесс остановлен'
    }
  }

function formatTriple(values?: [number, number, number]): string {
  if (!values) return '—'
  return values.map((v) => v.toFixed(6)).join(' / ')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

type ChartRow = { wavelength: number } & Record<string, number>

function buildChartData(measurements: Measurement[]): { data: ChartRow[]; keys: string[] } {
  const withSpectrum = measurements.filter((m) => m.spectrum?.length)
  if (!withSpectrum.length) return { data: [], keys: [] }

  const ref = withSpectrum[0].spectrum!
  const startNm = 380
  const endNm = 730
  const step = ref.length > 1 ? (endNm - startNm) / (ref.length - 1) : 10
  const keys = withSpectrum.map((_, i) => String(i))

  const data: ChartRow[] = ref.map((_, wIdx) => {
    const row: ChartRow = { wavelength: Math.round(startNm + step * wIdx) }
    withSpectrum.forEach((m, mIdx) => {
      row[String(mIdx)] = m.spectrum![wIdx] ?? 0
    })
    return row
  })

  return { data, keys }
}

type LegendMenu = { x: number; y: number; index: number } | null

export const MeasureModule: FC = () => {
  const [argyllBinDir, setArgyllBinDir] = useState('C:\\Argyll_V3.5.0_64\\bin')
  const [instrumentPort, setInstrumentPort] = useState(1)
  const [state, setState] = useState<SpotreadState>('idle')
  const [lastMeasurement, setLastMeasurement] = useState<Measurement | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [rawLog, setRawLog] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [legendMenu, setLegendMenu] = useState<LegendMenu>(null)

  const logRef = useRef<HTMLPreElement | null>(null)
  const measureCountRef = useRef(0)

  const { addRow } = useSharedTable()

  const status = statusMap[state]
  const { data: chartData, keys: chartKeys } = useMemo(
    () => buildChartData(measurements),
    [measurements]
  )
  const measurementsWithSpectrum = useMemo(
    () => measurements.filter((m) => m.spectrum?.length),
    [measurements]
  )

  useEffect(() => {
    const unsubState = window.spotreadApi.onState((nextState) => {
      setState(nextState as SpotreadState)
    })

    const unsubRaw = window.spotreadApi.onRaw((chunk) => {
      setRawLog((prev) => {
        const next = `${prev}${chunk}`
        return next.length > 30000 ? next.slice(next.length - 30000) : next
      })
    })

    const unsubMeasurement = window.spotreadApi.onMeasurement((measurement) => {
      const name = `Измерение ${++measureCountRef.current}`
      const stamped: Measurement = {
        ...(measurement as Omit<Measurement, 'name' | 'timestamp'>),
        name,
        timestamp: new Date().toLocaleString()
      }
      setLastMeasurement(stamped)
      setMeasurements((prev) => [...prev, stamped])
    })

    return () => {
      unsubState()
      unsubRaw()
      unsubMeasurement()
    }
  }, [])

  useEffect(() => {
    if (!autoScroll || !logRef.current) return
    logRef.current.scrollTop = logRef.current.scrollHeight
  }, [rawLog, autoScroll])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return
      if (event.code === 'Space') {
        event.preventDefault()
        void handleMeasure()
      }
      if (event.code === 'KeyK') {
        event.preventDefault()
        void handleCalibrate()
      }
      if (event.code === 'Escape') {
        event.preventDefault()
        void handleStop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state, argyllBinDir, instrumentPort])

  useEffect(() => {
    if (!legendMenu) return
    const close = (): void => setLegendMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [legendMenu])

  const handleStart = async (): Promise<void> => {
    setRawLog('')
    setLastMeasurement(null)
    setMeasurements([])
    measureCountRef.current = 0
    setState('starting')
    try {
      await window.spotreadApi.start({ argyllBinDir, instrumentPort })
    } catch (error) {
      setState('error')
      setRawLog((prev) => `${prev}\n[UI] Ошибка запуска: ${String(error)}\n`)
    }
  }

  const handleStop = async (): Promise<void> => {
    try {
      await window.spotreadApi.stop()
    } catch (error) {
      setRawLog((prev) => `${prev}\n[UI] Ошибка остановки: ${String(error)}\n`)
    }
  }

  const handleCalibrate = async (): Promise<void> => {
    try {
      await window.spotreadApi.calibrate()
    } catch (error) {
      setRawLog((prev) => `${prev}\n[UI] Ошибка калибровки: ${String(error)}\n`)
    }
  }

  const handleMeasure = async (): Promise<void> => {
    try {
      await window.spotreadApi.measure()
    } catch (error) {
      setRawLog((prev) => `${prev}\n[UI] Ошибка измерения: ${String(error)}\n`)
    }
  }

  const handleSaveSpectrum = async (): Promise<void> => {
    try {
      await window.spotreadApi.saveSpectrum()
    } catch (error) {
      setRawLog((prev) => `${prev}\n[UI] Ошибка сохранения спектра: ${String(error)}\n`)
    }
  }

  const handleSetReference = async (): Promise<void> => {
    try {
      await window.spotreadApi.setReference()
    } catch (error) {
      setRawLog((prev) => `${prev}\n[UI] Ошибка установки reference: ${String(error)}\n`)
    }
  }

  const handleAddToTable = (index: number): void => {
    const m = measurementsWithSpectrum[index]
    if (!m?.spectrum?.length) return
    addRow({
      name: m.name,
      source: 'spotread',
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      spectrum: m.spectrum,
      wavelengthStart: 380,
      wavelengthEnd: 730
    })
    setLegendMenu(null)
  }

  const handleRemoveFromChart = (index: number): void => {
    const target = measurementsWithSpectrum[index]
    if (!target) return
    setMeasurements((prev) => prev.filter((m) => m !== target))
    setLegendMenu(null)
  }

  return (
    <section className="space-y-6">
      <PageTitle
        title="Spotread"
        subtitle="Измерение одной точки через X-Rite i1 Pro и ArgyllCMS"
      />

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* Левая колонка */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Сессия</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">{status.description}</p>
              </div>
              <span
                className={[
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
                  status.className
                ].join(' ')}
              >
                {status.label}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-800">
                  Путь к папке bin ArgyllCMS
                </span>
                <input
                  value={argyllBinDir}
                  onChange={(e) => setArgyllBinDir(e.target.value)}
                  placeholder="C:\Argyll_V3.5.0_64\bin"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-800">
                  Номер прибора
                </span>
                <input
                  type="number"
                  min={1}
                  value={instrumentPort}
                  onChange={(e) => setInstrumentPort(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={handleStart}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Запустить
              </button>
              <button
                onClick={handleStop}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                Остановить
              </button>
              <button
                onClick={handleCalibrate}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                Калибровать
              </button>
              <button
                onClick={handleMeasure}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                Измерить
              </button>
              <button
                onClick={handleSetReference}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                Set reference
              </button>
              <button
                onClick={handleSaveSpectrum}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                Сохранить спектр
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Горячие клавиши
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                <span className="font-medium">Space</span> — измерить,{' '}
                <span className="font-medium">K</span> — калибровать,{' '}
                <span className="font-medium">Esc</span> — остановить.
              </p>
            </div>
          </div>

          {/* Последний результат */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Последний результат</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {lastMeasurement
                ? `${lastMeasurement.name} · ${lastMeasurement.timestamp}`
                : 'Пока нет измерений'}
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">XYZ</p>
                <p className="mt-2 font-mono text-sm text-zinc-900">
                  {formatTriple(lastMeasurement?.xyz)}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Lab</p>
                <p className="mt-2 font-mono text-sm text-zinc-900">
                  {formatTriple(lastMeasurement?.lab)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="space-y-6">
          {/* График спектра */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Спектр</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {measurementsWithSpectrum.length
                    ? `${measurementsWithSpectrum.length} измерений · правый клик на метке — добавить в таблицу`
                    : 'Нет данных'}
                </p>
              </div>
              {measurementsWithSpectrum.length > 0 && (
                <button
                  onClick={() => setMeasurements([])}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* Легенда с именами точек */}
            {measurementsWithSpectrum.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {measurementsWithSpectrum.map((m, i) => (
                  <button
                    key={i}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLegendMenu({ x: e.clientX, y: e.clientY, index: i })
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 select-none"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    />
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            {chartData.length ? (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <XAxis
                      dataKey="wavelength"
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      label={{
                        value: 'нм',
                        position: 'insideRight',
                        offset: -4,
                        fontSize: 11,
                        fill: '#71717a'
                      }}
                    />
                    <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} width={70} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value, name) => [
                        typeof value === 'number' ? value.toFixed(6) : value,
                        measurementsWithSpectrum[Number(name)]?.name ?? `#${Number(name) + 1}`
                      ]}
                      labelFormatter={(label) => `${label} нм`}
                    />
                    {chartKeys.map((key, i) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                Запустите сессию, выполните калибровку и сделайте измерение.
              </div>
            )}
          </div>

          {/* Лог */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Лог spotread</h2>
                <p className="mt-1 text-sm text-zinc-600">Сырой вывод процесса</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Автоскролл
              </label>
            </div>
            <pre
              ref={logRef}
              className="mt-5 max-h-[360px] overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100"
            >
              {rawLog || 'Лог пуст'}
            </pre>
          </div>
        </div>
      </div>

      {/* Общая таблица */}
      <SharedTable />

      {/* Контекстное меню легенды */}
      {legendMenu && (
        <div
          className="fixed z-50 min-w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"
          style={{ left: legendMenu.x, top: legendMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleAddToTable(legendMenu.index)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            Добавить в таблицу
          </button>
          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            onClick={() => handleRemoveFromChart(legendMenu.index)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
          >
            Удалить с графика
          </button>
        </div>
      )}
    </section>
  )
}
