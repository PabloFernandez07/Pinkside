'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import {
  createRankSchema,
  deleteRankSchema,
  fieldErrors,
  rankPermissionSchema,
  updateRankSchema,
  type FormState,
} from '@/lib/validation'

function friendly(error: { code?: string }): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para este cambio.' }
    case '23505':
      return { message: 'Ya existe un rango con ese nombre o ese nivel.' }
    case '23503':
      return { message: 'Hay miembros con este rango: cámbiales el rango antes de borrarlo.' }
    case 'P0003':
      return { message: 'Ese cambio dejaría la administración bloqueada.' }
    case 'P0002':
      return { message: 'El rango o el permiso ya no existe.' }
    case '22023':
      return { message: 'Datos no válidos.' }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

// Los permisos de rango afectan a toda la app (menús, accesos), así que se revalida desde la raíz.
const refresh = () => revalidatePath('/admin/rangos')

export async function setRankPermission(input: {
  rankId: number
  permission: string
  allowed: boolean
}): Promise<FormState> {
  await requirePermission('roles.manage')
  const parsed = rankPermissionSchema.safeParse(input)
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rank_permission', {
    p_rank: parsed.data.rankId,
    p_permission: parsed.data.permission,
    p_allowed: parsed.data.allowed,
  })
  if (error) return friendly(error)

  refresh()
  return { ok: true }
}

export async function createRank(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('roles.manage')
  const parsed = createRankSchema.safeParse({
    name: formData.get('name'),
    level: formData.get('level'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_rank', {
    p_name: parsed.data.name,
    p_level: parsed.data.level,
  })
  if (error) return friendly(error)

  refresh()
  return { ok: true, message: 'Rango creado' }
}

export async function updateRank(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('roles.manage')
  const parsed = updateRankSchema.safeParse({
    rankId: formData.get('rankId'),
    name: formData.get('name'),
    level: formData.get('level'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rank', {
    p_rank: parsed.data.rankId,
    p_name: parsed.data.name,
    p_level: parsed.data.level,
  })
  if (error) return friendly(error)

  refresh()
  return { ok: true, message: 'Rango guardado' }
}

export async function deleteRank(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('roles.manage')
  const parsed = deleteRankSchema.safeParse({ rankId: formData.get('rankId') })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_rank', { p_rank: parsed.data.rankId })
  if (error) return friendly(error)

  refresh()
  return { ok: true, message: 'Rango borrado' }
}
