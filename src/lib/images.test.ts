import { describe, expect, it } from 'vitest'
import { ITEM_IMAGE_PATTERN, itemImageUrl, itemInitial } from '@/lib/images'

const path = '3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp'
const base = 'https://abc.supabase.co'

describe('itemImageUrl', () => {
  it('construye la URL pública del bucket', () => {
    expect(itemImageUrl(path, base)).toBe(`${base}/storage/v1/object/public/item-images/${path}`)
  })

  it('tolera una barra final en la URL base', () => {
    expect(itemImageUrl(path, `${base}/`)).toBe(`${base}/storage/v1/object/public/item-images/${path}`)
  })

  it.each([null, undefined, ''])('sin foto (%j) devuelve null', (value) => {
    expect(itemImageUrl(value, base)).toBeNull()
  })

  it('sin URL base devuelve null', () => {
    expect(itemImageUrl(path, '')).toBeNull()
  })

  it.each(['../secreto.webp', 'foto.webp', `${path}/../x`, '3f2504e0-4f89-41d3-9a0c-0305e82c3301.gif', 'https://evil.com/x.webp'])(
    'rechaza nombres que no son un UUID con extensión (%s)',
    (value) => {
      expect(itemImageUrl(value, base)).toBeNull()
      expect(ITEM_IMAGE_PATTERN.test(value)).toBe(false)
    },
  )
})

describe('itemInitial', () => {
  it.each([
    ['Acero', 'A'],
    ['  pólvora', 'P'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %s', (name, expected) => {
    expect(itemInitial(name)).toBe(expected)
  })
})
