export const ACCENT_IDS = ['emerald', 'pink', 'indigo', 'amber', 'cyan'] as const
export const THEME_IDS = ['system', 'light', 'dark'] as const

export type AccentId = (typeof ACCENT_IDS)[number]
export type ThemeId = (typeof THEME_IDS)[number]

export const ACCENTS: ReadonlyArray<{ id: AccentId; label: string }> = [
  { id: 'emerald', label: 'Esmeralda' },
  { id: 'pink', label: 'Pinkside' },
  { id: 'indigo', label: 'Índigo' },
  { id: 'amber', label: 'Ámbar' },
  { id: 'cyan', label: 'Cian' },
]

export const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
]

export const DEFAULT_ACCENT: AccentId = 'pink'
export const DEFAULT_THEME: ThemeId = 'system'

export const THEME_COOKIE = 'pk_theme'
export const ACCENT_COOKIE = 'pk_accent'

interface CookieWriter {
  set: (name: string, value: string, options: Record<string, unknown>) => unknown
}

/** Guarda tema y acento en cookies para pintar la web sin parpadeos (el valor real vive en la base de datos). */
export function writePreferenceCookies(jar: CookieWriter, theme: ThemeId, accent: AccentId): void {
  const options = {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
  jar.set(THEME_COOKIE, theme, options)
  jar.set(ACCENT_COOKIE, accent, options)
}

export const isAccent = (value: unknown): value is AccentId =>
  typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value)

export const isTheme = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
