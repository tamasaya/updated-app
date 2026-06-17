import { createContext, FC, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

export type SharedTableRow = {
  id: string
  name: string
  comment: string
  source: 'spotread' | 'reconstruction'
  color: string
  spectrum: number[]
  wavelengthStart: number
  wavelengthEnd: number
}

type SharedTableCtxType = {
  rows: SharedTableRow[]
  addRow: (row: Omit<SharedTableRow, 'id' | 'comment'> & { comment?: string }) => void
  removeRow: (id: string) => void
  updateRow: (id: string, patch: Partial<Omit<SharedTableRow, 'id'>>) => void
  clearRows: () => void
}

const SharedTableCtx = createContext<SharedTableCtxType | null>(null)

let _counter = 0

const DB_NAME = 'shared-table-db'
const DB_VERSION = 1
const DB_STORE = 'shared-table-state'
const DB_KEY = 'rows'

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (): void => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = (): void => resolve(req.result)
    req.onerror = (): void => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function loadRows(): Promise<SharedTableRow[]> {
  const db = await openDb()
  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly')
      const store = tx.objectStore(DB_STORE)
      const req = store.get(DB_KEY)
      req.onsuccess = (): void => {
        const val = req.result as { id: string; payload: SharedTableRow[] } | undefined
        const rows = val?.payload ?? []
        resolve(rows.map((r) => ({ ...r, comment: r.comment ?? '' })))
      }
      req.onerror = (): void => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function saveRows(rows: SharedTableRow[]): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put({ id: DB_KEY, payload: rows })
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export const SharedTableProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [rows, setRows] = useState<SharedTableRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadRows()
      .then((saved) => {
        setRows(saved)
        setLoaded(true)
      })
      .catch((): void => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded) return
    void saveRows(rows)
  }, [rows, loaded])

  const addRow = useCallback(
    (row: Omit<SharedTableRow, 'id' | 'comment'> & { comment?: string }): void => {
      setRows((prev) => [
        ...prev,
        { ...row, id: `st-${++_counter}`, comment: row.comment ?? '' }
      ])
    },
    []
  )

  const removeRow = useCallback((id: string): void => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateRow = useCallback(
    (id: string, patch: Partial<Omit<SharedTableRow, 'id'>>): void => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    },
    []
  )

  const clearRows = useCallback((): void => setRows([]), [])

  return (
    <SharedTableCtx.Provider value={{ rows, addRow, removeRow, updateRow, clearRows }}>
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
