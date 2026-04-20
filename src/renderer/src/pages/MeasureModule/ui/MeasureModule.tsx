import { PageTitle } from '@/shared/ui/PageTitle/PageTitle'
import { FC } from 'react'
// import { FC, useEffect, useMemo, useRef, useState } from 'react'

// type SpotreadState =
//   | 'idle'
//   | 'starting'
//   | 'awaitingCalibration'
//   | 'readyToMeasure'
//   | 'measuring'
//   | 'error'
//   | 'exited'

// type Measurement = {
//   spectrum?: number[]
//   xyz?: [number, number, number]
//   lab?: [number, number, number]
//   rawText: string
//   timestamp: string
// }

// const statusMap: Record<SpotreadState, { label: string; className: string; description: string }> =
//   {
//     idle: {
//       label: 'Не запущен',
//       className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
//       description: 'Сессия spotread ещё не запущена'
//     },
//     starting: {
//       label: 'Запуск',
//       className: 'bg-blue-50 text-blue-700 ring-blue-200',
//       description: 'Процесс spotread запускается'
//     },
//     awaitingCalibration: {
//       label: 'Ждёт калибровку',
//       className: 'bg-amber-50 text-amber-700 ring-amber-200',
//       description:
//         'Наденьте колпачок или поставьте прибор на чёрную поверхность, затем нажмите калибровку'
//     },
//     readyToMeasure: {
//       label: 'Готов к измерению',
//       className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
//       description: 'Можно мерить из интерфейса, пробелом на клавиатуре или кнопкой на приборе'
//     },
//     measuring: {
//       label: 'Измерение',
//       className: 'bg-violet-50 text-violet-700 ring-violet-200',
//       description: 'Идёт чтение спектра и расчёт XYZ/Lab'
//     },
//     error: {
//       label: 'Ошибка',
//       className: 'bg-rose-50 text-rose-700 ring-rose-200',
//       description: 'Проверьте лог ниже'
//     },
//     exited: {
//       label: 'Завершён',
//       className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
//       description: 'Процесс остановлен'
//     }
//   }

// function formatTriple(values?: [number, number, number]) {
//   if (!values) return '—'
//   return values.map((v) => v.toFixed(6)).join(' / ')
// }

// function isEditableTarget(target: EventTarget | null) {
//   if (!(target instanceof HTMLElement)) return false
//   const tag = target.tagName.toLowerCase()
//   return tag === 'input' || tag === 'textarea' || target.isContentEditable
// }

// function buildSpectrumRows(spectrum?: number[]) {
//   if (!spectrum?.length) return []

//   const startNm = 380
//   const endNm = 730
//   const step = spectrum.length > 1 ? (endNm - startNm) / (spectrum.length - 1) : 10

//   return spectrum.map((value, index) => ({
//     wavelength: Math.round(startNm + step * index),
//     value
//   }))
// }

