import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'
import { routeForStatus } from '@/lib/rules'
import { parseDisabledSections, type SectionId } from '@/lib/sections'

export type MemberStatus = Database['public']['Enums']['member_status']
export type Profile = Database['public']['Tables']['profiles']['Row']

export type Access =
  | { state: 'anon' }
  | { state: 'orphan'; userId: string }
  | {
      state: 'member'
      profile: Profile
      rankName: string | null
      rankLevel: number | null
      permissions: ReadonlySet<string>
    }

export type MemberAccess = Extract<Access, { state: 'member' }>

/** Sesión + perfil + permisos del usuario actual. Una sola consulta por petición. */
export const getAccess = cache(async (): Promise<Access> => {
  const supabase = await createClient()
  // getClaims verifica el JWT; nunca uses getSession() para proteger datos.
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return { state: 'anon' }

  // Perfil, rango y permisos en una sola consulta (antes eran tres, dos de ellas encadenadas).
  const { data, error } = await supabase
    .from('profiles')
    .select('*, rank:ranks(name, level, rank_permissions(permission))')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error('No se pudo cargar tu perfil')
  if (!data) return { state: 'orphan', userId }

  const { rank, ...profile } = data
  if (profile.status !== 'active' || !rank) {
    return { state: 'member', profile, rankName: null, rankLevel: null, permissions: new Set() }
  }

  return {
    state: 'member',
    profile,
    rankName: rank.name,
    rankLevel: rank.level,
    permissions: new Set(rank.rank_permissions.map((row) => row.permission)),
  }
})

/** Secciones desactivadas desde Administración. Una vez por petición; si falla la consulta se muestran todas. */
export const getDisabledSections = cache(async (): Promise<ReadonlySet<SectionId>> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_disabled_sections')
  return error ? new Set() : parseDisabledSections(data)
})

/** Manda al resumen si la sección está desactivada (se usa en los layouts de Inventario y Recetas). */
export async function requireSection(section: SectionId): Promise<void> {
  if ((await getDisabledSections()).has(section)) redirect('/resumen')
}

/** Quién ve el mapa: los miembros a los que se les ha dado acceso y quien puede dárselo (la base de datos lo repite). */
export const canSeeMap = ({ profile, permissions }: MemberAccess): boolean =>
  profile.map_access || permissions.has('members.allow')

/** Exige un miembro en un estado concreto; si no, lo manda a donde corresponde. */
export async function requireMember(expected: MemberStatus): Promise<MemberAccess> {
  const access = await getAccess()
  if (access.state === 'anon') redirect('/login')
  if (access.state === 'orphan') redirect('/')
  if (access.profile.status !== expected) redirect(routeForStatus(access.profile.status))
  return access
}

/** Si el usuario actual puede ver la auditoría de accesos (lo decide la base de datos por ID de Discord). */
export const isAuditor = cache(async (): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('is_auditor')
  return data === true
})

/** Exige ser auditor; el resto, al resumen. */
export async function requireAuditor(): Promise<MemberAccess> {
  const access = await requireMember('active')
  if (!(await isAuditor())) redirect('/resumen')
  return access
}

/** Exige un miembro activo con un permiso concreto. */
export async function requirePermission(permission: string): Promise<MemberAccess> {
  const access = await requireMember('active')
  if (!access.permissions.has(permission)) redirect('/resumen')
  return access
}
