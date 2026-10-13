'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/access'
import { writePreferenceCookies } from '@/lib/accents'
import { fieldErrors, preferencesSchema, profileFieldsSchema, type FormState } from '@/lib/validation'

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember('active')

  const parsed = profileFieldsSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
    })
    .eq('id', profile.id)
  if (error) return { message: 'No se pudo guardar tu perfil. Inténtalo de nuevo.' }

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Perfil guardado' }
}

export async function updatePreferences(_prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireMember('active')

  const parsed = preferencesSchema.safeParse({
    theme: formData.get('theme'),
    accent: formData.get('accent'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const dmUrgent = formData.get('dmUrgent') === 'on'

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ theme: parsed.data.theme, accent: parsed.data.accent, dm_urgent: dmUrgent })
    .eq('id', profile.id)
  if (error) return { message: 'No se pudieron guardar las preferencias.' }

  writePreferenceCookies(await cookies(), parsed.data.theme, parsed.data.accent)

  revalidatePath('/', 'layout')
  return { ok: true, message: 'Preferencias guardadas' }
}
