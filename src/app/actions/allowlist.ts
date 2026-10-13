'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import { addAllowedIdSchema, fieldErrors, removeAllowedIdSchema, type FormState } from '@/lib/validation'

function friendly(error: { code?: string }): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para hacer esto con esa cuenta.' }
    case '22023':
      return { message: 'Datos no válidos. Revisa el ID de Discord.' }
    case '23505':
      return { message: 'Ese ID ya está en la lista.' }
    case 'P0002':
      return { message: 'Ese ID ya no está en la lista.' }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

/** Autoriza un ID de Discord a entrar en la web. El permiso (`members.allow`) lo vuelve a comprobar la base de datos. */
export async function addAllowedId(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('members.allow')
  const parsed = addAllowedIdSchema.safeParse({ discordId: formData.get('discordId'), label: formData.get('label') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_allowed_discord_id', {
    p_discord_id: parsed.data.discordId,
    p_label: parsed.data.label as string, // los tipos generados no admiten null aunque la función sí
  })
  if (error) return friendly(error)

  revalidatePath('/miembros')
  return { ok: true, message: 'ID autorizado. Ya puede entrar con Discord.' }
}

/** Quita el permiso de entrada; si esa persona ya tenía cuenta, queda bloqueada. */
export async function removeAllowedId(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('members.allow')
  const parsed = removeAllowedIdSchema.safeParse({ discordId: formData.get('discordId') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_allowed_discord_id', { p_discord_id: parsed.data.discordId })
  if (error) return friendly(error)

  revalidatePath('/miembros')
  revalidatePath('/admin')
  return { ok: true, message: 'ID quitado de la lista' }
}
