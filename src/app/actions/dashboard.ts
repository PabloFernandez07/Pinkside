'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireMember } from '@/lib/access'
import { DASHBOARD_COOKIE, parseLayout, serializeLayout } from '@/lib/dashboard-layout'
import type { FormState } from '@/lib/validation'

/**
 * Guarda cómo quiere ver el Resumen este miembro en este navegador (cookie, sin base de datos).
 * ponytail: no se sincroniza entre dispositivos; si hiciera falta, una columna en profiles.
 * El valor se reconstruye con `parseLayout`, así que nada que no sea una tarjeta conocida llega a la cookie.
 */
export async function saveDashboardLayout(raw: string): Promise<FormState> {
  await requireMember('active')
  const value = serializeLayout(parseLayout(typeof raw === 'string' ? raw.slice(0, 200) : undefined))

  ;(await cookies()).set(DASHBOARD_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })

  revalidatePath('/resumen')
  return { ok: true }
}
