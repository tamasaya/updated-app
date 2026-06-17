import { Navigate, NavLink, useLocation } from 'react-router-dom'
import { FC } from 'react'
import { routes } from '@/shared/config/routes'
import { MeasureModule } from '@/pages/MeasureModule'
import { ReconstructionPage } from '@/pages/ReconstructionPage/ui/ReconstructionPage'
import { SharedTableProvider } from '@/shared/model/sharedTable'
import { navigationItems } from '@/features/navigation'

export const AppLayout: FC = () => {
  const { pathname } = useLocation()

  if (pathname === routes.home) {
    return <Navigate to={routes.spotread} replace />
  }

  return (
    <SharedTableProvider>
      <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
        <header className="shrink-0 border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-12 max-w-7xl items-center gap-1 px-6">
            <nav className="flex items-center gap-1">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }): string =>
                    [
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    ].join(' ')
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl p-6">
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
