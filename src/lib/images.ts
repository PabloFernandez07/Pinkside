export const ITEM_IMAGE_BUCKET = 'item-images'

/** Lado (px) al que se reduce la foto antes de subirla: sobra para miniaturas de hasta 72 px a doble densidad. */
export const ITEM_IMAGE_SIZE = 128

/** El nombre guardado en BD: un UUID con extensión (lo valida también una restricción SQL). */
export const ITEM_IMAGE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpg)$/

/** URL pública de la foto de un item, o null si no tiene (o falta la URL de Supabase). */
export function itemImageUrl(path: string | null | undefined, baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!path || !baseUrl || !ITEM_IMAGE_PATTERN.test(path)) return null
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${ITEM_IMAGE_BUCKET}/${path}`
}

/** Inicial para el marcador cuando el item no tiene foto. */
export const itemInitial = (name: string): string => name.trim().charAt(0).toUpperCase() || '?'
