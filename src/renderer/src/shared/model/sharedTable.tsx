import { createContext, FC, ReactNode, useCallback, useContext, useState } from 'react'

export type SharedTableRow = {
  id: string
  name: string
  source: 'spotread' | 'reconstruction'
  color: string
  spectrum: number[]
  wavelengthStart: number
  wavelengthEnd: number
}

type SharedTableCtxType = {
  rows: SharedTableRow[]
  addRow: (row: Omit<SharedTableRow, 'id'>) => void
  removeRow: (id: string) => void
  clearRows: () => void
}

const SharedTableCtx = createContext<SharedTableCtxType | null>(null)

let _counter = 0

export const SharedTableProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [rows, setRows] = useState<SharedTableRow[]>([])

  const addRow = useCallback((row: Omit<SharedTableRow, 'id'>) => {
    setRows((prev) => [...prev, { ...row, id: `st-${++_counter}` }])
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const clearRows = useCallback(() => setRows([]), [])

  return (
    <SharedTableCtx.Provider value={{ rows, addRow, removeRow, clearRows }}>
      {children}
    </SharedTableCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSharedTable(): SharedTableCtxType {
  const ctx = useContext(SharedTableCtx)
  if (!ctx) throw new Error('useSharedTable must be used within SharedTableProvider')
  return ctx
}
