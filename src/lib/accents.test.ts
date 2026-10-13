import { describe, expect, it, vi } from 'vitest'
import {
  ACCENTS,
  ACCENT_COOKIE,
  ACCENT_IDS,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  THEMES,
  THEME_COOKIE,
  THEME_IDS,
  isAccent,
  isTheme,
  writePreferenceCookies,
} from '@/lib/accents'

describe('catálogo de acentos y temas', () => {
  it('el acento por defecto es esmeralda y el tema por defecto sigue al sistema', () => {
    expect(DEFAULT_ACCENT).toBe('pink')
    expect(DEFAULT_THEME).toBe('system')
  })

  it('ofrece esmeralda más cuatro alternativas, incluido el rosa de Pinkside', () => {
    expect(ACCENT_IDS).toHaveLength(5)
    expect(ACCENT_IDS).toContain('pink')
  })

  it('cada id tiene etiqueta visible', () => {
    expect(ACCENTS.map((a) => a.id)).toEqual([...ACCENT_IDS])
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS])
    for (const item of [...ACCENTS, ...THEMES]) expect(item.label.length).toBeGreaterThan(0)
  })
})

describe('isAccent / isTheme', () => {
  it.each(ACCENT_IDS)('reconoce el acento %s', (id) => expect(isAccent(id)).toBe(true))
  it.each(THEME_IDS)('reconoce el tema %s', (id) => expect(isTheme(id)).toBe(true))

  it.each([undefined, null, '', 'red', 'EMERALD', 42, {}])('rechaza %j como acento y como tema', (value) => {
    expect(isAccent(value)).toBe(false)
    expect(isTheme(value)).toBe(false)
  })
})

describe('writePreferenceCookies', () => {
  it('guarda tema y acento como cookies httpOnly de un año', () => {
    const set = vi.fn()
    writePreferenceCookies({ set }, 'dark', 'pink')

    expect(set).toHaveBeenCalledTimes(2)
    const [themeCall, accentCall] = set.mock.calls
    expect(themeCall.slice(0, 2)).toEqual([THEME_COOKIE, 'dark'])
    expect(accentCall.slice(0, 2)).toEqual([ACCENT_COOKIE, 'pink'])
    for (const call of set.mock.calls) {
      expect(call[2]).toMatchObject({ path: '/', maxAge: 31_536_000, sameSite: 'lax', httpOnly: true })
    }
  })
})
