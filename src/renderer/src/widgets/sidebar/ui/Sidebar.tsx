import { NavLink } from 'react-router-dom'
import { navigationItems } from '@/features/navigation'
import { FC } from 'react'

export const Sidebar: FC = () => {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 bg-white p-4">
      <div className="mb-6 px-2">
        <div className="text-lg font-semibold text-zinc-900">Меню</div>
        <div className="mt-1 text-sm text-zinc-500">Управление модулями приложения</div>
      </div>

      <nav className="flex flex-col gap-2">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
