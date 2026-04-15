import { routes } from '@/shared/config/routes'

export type NavigationItem = {
  label: string
  to: string
}

export const navigationItems: NavigationItem[] = [
  {
    label: 'Spotread',
    to: routes.spotread
  },
  {
    label: 'Спектральная реконструкция',
    to: routes.spectralReconstruction
  }
]
