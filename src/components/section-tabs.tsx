import Link from 'next/link'

interface Tab {
  href: string
  label: string
  current: boolean
}

/** Pestañas de una sección (p. ej. Inventario / Historial). */
export function SectionTabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.current ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
