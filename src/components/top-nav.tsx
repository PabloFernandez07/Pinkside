'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { CommandPalette } from '@/components/command-palette'

const ICONS = {
  resumen: <path d="M3 12l9-8 9 8M5 10v10h14V10" />,
  caja: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14h2" />
    </>
  ),
  inventario: <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />,
  recetas: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />,
  mapa: (
    <>
      <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4z" />
      <path d="M9 4v13M15 7v12.5" />
    </>
  ),
  miembros: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.2.6 4 2.2 4 5.2" />
    </>
  ),
  urgentes: <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />,
  muro: <path d="M4 5h16v11H9l-5 4V5zM8 9h8M8 12h5" />,
  ranking: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  admin: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
} satisfies Record<string, ReactNode>

export interface NavItem {
  href: string
  label: string
  icon: keyof typeof ICONS
}

interface TopNavProps {
  items: NavItem[]
  name: string
  rank: string | null
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function TopNav({ items, name, rank }: TopNavProps) {
  const pathname = usePathname()
  return (
    <header className="topnav">
      <div className="brand">
        <i aria-hidden="true" />
        Pinkside
      </div>
      <nav id="nav" aria-label="Principal">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href || pathname.startsWith(item.href + '/') ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[item.icon]}
            </svg>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="tools">
        <CommandPalette pages={items.map(({ href, label }) => ({ href, label }))} />
        <span className="who-mini">
          <span className="avatar" aria-hidden="true">
            {initials(name)}
          </span>
          <span className="who-text">
            <b>{name}</b>
            {rank && <small>{rank}</small>}
          </span>
        </span>
        <form action={signOut}>
          <button className="btn ghost sm" type="submit">
            Salir
          </button>
        </form>
      </div>
    </header>
  )
}
