import Link from 'next/link'

interface AdminTabsProps {
  current: 'miembros' | 'rangos'
  canMembers: boolean
  canRoles: boolean
}

/** Pestañas de administración. Si solo hay una sección disponible, no se muestran. */
export function AdminTabs({ current, canMembers, canRoles }: AdminTabsProps) {
  if (!(canMembers && canRoles)) return null
  return (
    <nav className="tabs" aria-label="Secciones de administración">
      <Link href="/admin" aria-current={current === 'miembros' ? 'page' : undefined}>
        Miembros
      </Link>
      <Link href="/admin/rangos" aria-current={current === 'rangos' ? 'page' : undefined}>
        Rangos y permisos
      </Link>
    </nav>
  )
}
