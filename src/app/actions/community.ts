'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireMember, requirePermission } from '@/lib/access'
import { METRIC_KEYS, WALL_EMOJIS } from '@/lib/community'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, type FormState } from '@/lib/validation'

function friendly(error: { code?: string }): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para este cambio.' }
    case 'P0002':
      return { message: 'Eso ya no existe.' }
    case '22023':
      return { message: 'Datos no válidos.' }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

const refreshWall = () => {
  revalidatePath('/muro')
  revalidatePath('/resumen')
}

const wallSchema = z.object({
  body: z
    .string({ error: 'Escribe el aviso' })
    .trim()
    .min(2, { error: 'El aviso es demasiado corto' })
    .max(500, { error: 'Máximo 500 caracteres' }),
})

export async function postWall(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('wall.post')
  const parsed = wallSchema.safeParse({ body: formData.get('body') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('post_wall', { p_body: parsed.data.body, p_pinned: formData.get('pinned') === 'on' })
  if (error) return friendly(error)

  refreshWall()
  return { ok: true, message: 'Aviso publicado' }
}

const postIdSchema = z.object({ id: z.number().int().positive() })

export async function deleteWallPost(input: { id: number }): Promise<FormState> {
  await requireMember('active')
  const parsed = postIdSchema.safeParse(input)
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_wall_post', { p_id: parsed.data.id })
  if (error) return friendly(error)

  refreshWall()
  return { ok: true }
}

export async function setWallPinned(input: { id: number; pinned: boolean }): Promise<FormState> {
  await requirePermission('wall.post')
  const parsed = postIdSchema.extend({ pinned: z.boolean() }).safeParse(input)
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_wall_pinned', { p_id: parsed.data.id, p_pinned: parsed.data.pinned })
  if (error) return friendly(error)

  refreshWall()
  return { ok: true }
}

export async function toggleReaction(input: { postId: number; emoji: string }): Promise<FormState> {
  await requireMember('active')
  const parsed = z
    .object({ postId: z.number().int().positive(), emoji: z.enum(WALL_EMOJIS) })
    .safeParse(input)
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('toggle_wall_reaction', { p_post: parsed.data.postId, p_emoji: parsed.data.emoji })
  if (error) return friendly(error)

  revalidatePath('/muro')
  return { ok: true }
}

/** Un campo vacío quita el requisito; si no, un entero de 0 a 100000. */
const targetField = z
  .string()
  .trim()
  .regex(/^\d{0,6}$/, { error: 'Usa un número entero' })
  .transform(Number)
  .pipe(z.number().max(100_000, { error: 'Máximo 100000' }))

export async function saveRankRequirements(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('roles.manage')
  const parsed = z
    .object({
      rankId: z.coerce.number().int().positive(),
      days: targetField,
      cash_moves: targetField,
      stock_moves: targetField,
      crafts: targetField,
      urgents: targetField,
    })
    .safeParse({
      rankId: formData.get('rankId'),
      ...Object.fromEntries(METRIC_KEYS.map((key) => [key, String(formData.get(key) ?? '')])),
    })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  for (const key of METRIC_KEYS) {
    const { error } = await supabase.rpc('set_rank_requirement', {
      p_rank: parsed.data.rankId,
      p_metric: key,
      p_target: parsed.data[key],
    })
    if (error) return friendly(error)
  }

  revalidatePath('/admin/rangos')
  revalidatePath('/resumen')
  return { ok: true, message: 'Requisitos guardados' }
}
