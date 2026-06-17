import { NavLink } from 'react-router-dom'
import { navigationItems } from '@/features/navigation'
import { FC } from 'react'

export const Sidebar: FC = () => {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-zinc-200 bg-white p-3">
      <div className="mb-4 px-2 pt-1">
        <div className="text-sm font-semibold text-zinc-900">Модули</div>
      </div>

      <nav className="flex flex-col gap-1">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
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
    </aside>
  )
}
