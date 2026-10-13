'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/access'
import { deleteItemImage, storePhotoFromForm } from '@/lib/server/item-image-store'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, itemPhotoIdSchema, type FormState } from '@/lib/validation'

function friendly(code?: string): FormState {
  switch (code) {
    case '42501':
      return { message: 'No tienes permiso para cambiar fotos del inventario.' }
    case 'P0002':
      return { message: 'Ese item ya no existe.' }
    default:
      return { message: 'No se pudo guardar la foto. Inténtalo de nuevo.' }
  }
}

const refresh = () => {
  revalidatePath('/inventario', 'layout')
  revalidatePath('/recetas', 'layout')
}

/** Cambia la foto de un item con un archivo adjunto o con una URL (el servidor la reduce y la guarda). */
export async function setItemPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsedId = itemPhotoIdSchema.safeParse({ itemId: formData.get('itemId') })
  if (!parsedId.success) return { errors: fieldErrors(parsedId.error) }

  const photo = await storePhotoFromForm(formData)
  if (!photo.ok) return { message: photo.message }
  if (!photo.path) return { message: 'Elige una imagen o pega una dirección.' }

  const supabase = await createClient()
  const { data: oldPath, error } = await supabase.rpc('set_item_image', { p_id: parsedId.data.itemId, p_path: photo.path })
  if (error) {
    await deleteItemImage(photo.path) // la foto recién subida no quedó asociada a ningún item
    return friendly(error.code)
  }
  await deleteItemImage(oldPath)

  refresh()
  return { ok: true, message: 'Foto guardada' }
}

export async function removeItemPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsedId = itemPhotoIdSchema.safeParse({ itemId: formData.get('itemId') })
  if (!parsedId.success) return { errors: fieldErrors(parsedId.error) }

  const supabase = await createClient()
  // Los tipos generados no admiten null en los argumentos de una RPC aunque la función sí lo acepta.
  const { data: oldPath, error } = await supabase.rpc('set_item_image', {
    p_id: parsedId.data.itemId,
    p_path: null as unknown as string,
  })
  if (error) return friendly(error.code)
  await deleteItemImage(oldPath)

  refresh()
  return { ok: true, message: 'Foto quitada' }
}
