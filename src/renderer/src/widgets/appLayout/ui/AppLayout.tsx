import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/widgets/sidebar'
import { FC } from 'react'

export const AppLayout: FC = () => {
  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto h-full w-full max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
