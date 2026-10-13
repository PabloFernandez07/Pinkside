'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import { deleteMapItemSchema, fieldErrors, saveAreaSchema, saveMarkerSchema } from '@/lib/validation'

export type MapActionResult =
  | { ok: true; id: number }
  | { ok: false; message?: string; errors?: Record<string, string[] | undefined> }

function friendly(error: { code?: string }): MapActionResult {
  switch (error.code) {
    case '42501':
      return { ok: false, message: 'No tienes permiso para editar el mapa.' }
    case '22023':
      return { ok: false, message: 'Datos no válidos (o has llegado al límite de elementos del mapa).' }
    case 'P0002':
      return { ok: false, message: 'Ese elemento ya no existe: otra persona lo habrá borrado.' }
    default:
      return { ok: false, message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

/** Crea o mueve/edita un icono. El permiso (`map.edit`) lo vuelve a comprobar la base de datos. */
export async function saveMarker(input: unknown): Promise<MapActionResult> {
  await requirePermission('map.edit')
  const parsed = saveMarkerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const marker = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_map_marker', {
    p_id: marker.markerId as number, // los tipos generados no admiten null en RPC aunque la función sí
    p_x: marker.x,
    p_y: marker.y,
    p_emoji: marker.emoji,
    p_title: marker.title,
    p_note: marker.note as string,
  })
  if (error) return friendly(error)

  revalidatePath('/mapa')
  return { ok: true, id: data }
}

export async function deleteMarker(input: unknown): Promise<MapActionResult> {
  await requirePermission('map.edit')
  const parsed = deleteMapItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Icono no válido.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_map_marker', { p_id: parsed.data.id })
  if (error) return friendly(error)

  revalidatePath('/mapa')
  return { ok: true, id: parsed.data.id }
}

/** Crea una zona (con sus puntos) o edita nombre, nota y color de una existente (sin puntos = conserva la forma). */
export async function saveArea(input: unknown): Promise<MapActionResult> {
  await requirePermission('map.edit')
  const parsed = saveAreaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const area = parsed.data
  if (area.areaId === null && area.points === null) return { ok: false, message: 'Marca al menos 3 puntos en el mapa.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_map_area', {
    p_id: area.areaId as number,
    p_name: area.name,
    p_note: area.note as string,
    p_color: area.color,
    p_points: area.points as unknown as never,
  })
  if (error) return friendly(error)

  revalidatePath('/mapa')
  return { ok: true, id: data }
}

export async function deleteArea(input: unknown): Promise<MapActionResult> {
  await requirePermission('map.edit')
  const parsed = deleteMapItemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Zona no válida.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_map_area', { p_id: parsed.data.id })
  if (error) return friendly(error)

  revalidatePath('/mapa')
  return { ok: true, id: parsed.data.id }
}
