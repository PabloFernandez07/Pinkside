const SIZES = { sm: 28, md: 40, lg: 96 } as const

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Solo se muestran fotos del CDN de Discord (es de donde vienen); cualquier otra URL cae a las iniciales. */
const discordAvatar = (url: string | null | undefined): string | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'cdn.discordapp.com' ? parsed.toString() : null
  } catch {
    return null
  }
}

interface MemberAvatarProps {
  name: string
  url?: string | null
  size?: keyof typeof SIZES
}

/** Foto de Discord o iniciales. Decorativa: el nombre siempre va escrito al lado. */
export function MemberAvatar({ name, url, size = 'md' }: MemberAvatarProps) {
  const src = discordAvatar(url)
  const px = SIZES[size]
  if (!src) {
    return (
      <span aria-hidden="true" className={`avatar m-${size}`}>
        {initials(name)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto pequeña del CDN de Discord; no pasa por el optimizador
    <img src={src} alt="" width={px} height={px} referrerPolicy="no-referrer" className={`avatar-img m-${size}`} />
  )
}
