'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import {
  archiveRecipeSchema,
  craftSchema,
  fieldErrors,
  recipeIdSchema,
  recipeSchema,
  type FormState,
} from '@/lib/validation'

type Context = 'save' | 'craft' | 'other'

/** PostgREST acepta `null` en estos parámetros, pero los tipos generados no lo reflejan. */
const nullable = <T>(value: T | null): T => value as T

function friendly(error: { code?: string; details?: string | null }, context: Context): FormState {
  const item = error.details ? `«${error.details}»` : null
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para hacer esto con las recetas.' }
    case '22023':
      return { message: 'Datos no válidos.' }
    case 'P0002':
      return { message: context === 'save' ? 'Algún item de la receta ya no existe.' : 'Esa receta ya no existe.' }
    case 'P0003':
      return { message: item ? `No se puede fabricar: ${item} está archivado.` : 'No se puede fabricar: la receta está archivada.' }
    case 'PK002':
      return { message: `No hay stock suficiente${item ? ` de ${item}` : ''}.` }
    case '23505':
      return { message: 'Ya existe una receta con ese nombre.' }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

const refresh = () => {
  revalidatePath('/recetas', 'layout')
  // Fabricar mueve stock, así que el inventario también cambia.
  revalidatePath('/inventario', 'layout')
}

export async function saveRecipe(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('recipes.edit')
  const parsed = recipeSchema.safeParse({
    recipeId: formData.get('recipeId'),
    name: formData.get('name'),
    notes: formData.get('notes'),
    salePrice: formData.get('salePrice'),
    outputQty: formData.get('outputQty'),
    outputItemId: formData.get('outputItemId'),
    ingredients: formData.get('ingredients'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const recipe = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_recipe', {
    p_id: nullable(recipe.recipeId),
    p_name: recipe.name,
    p_notes: recipe.notes ?? '',
    p_sale_price: recipe.salePrice,
    p_output_qty: recipe.outputQty,
    p_output_item: nullable(recipe.outputItemId),
    p_ingredients: recipe.ingredients.map((line) => ({ item_id: line.itemId, quantity: line.quantity })),
  })
  if (error) return friendly(error, 'save')

  refresh()
  redirect(`/recetas?r=${data}`)
}

/** Resta los ingredientes del inventario y suma el producto. Todo o nada. */
export async function craftRecipe(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = craftSchema.safeParse({
    recipeId: formData.get('recipeId'),
    batches: formData.get('batches'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('craft_recipe', {
    p_recipe: parsed.data.recipeId,
    p_batches: parsed.data.batches,
  })
  if (error) return friendly(error, 'craft')

  const summary = typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}
  const units = Number(summary.units ?? 0)
  const hasOutput = summary.output_item_id !== null && summary.output_item_id !== undefined

  refresh()
  return {
    ok: true,
    message: hasOutput
      ? `Fabricadas ${units} unidades: ingredientes descontados y producto añadido al inventario.`
      : 'Ingredientes descontados del inventario (esta receta no tiene item de salida).',
  }
}

export async function setRecipeArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('recipes.edit')
  const parsed = archiveRecipeSchema.safeParse({
    recipeId: formData.get('recipeId'),
    archived: formData.get('archived'),
  })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_recipe_archived', {
    p_id: parsed.data.recipeId,
    p_archived: parsed.data.archived,
  })
  if (error) return friendly(error, 'other')

  refresh()
  return { ok: true, message: parsed.data.archived ? 'Receta archivada' : 'Receta restaurada' }
}

export async function deleteRecipe(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('recipes.edit')
  const parsed = recipeIdSchema.safeParse({ recipeId: formData.get('recipeId') })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_recipe', { p_id: parsed.data.recipeId })
  if (error) return friendly(error, 'other')

  refresh()
  redirect('/recetas')
}
