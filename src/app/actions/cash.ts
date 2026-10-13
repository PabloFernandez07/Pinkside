'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import { cashMovementSchema, fieldErrors, reverseMovementSchema, type FormState } from '@/lib/validation'

function friendly(error: { code?: string }): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para hacer esto con la caja.' }
    case '22023':
      return { message: 'Datos no válidos.' }
    case 'P0002':
      return { message: 'Ese movimiento ya no existe.' }
    case 'P0003':
      return { message: 'No se puede anular una anulación.' }
    case '23505':
      return { message: 'Ese movimiento ya está anulado.' }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

/** Entradas con `cash.write`, salidas con `cash.withdraw`: lo decide la base de datos. */
export async function registerMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cash.view')
  const parsed = cashMovementSchema.safeParse({
    kind: formData.get('kind'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('register_cash_movement', {
    p_kind: parsed.data.kind,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  })
  if (error) return friendly(error)

  revalidatePath('/caja')
  return { ok: true, message: parsed.data.kind === 'in' ? 'Entrada registrada' : 'Salida registrada' }
}

/** Crea el movimiento contrario enlazado al original; el original nunca se modifica. */
export async function reverseMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cash.withdraw')
  const parsed = reverseMovementSchema.safeParse({
    movementId: formData.get('movementId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reverse_cash_movement', {
    p_id: parsed.data.movementId,
    p_reason: parsed.data.reason,
  })
  if (error) return friendly(error)

  revalidatePath('/caja')
  return { ok: true, message: 'Movimiento anulado' }
}
