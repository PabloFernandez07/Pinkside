import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { ITEM_IMAGE_BUCKET, ITEM_IMAGE_SIZE } from '@/lib/images'
import { fetchRemoteImage } from '@/lib/server/remote-image'
import { createClient } from '@/lib/supabase/server'

/** Un archivo adjunto llega ya reducido desde el navegador (unos KB); más de esto no es legítimo. */
const MAX_FILE_BYTES = 900 * 1024
/** Evita «bombas» de descompresión: una imagen enorme en pocos KB. */
const MAX_PIXELS = 24_000_000

export type PhotoOutcome = { ok: true; path: string | null } | { ok: false; message: string }

const REMOTE_MESSAGE = {
  url: 'La dirección de la imagen no es válida: usa un enlace https público.',
  blocked: 'La dirección de la imagen no es válida: usa un enlace https público.',
  network: 'No se pudo descargar la imagen de esa dirección.',
  type: 'Esa dirección no es una imagen.',
  size: 'La imagen es demasiado grande (máximo 3 MB).',
} as const

async function bytesFromForm(formData: FormData, fileField: string, urlField: string) {
  const file = formData.get(fileField)
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return { ok: false, message: 'La imagen es demasiado grande.' } as const
    return { ok: true, bytes: Buffer.from(await file.arrayBuffer()) } as const
  }
  const rawUrl = formData.get(urlField)
  if (typeof rawUrl === 'string' && rawUrl.trim() !== '') {
    const remote = await fetchRemoteImage(rawUrl)
    return remote.ok ? ({ ok: true, bytes: remote.bytes } as const) : ({ ok: false, message: REMOTE_MESSAGE[remote.reason] } as const)
  }
  return { ok: true, bytes: null } as const
}

/**
 * Toma la foto del formulario (archivo adjunto o URL), la recorta en cuadrado, la reduce a 128 px en WebP y la sube
 * al bucket. `sharp` decodifica de verdad: un archivo que no sea una imagen se rechaza aquí, no solo por su cabecera.
 * Sin archivo ni URL devuelve `path: null` (sin foto).
 */
export async function storePhotoFromForm(formData: FormData, fileField = 'photo', urlField = 'photoUrl'): Promise<PhotoOutcome> {
  const source = await bytesFromForm(formData, fileField, urlField)
  if (!source.ok) return source
  if (!source.bytes) return { ok: true, path: null }

  let thumbnail: Buffer
  try {
    thumbnail = await sharp(source.bytes, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
      .rotate()
      .resize(ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    return { ok: false, message: 'El archivo no es una imagen válida (usa JPG, PNG o WebP).' }
  }

  const supabase = await createClient()
  const path = `${randomUUID()}.webp`
  const upload = await supabase.storage.from(ITEM_IMAGE_BUCKET).upload(path, thumbnail, {
    contentType: 'image/webp',
    upsert: false,
  })
  if (upload.error) return { ok: false, message: 'No se pudo guardar la foto. Inténtalo de nuevo.' }
  return { ok: true, path }
}

/** Borra un archivo de fotos; si falla no es grave (queda un archivo huérfano de pocos KB). */
export async function deleteItemImage(path: string | null): Promise<void> {
  if (!path) return
  const supabase = await createClient()
  await supabase.storage.from(ITEM_IMAGE_BUCKET).remove([path])
}
