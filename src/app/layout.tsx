import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { DM_Mono, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import {
  ACCENT_COOKIE,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  THEME_COOKIE,
  isAccent,
  isTheme,
} from '@/lib/accents'
import './globals.css'

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'], display: 'swap' })
const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Pinkside', template: '%s · Pinkside' },
  description: 'Panel de gestión de la banda Pinkside',
}

// Script estático (sin datos del usuario): aplica el tema del sistema antes de pintar para evitar parpadeos.
const THEME_SCRIPT = `(function(){var r=document.documentElement;var m=matchMedia('(prefers-color-scheme: dark)');function a(){if(r.dataset.themePref==='system'){r.dataset.theme=m.matches?'dark':'light'}}a();m.addEventListener('change',a)})()`

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  const themeCookie = jar.get(THEME_COOKIE)?.value
  const accentCookie = jar.get(ACCENT_COOKIE)?.value
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME
  const accent = isAccent(accentCookie) ? accentCookie : DEFAULT_ACCENT

  return (
    <html
      lang="es"
      data-theme={theme === 'system' ? undefined : theme}
      data-theme-pref={theme}
      data-accent={accent}
      className={`${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <Script id="theme-pref" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </body>
    </html>
  )
}
