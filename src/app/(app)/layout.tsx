import type { ReactNode } from 'react'
import { requireMember } from '@/lib/access'
import { TopNav, type NavItem } from '@/components/top-nav'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { profile, permissions, rankName } = await requireMember('active')

  const items: NavItem[] = [{ href: '/resumen', label: 'Resumen', icon: 'resumen' }]
  if (permissions.has('cash.view')) items.push({ href: '/caja', label: 'Caja', icon: 'caja' })
  if (permissions.has('inventory.view')) items.push({ href: '/inventario', label: 'Inventario', icon: 'inventario' })
  if (permissions.has('recipes.view')) items.push({ href: '/recetas', label: 'Recetas', icon: 'recetas' })
  items.push({ href: '/urgentes', label: 'Urgentes', icon: 'urgentes' })
  items.push({ href: '/miembros', label: 'Miembros', icon: 'miembros' })
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
