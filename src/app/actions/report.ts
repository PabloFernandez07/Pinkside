'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import { linesOf, MAX_LINE_LENGTH, MAX_LINES, parseWeek, REPORT_SECTIONS, type ReportSections } from '@/lib/report'
import type { FormState } from '@/lib/validation'

/** Guarda el informe de una semana. Lo comprueba también la base de datos (`roles.manage`). */
export async function saveWeeklyReport(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('roles.manage')
  const week = parseWeek(formData.get('week'))
  if (!week) return { message: 'La semana no es válida.' }

  const sections = {} as ReportSections
  for (const { id, title } of REPORT_SECTIONS) {
    const value = formData.get(id)
    const lines = typeof value === 'string' ? linesOf(value) : []
    if (lines.length > MAX_LINES) return { message: `${title}: máximo ${MAX_LINES} líneas.` }
    if (lines.some((line) => line.length > MAX_LINE_LENGTH)) {
      return { message: `${title}: cada línea admite hasta ${MAX_LINE_LENGTH} caracteres.` }
    }
    sections[id] = lines
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_weekly_report', { p_week: week, p_sections: sections })
  if (error) {
    return {
      message: error.code === '42501' ? 'No tienes permiso para guardar el informe.' : 'No se pudo guardar el informe.',
    }
  }

  revalidatePath('/admin/informe')
  return { ok: true, message: 'Informe guardado.' }
}
