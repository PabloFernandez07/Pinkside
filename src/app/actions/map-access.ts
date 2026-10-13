'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import type { FormState } from '@/lib/validation'

const mapAccessSchema = z.object({ memberId: z.uuid(), allowed: z.boolean() })

/** Da o quita a un miembro el acceso al mapa. Lo comprueba también la base de datos (`members.allow`). */
export async function setMapAccess(input: { memberId: string; allowed: boolean }): Promise<FormState> {
  await requirePermission('members.allow')
  const parsed = mapAccessSchema.safeParse(input)
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_member_map_access', {
    p_member: parsed.data.memberId,
    p_value: parsed.data.allowed,
  })
  if (error) {
    return {
      message: error.code === '42501' ? 'No tienes permiso para cambiar esto.' : 'No se pudo guardar el cambio.',
    }
  }

  // Afecta al menú de esa persona (layout) y a esta tabla.
  revalidatePath('/', 'layout')
  return { ok: true }
}
