import { FC } from 'react'
import * as XLSX from 'xlsx'
import { useSharedTable } from '@/shared/model/sharedTable'

export const SharedTable: FC = () => {
  const { rows, removeRow, updateRow, clearRows } = useSharedTable()

  const handleExportCsv = (): void => {
    if (!rows.length) return
    const maxLen = Math.max(...rows.map((r) => r.spectrum.length))
    const header = [
      'Название',
      'Комментарий',
      'Источник',
      'λ нач',
      'λ кон',
      ...Array.from({ length: maxLen }, (_, i) => `ch_${i + 1}`)
    ]
    const data = rows.map((row) => [
      row.name,
      row.comment,
      row.source === 'spotread' ? 'Spotread' : 'Реконструкция',
      row.wavelengthStart,
      row.wavelengthEnd,
      ...Array.from({ length: maxLen }, (_, i) => row.spectrum[i] ?? '')
    ])
    const content = [header, ...data].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = (): void => {
    if (!rows.length) return
    const maxLen = Math.max(...rows.map((r) => r.spectrum.length))
    const header = [
      'Название',
      'Комментарий',
      'Источник',
      'λ нач',
      'λ кон',
      ...Array.from({ length: maxLen }, (_, i) => `ch_${i + 1}`)
    ]
    const data = rows.map((row) => [
      row.name,
      row.comment,
      row.source === 'spotread' ? 'Spotread' : 'Реконструкция',
      row.wavelengthStart,
      row.wavelengthEnd,
      ...Array.from({ length: maxLen }, (_, i) => row.spectrum[i] ?? 0)
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Таблица')
    XLSX.writeFile(wb, `table-${Date.now()}.xlsx`)
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Общая таблица</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {rows.length ? `${rows.length} ${rows.length === 1 ? 'запись' : 'записей'}` : 'Пустая'}
          </p>
        </div>

        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Excel
            </button>
            <button
              onClick={clearRows}
              className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
            >
              Очистить
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          Добавляйте записи через контекстное меню в модуле Spotread или через кнопку в модуле
          реконструкции.
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
                  Источник
                </th>
                <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                  Диапазон λ
                </th>
                <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold">
                  Точек
                </th>
                <th className="border-b border-zinc-200 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.color }}
                      />
                      <input
                        value={row.name}
                        onChange={(e): void => updateRow(row.id, { name: e.target.value })}
                        className="w-36 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium text-zinc-800 outline-none hover:border-zinc-300 focus:border-zinc-400 focus:bg-white"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.comment}
                      onChange={(e): void => updateRow(row.id, { comment: e.target.value })}
                      placeholder="Комментарий"
                      className="w-44 rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-700 outline-none focus:border-zinc-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        row.source === 'spotread'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-violet-50 text-violet-700'
                      ].join(' ')}
                    >
                      {row.source === 'spotread' ? 'Spotread' : 'Реконструкция'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {row.wavelengthStart}–{row.wavelengthEnd} нм
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{row.spectrum.length}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={(): void => removeRow(row.id)}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 transition hover:bg-zinc-100"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
