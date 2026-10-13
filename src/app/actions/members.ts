'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import { approveMemberSchema, blockMemberSchema, type FormState } from '@/lib/validation'

type DbError = { code?: string } | null

function friendly(error: NonNullable<DbError>): FormState {
  if (error.code === '42501') return { message: 'No tienes permiso para esta acción.' }
  if (error.code === 'P0002') return { message: 'El miembro ya no está pendiente.' }
  return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
}

export async function approveMember(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('members.manage')
  const parsed = approveMemberSchema.safeParse({
    memberId: formData.get('memberId'),
    rankId: formData.get('rankId'),
  })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_member', {
    p_member: parsed.data.memberId,
    p_rank: parsed.data.rankId,
  })
  if (error) return friendly(error)

  revalidatePath('/admin')
  return { ok: true, message: 'Miembro aprobado' }
}

export async function setMemberRank(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('members.manage')
  const parsed = approveMemberSchema.safeParse({
    memberId: formData.get('memberId'),
    rankId: formData.get('rankId'),
  })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_member_rank', {
    p_member: parsed.data.memberId,
    p_rank: parsed.data.rankId,
  })
  if (error) return friendly(error)

  revalidatePath('/admin')
  return { ok: true, message: 'Rango actualizado' }
}

export async function setMemberBlocked(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('members.manage')
  const parsed = blockMemberSchema.safeParse({
    memberId: formData.get('memberId'),
    blocked: formData.get('blocked'),
  })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_member_blocked', {
    p_member: parsed.data.memberId,
    p_blocked: parsed.data.blocked,
  })
  if (error) return friendly(error)

  revalidatePath('/admin')
  return { ok: true, message: parsed.data.blocked ? 'Miembro bloqueado' : 'Miembro desbloqueado' }
}
