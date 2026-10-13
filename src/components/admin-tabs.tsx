import Link from 'next/link'

interface AdminTabsProps {
  current: 'miembros' | 'rangos' | 'secciones'
  canMembers: boolean
  canRoles: boolean
}

/** Pestañas de administración. Si solo hay una sección disponible, no se muestran. */
export function AdminTabs({ current, canMembers, canRoles }: AdminTabsProps) {
  const tabs = [
    canMembers && { id: 'miembros', href: '/admin', label: 'Miembros' },
    canRoles && { id: 'rangos', href: '/admin/rangos', label: 'Rangos y permisos' },
    canRoles && { id: 'secciones', href: '/admin/secciones', label: 'Secciones' },
  ].filter((tab) => tab !== false)
  if (tabs.length < 2) return null
  return (
    <nav className="tabs" aria-label="Secciones de administración">
      {tabs.map((tab) => (
        <Link key={tab.id} href={tab.href} aria-current={current === tab.id ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
