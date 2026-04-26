import { routes } from '@/shared/config/routes'
import { Activity, LucideIcon, ScanLine } from 'lucide-react'

export type NavigationItem = {
  label: string
  to: string
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  {
    label: 'Spotread',
    to: routes.spotread,
    icon: ScanLine
  },
  {
    label: 'Спектральная реконструкция',
    to: routes.spectralReconstruction,
    icon: Activity
  }
]
