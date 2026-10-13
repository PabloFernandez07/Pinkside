import Image from 'next/image'
import { itemImageUrl, itemInitial } from '@/lib/images'

const PIXELS = { sm: 28, md: 40, lg: 72 } as const

interface ItemThumbProps {
  name: string
  path: string | null | undefined
  /** sm: 28 px (celdas densas) · md: 40 px (listas) · lg: 72 px (ficha del item). */
  size?: keyof typeof PIXELS
}

/** Miniatura del item, o su inicial si no tiene foto. Decorativa: el nombre siempre va escrito al lado. */
export function ItemThumb({ name, path, size = 'md' }: ItemThumbProps) {
  const url = itemImageUrl(path)
  if (!url) {
    return (
      <span aria-hidden="true" className={`thumb ph ${size}`}>
        {itemInitial(name)}
      </span>
    )
  }
  const px = PIXELS[size]
  // `unoptimized`: la foto ya se guarda reducida (128 px); evita pasar por el optimizador de imágenes de Vercel.
  return <Image src={url} alt="" width={px} height={px} unoptimized className={`thumb ${size}`} />
}
