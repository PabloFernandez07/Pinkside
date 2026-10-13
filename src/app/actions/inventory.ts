'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/access'
import { MAX_IMPORT_ROWS, parseItemsCsv } from '@/lib/csv'
import { deleteItemImage, storePhotoFromForm } from '@/lib/server/item-image-store'
import {
  archiveItemSchema,
  fieldErrors,
  importItemsSchema,
  itemFieldsSchema,
  reverseStockSchema,
  stockMovementSchema,
  updateItemSchema,
  type FormState,
} from '@/lib/validation'

/** Qué se estaba haciendo: algunos códigos de error significan cosas distintas según la acción. */
type Context = 'item' | 'move' | 'reverse' | 'import'

function friendly(error: { code?: string }, context: Context): FormState {
  switch (error.code) {
    case '42501':
      return { message: 'No tienes permiso para gestionar el inventario.' }
    case '22023':
      return { message: 'Datos no válidos.' }
    case 'P0002':
      return { message: 'Ese item o movimiento ya no existe.' }
    case 'P0003':
      return {
        message: context === 'reverse' ? 'No se puede anular una anulación.' : 'El item está archivado: desarchívalo para moverlo.',
      }
    case 'PK002':
      return {
        message: context === 'reverse' ? 'No hay stock suficiente para anular ese movimiento.' : 'No hay stock suficiente para esa salida.',
      }
    case '23505':
      return {
        message: context === 'reverse' ? 'Ese movimiento ya está anulado.' : 'Ya existe un item con ese nombre.',
      }
    default:
      return { message: 'No se pudo completar la acción. Inténtalo de nuevo.' }
  }
}

const refresh = () => {
  revalidatePath('/inventario', 'layout')
}

export async function createItem(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = itemFieldsSchema.safeParse({
    name: formData.get('name'),
    category: formData.get('category'),
    minStock: formData.get('minStock'),
    unitCost: formData.get('unitCost'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  // La foto (archivo o URL) se procesa antes de crear el item: si no vale, no se crea nada a medias.
  const photo = await storePhotoFromForm(formData)
  if (!photo.ok) return { errors: { photo: [photo.message] } }

  const supabase = await createClient()
  const { data: itemId, error } = await supabase.rpc('create_item', {
    p_name: parsed.data.name,
    p_category: parsed.data.category ?? '',
    p_min_stock: parsed.data.minStock,
    p_unit_cost: parsed.data.unitCost,
  })
  if (error) {
    await deleteItemImage(photo.path)
    return friendly(error, 'item')
  }
  if (photo.path) {
    const { error: photoError } = await supabase.rpc('set_item_image', { p_id: itemId, p_path: photo.path })
    if (photoError) {
      await deleteItemImage(photo.path)
      refresh()
      return { ok: true, message: 'Item creado, pero no se pudo asociar la foto. Añádela desde su ficha.' }
    }
  }

  refresh()
  return { ok: true, message: 'Item creado' }
}

export async function updateItem(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = updateItemSchema.safeParse({
    itemId: formData.get('itemId'),
    name: formData.get('name'),
    category: formData.get('category'),
    minStock: formData.get('minStock'),
    unitCost: formData.get('unitCost'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_item', {
    p_id: parsed.data.itemId,
    p_name: parsed.data.name,
    p_category: parsed.data.category ?? '',
    p_min_stock: parsed.data.minStock,
    p_unit_cost: parsed.data.unitCost,
  })
  if (error) return friendly(error, 'item')

  refresh()
  return { ok: true, message: 'Item guardado' }
}

export async function setItemArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = archiveItemSchema.safeParse({
    itemId: formData.get('itemId'),
    archived: formData.get('archived'),
  })
  if (!parsed.success) return { message: 'Datos no válidos.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_item_archived', {
    p_id: parsed.data.itemId,
    p_archived: parsed.data.archived,
  })
  if (error) return friendly(error, 'item')

  refresh()
  return { ok: true, message: parsed.data.archived ? 'Item archivado' : 'Item restaurado' }
}

/** Entradas y salidas de stock; la base de datos impide dejar el stock en negativo. */
export async function registerStock(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = stockMovementSchema.safeParse({
    itemId: formData.get('itemId'),
    kind: formData.get('kind'),
    quantity: formData.get('quantity'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('register_stock_movement', {
    p_item: parsed.data.itemId,
    p_kind: parsed.data.kind,
    p_qty: parsed.data.quantity,
    p_reason: parsed.data.reason,
  })
  if (error) return friendly(error, 'move')

  refresh()
  return { ok: true, message: parsed.data.kind === 'in' ? 'Entrada registrada' : 'Salida registrada' }
}

export async function reverseStock(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = reverseStockSchema.safeParse({
    movementId: formData.get('movementId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reverse_stock_movement', {
    p_id: parsed.data.movementId,
    p_reason: parsed.data.reason,
  })
  if (error) return friendly(error, 'reverse')

  refresh()
  return { ok: true, message: 'Movimiento anulado' }
}

/** Importación masiva desde texto pegado. Todo o nada: si hay un fallo no se importa ninguna fila. */
export async function importItems(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsed = importItemsSchema.safeParse({ csv: formData.get('csv') })
  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const { rows, issues } = parseItemsCsv(parsed.data.csv)
  if (issues.length > 0) {
    const shown = issues.slice(0, 5).map((issue) => (issue.line > 0 ? `Línea ${issue.line}: ${issue.message}` : issue.message))
    if (issues.length > shown.length) shown.push(`…y ${issues.length - shown.length} problemas más`)
    return { errors: { csv: shown }, message: `No se ha importado nada: corrige ${issues.length} problema${issues.length === 1 ? '' : 's'} y vuelve a intentarlo.` }
  }
  if (rows.length > MAX_IMPORT_ROWS) return { message: `Máximo ${MAX_IMPORT_ROWS} filas por importación.` }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_items_bulk', {
    p_items: rows.map((row) => ({
      name: row.name,
      category: row.category,
      min_stock: row.minStock,
      unit_cost: row.unitCost,
    })),
  })
  if (error) return friendly(error, 'import')

  const summary = typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}
  const created = Number(summary.created ?? 0)
  const skipped = Number(summary.skipped ?? 0)

  refresh()
  return {
    ok: true,
    message:
      `${created} item${created === 1 ? '' : 's'} importado${created === 1 ? '' : 's'}` +
      (skipped > 0 ? ` · ${skipped} ya existía${skipped === 1 ? '' : 'n'} y se omitió${skipped === 1 ? '' : 'eron'}` : ''),
  }
}
