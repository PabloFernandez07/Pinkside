'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/access'
import { isSection } from '@/lib/sections'
import { createClient } from '@/lib/supabase/server'
import type { FormState } from '@/lib/validation'

interface SectionInput {
  section: string
  disabled: boolean
}

/** Activa o desactiva una sección del menú. Lo comprueba también la base de datos (`roles.manage`). */
export async function setSectionDisabled({ section, disabled }: SectionInput): Promise<FormState> {
  await requirePermission('roles.manage')
  if (!isSection(section) || typeof disabled !== 'boolean') return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_section_disabled', { p_section: section, p_disabled: disabled })
  if (error) {
    return {
      message: error.code === '42501' ? 'No tienes permiso para cambiar esto.' : 'No se pudo guardar el cambio.',
    }
  }

  // El menú está en el layout de toda la app: se refresca todo.
  revalidatePath('/', 'layout')
  return { ok: true }
}
