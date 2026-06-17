import { createHashRouter } from 'react-router-dom'
import { AppLayout } from '@/widgets/appLayout/ui/AppLayout'

export const router = createHashRouter([
  {
    path: '/*',
    element: <AppLayout />
  }
])
