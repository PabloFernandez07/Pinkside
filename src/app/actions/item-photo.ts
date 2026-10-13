'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/access'
import { ITEM_IMAGE_BUCKET } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'
import { fieldErrors, itemPhotoIdSchema, type FormState } from '@/lib/validation'

/** La foto llega ya reducida desde el navegador (~128 px): un archivo de más de 200 KB no es legítimo. */
const MAX_BYTES = 200 * 1024
const EXTENSIONS: Record<string, 'webp' | 'png'> = { 'image/webp': 'webp', 'image/png': 'png' }

/** Comprueba la firma real del archivo: el tipo declarado por el navegador no basta. */
function matchesSignature(bytes: Uint8Array, extension: 'webp' | 'png'): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  return extension === 'webp'
    ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    : bytes[0] === 0x89 && ascii(1, 4) === 'PNG'
}

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

/** Borra el archivo anterior de Storage; si falla no es grave (queda un archivo huérfano de pocos KB). */
async function removeOld(supabase: Awaited<ReturnType<typeof createClient>>, oldPath: string | null) {
  if (oldPath) await supabase.storage.from(ITEM_IMAGE_BUCKET).remove([oldPath])
}

export async function setItemPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('inventory.edit')
  const parsedId = itemPhotoIdSchema.safeParse({ itemId: formData.get('itemId') })
  if (!parsedId.success) return { errors: fieldErrors(parsedId.error) }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) return { message: 'Elige una imagen.' }
  const extension = EXTENSIONS[file.type]
  if (!extension) return { message: 'Formato no admitido: usa una imagen JPG, PNG o WebP.' }
  if (file.size > MAX_BYTES) return { message: 'La imagen es demasiado grande.' }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!matchesSignature(bytes, extension)) return { message: 'El archivo no es una imagen válida.' }

  const supabase = await createClient()
  const path = `${randomUUID()}.${extension}`
  const upload = await supabase.storage.from(ITEM_IMAGE_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) return friendly()

  const { data: oldPath, error } = await supabase.rpc('set_item_image', { p_id: parsedId.data.itemId, p_path: path })
  if (error) {
    await removeOld(supabase, path) // la foto recién subida no quedó asociada a ningún item
    return friendly(error.code)
  }
  await removeOld(supabase, oldPath)

  revalidatePath('/inventario', 'layout')
  revalidatePath('/recetas', 'layout')
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
  await removeOld(supabase, oldPath)

  revalidatePath('/inventario', 'layout')
  revalidatePath('/recetas', 'layout')
  return { ok: true, message: 'Foto quitada' }
}
