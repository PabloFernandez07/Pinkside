import type { Database } from '@/lib/database.types'

type MemberStatus = Database['public']['Enums']['member_status']

const ROUTES: Record<MemberStatus, string> = {
  onboarding: '/onboarding',
  pending: '/pendiente',
  blocked: '/pendiente',
  active: '/resumen',
}

/** Nivel del rango Líder: único, intocable y con todos los permisos de administración. */
export const LEADER_LEVEL = 100

/** Permisos que el Líder nunca puede perder para no dejar la administración bloqueada. */
export const PROTECTED_LEADER_PERMISSIONS: readonly string[] = ['members.manage', 'roles.manage']

/** Un actor solo gestiona rangos inferiores al suyo; el Líder puede gestionarlos todos. */
export const canManageRank = (actorLevel: number, targetLevel: number): boolean =>
  actorLevel >= LEADER_LEVEL || targetLevel < actorLevel

/** Si quitar este permiso a este rango está prohibido (solo afecta al Líder). */
export const isProtectedPermission = (rankLevel: number, permission: string): boolean =>
  rankLevel >= LEADER_LEVEL && PROTECTED_LEADER_PERMISSIONS.includes(permission)

/** Página a la que corresponde un miembro según su estado de acceso. */
export const routeForStatus = (status: MemberStatus): string => ROUTES[status]

/**
 * Solo permite rutas internas para redirecciones tras el login.
 * Evita redirecciones abiertas como `//evil.com`, `/\evil.com` o `https://evil.com`.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  if (next.includes('\\') || /[\u0000-\u001f]/.test(next)) return fallback
  return next
}
