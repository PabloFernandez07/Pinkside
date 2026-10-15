'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import { cashBalanceSchema, fieldErrors, reverseMovementSchema, type FormState } from '@/lib/validation'

function friendly(error: { code?: string }): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para hacer esto con la caja.' }
    case '22023':
      return { message: 'Datos no válidos.' }
    case 'PK004':
      return { message: 'Tu cuenta ya tiene ese saldo.' }
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

/** Fija el saldo total de la cuenta del miembro; subir exige `cash.write` y bajar `cash.withdraw` (lo decide la base). */
export async function setBalance(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cash.view')
  const parsed = cashBalanceSchema.safeParse({ balance: formData.get('balance') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_cash_balance', { p_balance: parsed.data.balance })
  if (error) return friendly(error)

  revalidatePath('/caja')
  return { ok: true, message: 'Cuenta actualizada' }
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
