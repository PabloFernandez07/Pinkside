'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import { closeUrgentSchema, fieldErrors, urgentRequestSchema, type FormState } from '@/lib/validation'

function friendly(error: { code?: string }): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para enviar avisos urgentes.' }
    case '22023':
      return { message: 'Datos no válidos. Revisa el pedido y los destinatarios.' }
    case 'P0002':
      return { message: 'El item o el pedido ya no existe.' }
    case 'P0003':
      return { message: 'Ese pedido ya estaba cerrado.' }
    case 'PK003':
      return { message: 'Has enviado demasiados pedidos seguidos. Espera unos minutos.' }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

/** Crea el pedido y deja un aviso en cola por destinatario; el permiso y los límites los aplica la base de datos. */
export async function createUrgentRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('urgent.send')
  const parsed = urgentRequestSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    priority: formData.get('priority'),
    itemId: formData.get('itemId'),
    recipients: formData.getAll('recipients'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  // Los tipos generados no admiten null en los argumentos de una RPC aunque la función sí lo acepta.
  const { error } = await supabase.rpc('create_urgent_request', {
    p_title: parsed.data.title,
    p_body: parsed.data.body as string,
    p_priority: parsed.data.priority,
    p_item_id: parsed.data.itemId as number,
    p_recipients: parsed.data.recipients,
  })
  if (error) return friendly(error)

  revalidatePath('/urgentes')
  revalidatePath('/resumen')
  return { ok: true, message: 'Pedido urgente creado' }
}

export async function closeUrgentRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('urgent.send')
  const parsed = closeUrgentSchema.safeParse({
    requestId: formData.get('requestId'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('close_urgent_request', {
    p_id: parsed.data.requestId,
    p_status: parsed.data.status,
  })
  if (error) return friendly(error)

  revalidatePath('/urgentes')
  revalidatePath('/resumen')
  return { ok: true, message: parsed.data.status === 'covered' ? 'Pedido cubierto' : 'Pedido cancelado' }
}
