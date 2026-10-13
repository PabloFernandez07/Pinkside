'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/access'
import { fieldErrors, onboardingSchema, type FormState } from '@/lib/validation'

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember('onboarding')

  const parsed = onboardingSchema.safeParse({
    stateId: formData.get('stateId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_onboarding', {
    p_state_id: parsed.data.stateId,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone,
  })
  if (error) {
    if (error.code === '23505') return { errors: { stateId: ['Ese StateID ya está registrado'] } }
    return { message: 'No se pudo guardar tu ficha. Inténtalo de nuevo.' }
  }
  redirect('/')
}
