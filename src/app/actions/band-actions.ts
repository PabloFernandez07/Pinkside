'use server'

import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/access'
import { isBandAction, MAX_ACTION_NOTE, MAX_ACTION_QTY } from '@/lib/band-actions'
import { createClient } from '@/lib/supabase/server'
import type { FormState } from '@/lib/validation'

interface LogInput {
  kind: string
  qty: number
  note: string
}

/** Apunta una acción de la banda. Lo comprueba también la base de datos (miembro activo). */
export async function logBandAction({ kind, qty, note }: LogInput): Promise<FormState> {
  await requireMember('active')
  const cleanNote = typeof note === 'string' ? note.trim() : ''
  if (!isBandAction(kind) || !Number.isInteger(qty) || qty < 1 || qty > MAX_ACTION_QTY) {
    return { message: 'Datos no válidos.' }
  }
  if (cleanNote.length > MAX_ACTION_NOTE) return { message: `La nota admite hasta ${MAX_ACTION_NOTE} caracteres.` }

  const supabase = await createClient()
  const { error } = await supabase.rpc('log_band_action', { p_kind: kind, p_qty: qty, p_note: cleanNote || null })
  if (error) return { message: 'No se pudo apuntar la acción.' }

  revalidatePath('/acciones')
  return { ok: true }
}

/** Borra una acción propia (o cualquiera si puedes gestionar rangos). */
export async function deleteBandAction(id: number): Promise<FormState> {
  await requireMember('active')
  if (!Number.isInteger(id) || id < 1) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_band_action', { p_id: id })
  if (error) {
    return { message: error.code === 'P0002' ? 'Solo puedes borrar tus propias acciones.' : 'No se pudo borrar.' }
  }

  revalidatePath('/acciones')
  return { ok: true }
}
