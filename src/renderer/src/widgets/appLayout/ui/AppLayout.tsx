import { Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from '@/widgets/sidebar'
import { FC } from 'react'
import { routes } from '@/shared/config/routes'
import { MeasureModule } from '@/pages/MeasureModule'
import { ReconstructionPage } from '@/pages/ReconstructionPage/ui/ReconstructionPage'
import { SharedTableProvider } from '@/shared/model/sharedTable'

export const AppLayout: FC = () => {
  const { pathname } = useLocation()

  if (pathname === routes.home) {
    return <Navigate to={routes.spotread} replace />
  }

  return (
    <SharedTableProvider>
      <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto h-full w-full max-w-7xl p-6">
            <div hidden={pathname !== routes.spotread}>
              <MeasureModule />
            </div>
            <div hidden={pathname !== routes.spectralReconstruction}>
              <ReconstructionPage />
            </div>
          </div>
        </main>
      </div>
    </SharedTableProvider>
  )
}
