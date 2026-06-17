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
import { ChevronDown } from 'lucide-react'
import * as XLSX from 'xlsx'

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

const HOTKEYS = [
  { key: 'Space', label: 'Измерить' },
  { key: 'K', label: 'Калибровать' },
  { key: 'Esc', label: 'Остановить' }
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

type LocalTableRow = {
  id: string
  name: string
  comment: string
  color: string
  spectrum: number[]
  xyz?: [number, number, number]
  lab?: [number, number, number]
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
      description: 'Наденьте колпачок или поставьте прибор на чёрную поверхность'
    },
    readyToMeasure: {
      label: 'Готов к измерению',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      description: 'Пробел, кнопка на приборе или кнопка «Измерить»'
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

const SPOTREAD_DB_NAME = 'spotread-local-table-db'
const SPOTREAD_DB_VERSION = 1
const SPOTREAD_DB_STORE = 'spotread-state'
const SPOTREAD_DB_KEY = 'rows'

async function openSpotreadDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(SPOTREAD_DB_NAME, SPOTREAD_DB_VERSION)
    req.onupgradeneeded = (): void => {
      if (!req.result.objectStoreNames.contains(SPOTREAD_DB_STORE)) {
        req.result.createObjectStore(SPOTREAD_DB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = (): void => resolve(req.result)
    req.onerror = (): void => reject(req.error ?? new Error('Failed to open spotread IndexedDB'))
  })
}

async function loadSpotreadRows(): Promise<LocalTableRow[]> {
  const db = await openSpotreadDb()
  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SPOTREAD_DB_STORE, 'readonly')
      const req = tx.objectStore(SPOTREAD_DB_STORE).get(SPOTREAD_DB_KEY)
      req.onsuccess = (): void => {
        const val = req.result as { id: string; payload: LocalTableRow[] } | undefined
        const rows = val?.payload ?? []
        resolve(rows.map((r) => ({ ...r, comment: r.comment ?? '' })))
      }
      req.onerror = (): void => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function saveSpotreadRows(rows: LocalTableRow[]): Promise<void> {
  const db = await openSpotreadDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SPOTREAD_DB_STORE, 'readwrite')
      tx.objectStore(SPOTREAD_DB_STORE).put({ id: SPOTREAD_DB_KEY, payload: rows })
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function formatTriple(values?: [number, number, number]): string {
  if (!values) return '—'
  return values.map((v) => v.toFixed(4)).join(' / ')
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

let _localRowId = 0

type LegendMenu = { x: number; y: number; index: number } | null

export const MeasureModule: FC = () => {
  const [argyllBinDir, setArgyllBinDir] = useState('C:\\Argyll_V3.5.0_64\\bin')
  const [instrumentPort, setInstrumentPort] = useState(1)
  const [state, setState] = useState<SpotreadState>('idle')
  const [lastMeasurement, setLastMeasurement] = useState<Measurement | null>(null)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [localTable, setLocalTable] = useState<LocalTableRow[]>([])
  const [localTableLoaded, setLocalTableLoaded] = useState(false)
  const [rawLog, setRawLog] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [legendMenu, setLegendMenu] = useState<LegendMenu>(null)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [isLogOpen, setIsLogOpen] = useState(false)

  const logRef = useRef<HTMLPreElement | null>(null)
  const measureCountRef = useRef(0)

  const { addRow: addToShared } = useSharedTable()
  const status = statusMap[state]

  const isBusy = state === 'starting' || state === 'measuring' || isCalibrating
  const busyMessage =
    state === 'starting' ? 'Запуск...' : state === 'measuring' ? 'Измерение...' : 'Калибровка...'

  const { data: chartData, keys: chartKeys } = useMemo(
    () => buildChartData(measurements),
    [measurements]
  )
  const measurementsWithSpectrum = useMemo(
    () => measurements.filter((m) => m.spectrum?.length),
    [measurements]
  )

  useEffect(() => {
    loadSpotreadRows()
      .then((rows) => {
        setLocalTable(rows)
        setLocalTableLoaded(true)
      })
      .catch((): void => setLocalTableLoaded(true))
  }, [])

  useEffect(() => {
    if (!localTableLoaded) return
    void saveSpotreadRows(localTable)
  }, [localTable, localTableLoaded])

  useEffect(() => {
    const unsubState = window.spotreadApi.onState((nextState): void => {
      setState(nextState as SpotreadState)
      if (['readyToMeasure', 'error', 'exited', 'idle'].includes(nextState)) {
        setIsCalibrating(false)
      }
    })

    const unsubRaw = window.spotreadApi.onRaw((chunk): void => {
      setRawLog((prev) => {
        const next = `${prev}${chunk}`
        return next.length > 30000 ? next.slice(next.length - 30000) : next
      })
    })

    const unsubMeasurement = window.spotreadApi.onMeasurement((measurement): void => {
      const name = `Измерение ${++measureCountRef.current}`
      const stamped: Measurement = {
        ...(measurement as Omit<Measurement, 'name' | 'timestamp'>),
        name,
        timestamp: new Date().toLocaleString()
      }
      setLastMeasurement(stamped)
      setMeasurements((prev) => [...prev, stamped])
    })

    return (): void => {
      unsubState()
      unsubRaw()
      unsubMeasurement()
    }
  }, [])

  useEffect((): void => {
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
    return (): void => window.removeEventListener('keydown', onKeyDown)
  }, [state, argyllBinDir, instrumentPort])

  useEffect(() => {
    if (!legendMenu) return
    const close = (): void => setLegendMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return (): void => {
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
    setIsCalibrating(true)
    try {
      await window.spotreadApi.calibrate()
    } catch (error) {
      setIsCalibrating(false)
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

  const updateLocalRow = (id: string, patch: Partial<LocalTableRow>): void => {
    setLocalTable((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addToLocalTable = (index: number): void => {
    const m = measurementsWithSpectrum[index]
    if (!m?.spectrum?.length) return
    const row: LocalTableRow = {
      id: `lr-${++_localRowId}`,
      name: m.name,
      comment: '',
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      spectrum: m.spectrum,
      xyz: m.xyz,
      lab: m.lab,
      timestamp: m.timestamp
    }
    setLocalTable((prev) => [...prev, row])
    setLegendMenu(null)
  }

  const addToSharedTable = (index: number): void => {
    const m = measurementsWithSpectrum[index]
    if (!m?.spectrum?.length) return
    addToShared({
      name: m.name,
      source: 'spotread',
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      spectrum: m.spectrum,
      wavelengthStart: 380,
      wavelengthEnd: 730
    })
    setLegendMenu(null)
  }

  const addLocalRowToShared = (row: LocalTableRow): void => {
    addToShared({
      name: row.name,
      comment: row.comment,
      source: 'spotread',
      color: row.color,
      spectrum: row.spectrum,
      wavelengthStart: 380,
      wavelengthEnd: 730
    })
  }

  const removeFromChart = (index: number): void => {
    const target = measurementsWithSpectrum[index]
    if (!target) return
    setMeasurements((prev) => prev.filter((m) => m !== target))
    setLegendMenu(null)
  }

  const handleExportLocalCsv = (): void => {
    if (!localTable.length) return
    const maxLen = Math.max(...localTable.map((r) => r.spectrum.length))
    const header = [
      'Название',
      'Комментарий',
      'Метка',
      'XYZ',
      'Lab',
      ...Array.from({ length: maxLen }, (_, i) => `ch_${i + 1}`)
    ]
    const data = localTable.map((row) => [
      row.name,
      row.comment,
      row.timestamp,
      row.xyz ? row.xyz.map((v) => v.toFixed(6)).join(';') : '',
      row.lab ? row.lab.map((v) => v.toFixed(6)).join(';') : '',
      ...Array.from({ length: maxLen }, (_, i) => row.spectrum[i] ?? '')
    ])
    const content = [header, ...data].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spotread-table-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportLocalExcel = (): void => {
    if (!localTable.length) return
    const maxLen = Math.max(...localTable.map((r) => r.spectrum.length))
    const header = [
      'Название',
      'Комментарий',
      'Метка',
      'XYZ',
      'Lab',
      ...Array.from({ length: maxLen }, (_, i) => `ch_${i + 1}`)
    ]
    const data = localTable.map((row) => [
      row.name,
      row.comment,
      row.timestamp,
      row.xyz ? row.xyz.map((v) => v.toFixed(6)).join(';') : '',
      row.lab ? row.lab.map((v) => v.toFixed(6)).join(';') : '',
      ...Array.from({ length: maxLen }, (_, i) => row.spectrum[i] ?? 0)
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Spotread')
    XLSX.writeFile(wb, `spotread-table-${Date.now()}.xlsx`)
  }

  return (
    <section className="space-y-6">
      <PageTitle
        title="Spotread"
        subtitle="Измерение одной точки через X-Rite i1 Pro и ArgyllCMS"
      />

      <div className="relative">
        {isBusy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-zinc-50/85 backdrop-blur-[2px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700" />
            <p className="mt-3 text-sm font-medium text-zinc-700">{busyMessage}</p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* Левая колонка — сессия */}
          <div>
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
                    onChange={(e): void => setArgyllBinDir(e.target.value)}
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
                    onChange={(e): void => setInstrumentPort(Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
                  />
                </label>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  onClick={(): Promise<void> => handleStart()}
                  className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  Запустить
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={(): Promise<void> => handleCalibrate()}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                  >
                    Калибровать
                  </button>
                  <button
                    onClick={(): Promise<void> => handleMeasure()}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
                  >
                    Измерить
                  </button>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="group relative">
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs font-medium text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-600"
                  >
                    ?
                  </button>
                  <div className="absolute bottom-7 right-0 z-20 hidden w-44 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg group-hover:block">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Горячие клавиши
                    </p>
                    <div className="space-y-1.5">
                      {HOTKEYS.map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
                            {key}
                          </span>
                          <span className="text-xs text-zinc-600">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Правая колонка — спектр + результат */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">Спектр</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {measurementsWithSpectrum.length
                      ? `${measurementsWithSpectrum.length} изм. · ПКМ на метке для действий`
                      : 'Нет данных'}
                  </p>
                </div>
                {measurementsWithSpectrum.length > 0 && (
                  <button
                    onClick={(): void => setMeasurements([])}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Очистить
                  </button>
                )}
              </div>

              {measurementsWithSpectrum.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {measurementsWithSpectrum.map((m, i) => (
                    <button
                      key={i}
                      onContextMenu={(e): void => {
                        e.preventDefault()
                        e.stopPropagation()
                        setLegendMenu({ x: e.clientX, y: e.clientY, index: i })
                      }}
                      className="flex select-none items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
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
                  <ResponsiveContainer width="100%" height={320}>
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
                        formatter={(value, name): [string | number, string] => [
                          typeof value === 'number' ? value.toFixed(6) : value,
                          measurementsWithSpectrum[Number(name)]?.name ?? `#${Number(name) + 1}`
                        ]}
                        labelFormatter={(label): string => `${label} нм`}
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

            {/* Последний результат */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold text-zinc-900">Последний результат</h2>
                {lastMeasurement ? (
                  <span className="text-sm text-zinc-500">
                    {lastMeasurement.name} · {lastMeasurement.timestamp}
                  </span>
                ) : (
                  <span className="text-sm text-zinc-400">Пока нет измерений</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
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
        </div>
      </div>

      {/* Локальная таблица Spotread */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Таблица измерений</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {localTable.length
                ? `${localTable.length} записей`
                : 'Добавляйте точки через правый клик на метке графика'}
            </p>
          </div>
          {localTable.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLocalCsv}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                CSV
              </button>
              <button
                onClick={handleExportLocalExcel}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Excel
              </button>
              <button
                onClick={(): void => setLocalTable([])}
                className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              >
                Очистить
              </button>
            </div>
          )}
        </div>

        {localTable.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            Пусто. Правый клик на метке графика → «В таблицу».
          </div>
        ) : (
          <div className="mt-5 overflow-auto rounded-xl border border-zinc-200">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                    Название
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                    Комментарий
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                    XYZ
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                    Lab
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                    Точек
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                    Время
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {localTable.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50/40"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: row.color }}
                        />
                        <input
                          value={row.name}
                          onChange={(e): void => updateLocalRow(row.id, { name: e.target.value })}
                          className="w-32 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium text-zinc-800 outline-none hover:border-zinc-300 focus:border-zinc-400 focus:bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.comment}
                        onChange={(e): void =>
                          updateLocalRow(row.id, { comment: e.target.value })
                        }
                        placeholder="Комментарий"
                        className="w-40 rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 outline-none focus:border-zinc-400"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-700">
                      {row.xyz ? row.xyz.map((v) => v.toFixed(4)).join(' / ') : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-700">
                      {row.lab ? row.lab.map((v) => v.toFixed(4)).join(' / ') : '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{row.spectrum.length}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.timestamp}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(): void => addLocalRowToShared(row)}
                          className="rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] text-violet-700 transition hover:bg-violet-50"
                        >
                          → Общая
                        </button>
                        <button
                          type="button"
                          onClick={(): void =>
                            setLocalTable((prev) => prev.filter((r) => r.id !== row.id))
                          }
                          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 transition hover:bg-zinc-100"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Лог */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={(): void => setIsLogOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-900">Лог spotread</span>
            <span className="text-xs text-zinc-400">сырой вывод процесса</span>
          </div>
          <ChevronDown
            className={[
              'h-4 w-4 text-zinc-400 transition-transform duration-200',
              isLogOpen ? 'rotate-180' : ''
            ].join(' ')}
          />
        </button>

        {isLogOpen && (
          <div className="px-6 pb-6">
            <div className="mb-3 flex justify-end">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e): void => setAutoScroll(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Автоскролл
              </label>
            </div>
            <pre
              ref={logRef}
              className="max-h-[360px] overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100"
            >
              {rawLog || 'Лог пуст'}
            </pre>
          </div>
        )}
      </div>

      {/* Контекстное меню */}
      {legendMenu && (
        <div
          className="fixed z-50 min-w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"
          style={{ left: legendMenu.x, top: legendMenu.y }}
          onClick={(e): void => {
            e.stopPropagation()
          }}
        >
          <button
            type="button"
            onClick={(): void => addToLocalTable(legendMenu.index)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
          >
            В таблицу
          </button>
          <button
            type="button"
            onClick={(): void => addToSharedTable(legendMenu.index)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-violet-700 transition hover:bg-violet-50"
          >
            В общую таблицу
          </button>
          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            onClick={(): void => removeFromChart(legendMenu.index)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
          >
            Удалить с графика
          </button>
        </div>
      )}
    </section>
  )
}
