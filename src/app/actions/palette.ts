'use server'

import { getDisabledSections, requireMember } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'

export interface PaletteEntry {
  id: string
  name: string
  /** Texto secundario (categoría del item, rango del miembro…). */
  hint: string | null
}

export interface PaletteData {
  items: PaletteEntry[]
  recipes: PaletteEntry[]
  members: PaletteEntry[]
}

const LIMIT = 500

/** Lo que la paleta puede buscar: solo lo que el rango del miembro puede ver y las secciones activadas. */
export async function getPaletteData(): Promise<PaletteData> {
  const { permissions } = await requireMember('active')
  const disabled = await getDisabledSections()
  const supabase = await createClient()

  const canItems = permissions.has('inventory.view') && !disabled.has('inventario')
  const canRecipes = permissions.has('recipes.view') && !disabled.has('recetas')

  const [itemsRes, recipesRes, membersRes] = await Promise.all([
    canItems
      ? supabase.from('inventory_overview').select('id, name, category, archived').order('name').limit(LIMIT)
      : null,
    canRecipes ? supabase.from('recipes').select('id, name, archived').order('name').limit(LIMIT) : null,
    supabase
      .from('profiles')
      .select('id, first_name, last_name, discord_username, rank:ranks(name)')
      .eq('status', 'active')
      .limit(LIMIT),
  ])

  return {
    items: (itemsRes?.data ?? []).flatMap((row) =>
      row.id !== null && row.name !== null && !row.archived ? [{ id: String(row.id), name: row.name, hint: row.category }] : [],
    ),
    recipes: (recipesRes?.data ?? []).flatMap((row) => (row.archived ? [] : [{ id: String(row.id), name: row.name, hint: null }])),
    members: (membersRes.data ?? []).map((row) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.discord_username || 'Miembro',
      hint: row.rank?.name ?? null,
    })),
  }
}