export const MeasureModule: FC = () => {
  //   const [argyllBinDir, setArgyllBinDir] = useState('C:\\Argyll_V3.5.0_64\\bin')
  //   const [instrumentPort, setInstrumentPort] = useState(1)
  //   const [state, setState] = useState<SpotreadState>('idle')
  //   const [lastMeasurement, setLastMeasurement] = useState<Measurement | null>(null)
  //   const [rawLog, setRawLog] = useState('')
  //   const [autoScroll, setAutoScroll] = useState(true)

  //   const logRef = useRef<HTMLPreElement | null>(null)

  //   const status = statusMap[state]
  //   const spectrumRows = useMemo(
  //     () => buildSpectrumRows(lastMeasurement?.spectrum),
  //     [lastMeasurement?.spectrum]
  //   )

  //   useEffect(() => {
  //     const unsubState = window.spotread.onState((nextState) => {
  //       setState(nextState)
  //     })

  //     const unsubRaw = window.spotread.onRaw((chunk) => {
  //       setRawLog((prev) => {
  //         const next = `${prev}${chunk}`
  //         return next.length > 30000 ? next.slice(next.length - 30000) : next
  //       })
  //     })

  //     const unsubMeasurement = window.spotread.onMeasurement((measurement) => {
  //       setLastMeasurement({
  //         ...measurement,
  //         timestamp: new Date().toLocaleString()
  //       })
  //     })

  //     return () => {
  //       unsubState()
  //       unsubRaw()
  //       unsubMeasurement()
  //     }
  //   }, [])

  //   useEffect(() => {
  //     if (!autoScroll || !logRef.current) return
  //     logRef.current.scrollTop = logRef.current.scrollHeight
  //   }, [rawLog, autoScroll])

  //   useEffect(() => {
  //     const onKeyDown = (event: KeyboardEvent) => {
  //       if (isEditableTarget(event.target)) return

  //       if (event.code === 'Space') {
  //         event.preventDefault()
  //         void handleMeasure()
  //       }

  //       if (event.code === 'KeyK') {
  //         event.preventDefault()
  //         void handleCalibrate()
  //       }

  //       if (event.code === 'Escape') {
  //         event.preventDefault()
  //         void handleStop()
  //       }
  //     }

  //     window.addEventListener('keydown', onKeyDown)
  //     return () => window.removeEventListener('keydown', onKeyDown)
  //   }, [state, argyllBinDir, instrumentPort])

  //   const handleStart = async () => {
  //     setRawLog('')
  //     setLastMeasurement(null)
  //     setState('starting')

  //     try {
  //       await window.spotread.start({
  //         argyllBinDir,
  //         instrumentPort
  //       })
  //     } catch (error) {
  //       setState('error')
  //       setRawLog((prev) => `${prev}\n[UI] Ошибка запуска: ${String(error)}\n`)
  //     }
  //   }

  //   const handleStop = async () => {
  //     try {
  //       await window.spotread.stop()
  //     } catch (error) {
  //       setRawLog((prev) => `${prev}\n[UI] Ошибка остановки: ${String(error)}\n`)
  //     }
  //   }

  //   const handleCalibrate = async () => {
  //     try {
  //       await window.spotread.calibrate()
  //     } catch (error) {
  //       setRawLog((prev) => `${prev}\n[UI] Ошибка калибровки: ${String(error)}\n`)
  //     }
  //   }

  //   const handleMeasure = async () => {
  //     try {
  //       await window.spotread.measure()
  //     } catch (error) {
  //       setRawLog((prev) => `${prev}\n[UI] Ошибка измерения: ${String(error)}\n`)
  //     }
  //   }

  //   const handleSaveSpectrum = async () => {
  //     try {
  //       await window.spotread.saveSpectrum()
  //     } catch (error) {
  //       setRawLog((prev) => `${prev}\n[UI] Ошибка сохранения спектра: ${String(error)}\n`)
  //     }
  //   }

  //   const handleSetReference = async () => {
  //     try {
  //       await window.spotread.setReference()
  //     } catch (error) {
  //       setRawLog((prev) => `${prev}\n[UI] Ошибка установки reference: ${String(error)}\n`)
  //     }
  //   }

  return (
    <section className="space-y-6">
      <PageTitle
        title="Spotread"
        subtitle="Измерение одной точки через X-Rite i1 Pro и ArgyllCMS"
      />

      {/* <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
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

            <div className="mt-6 space-y-4">
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

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={handleStart}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
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
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Кнопку на самом приборе отдельно ловить не нужно: если `spotread` активен, он сам
                принимает её и пишет результат в поток вывода.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Последний результат</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {lastMeasurement?.timestamp ?? 'Пока нет измерений'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
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

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Спектр</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {spectrumRows.length ? `${spectrumRows.length} точек` : 'Спектр ещё не получен'}
                </p>
              </div>
            </div>

            {spectrumRows.length ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200">
                <div className="grid grid-cols-2 bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <div>Длина волны</div>
                  <div>Значение</div>
                </div>

                <div className="max-h-[420px] overflow-auto">
                  {spectrumRows.map((row) => (
                    <div
                      key={row.wavelength}
                      className="grid grid-cols-2 border-t border-zinc-100 px-4 py-2.5 text-sm"
                    >
                      <div className="font-mono text-zinc-700">{row.wavelength} nm</div>
                      <div className="font-mono text-zinc-900">{row.value.toFixed(9)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                Запустите сессию, выполните калибровку и сделайте измерение.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Лог spotread</h2>
                <p className="mt-1 text-sm text-zinc-600">Сюда попадает сырой вывод процесса</p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                />
                Автоскролл
              </label>
            </div>

            <pre
              ref={logRef}
              className="mt-5 max-h-[420px] overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100"
            >
              {rawLog || 'Лог пуст'}
            </pre>
          </div>
        </div>
      </div> */}
    </section>
  )
}
