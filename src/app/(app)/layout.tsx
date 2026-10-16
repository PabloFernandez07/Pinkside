import type { ReactNode } from 'react'
import { canSeeMap, getDisabledSections, requireMember } from '@/lib/access'
import { TopNav, type NavItem } from '@/components/top-nav'

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Las secciones desactivadas no dependen del perfil: se piden a la vez para ahorrar un viaje a la base.
  const [access, disabled] = await Promise.all([requireMember('active'), getDisabledSections()])
  const { profile, permissions, rankName } = access

  const items: NavItem[] = [{ href: '/resumen', label: 'Resumen', icon: 'resumen' }]
  if (permissions.has('cash.view')) items.push({ href: '/caja', label: 'Caja', icon: 'caja' })
  if (permissions.has('inventory.view') && !disabled.has('inventario')) {
    items.push({ href: '/inventario', label: 'Inventario', icon: 'inventario' })
  }
  if (permissions.has('recipes.view') && !disabled.has('recetas')) {
    items.push({ href: '/recetas', label: 'Recetas', icon: 'recetas' })
  }
  items.push({ href: '/urgentes', label: 'Urgentes', icon: 'urgentes' })
  items.push({ href: '/muro', label: 'Muro', icon: 'muro' })
  if (canSeeMap(access)) items.push({ href: '/mapa', label: 'Mapa', icon: 'mapa' })
  items.push({ href: '/miembros', label: 'Miembros', icon: 'miembros' })
  items.push({ href: '/ranking', label: 'Ranking', icon: 'ranking' })
  items.push({ href: '/perfil', label: 'Mi perfil', icon: 'perfil' })
  const canMembers = permissions.has('members.manage')
  if (canMembers || permissions.has('roles.manage')) {
    items.push({ href: canMembers ? '/admin' : '/admin/rangos', label: 'Administración', icon: 'admin' })
  }
  const name =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.discord_username || 'Miembro'

  return (
    <div className="shell">
      <a href="#main" className="skip">
        Saltar al contenido
      </a>
      <TopNav items={items} name={name} rank={rankName} />
      <div className="stage">
        <main id="main" tabIndex={-1} className="view">
          {children}
        </main>
      </div>
    </div>
  )
}
