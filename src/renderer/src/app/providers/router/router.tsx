import { createHashRouter, Navigate } from 'react-router-dom'
import { routes } from '@/shared/config/routes'
import { AppLayout } from '@/widgets/appLayout/ui/AppLayout'
import { MeasureModule } from '@/pages/MeasureModule'
import { ReconstructionPage } from '@/pages/ReconstructionPage/ui/ReconstructionPage'

export const router = createHashRouter([
  {
    path: routes.home,
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to={routes.spotread} replace />
      },
      {
        path: routes.spotread,
        element: <MeasureModule />
      },
      {
        path: routes.spectralReconstruction,
        element: <ReconstructionPage />
      }
    ]
  }
])
