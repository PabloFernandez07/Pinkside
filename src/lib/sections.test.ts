import { describe, expect, it } from 'vitest'
import { SECTION_IDS, isSection, parseDisabledSections } from '@/lib/sections'

describe('isSection', () => {
  it.each(SECTION_IDS)('reconoce %s', (id) => expect(isSection(id)).toBe(true))
  it.each(['caja', '', 'INVENTARIO', null, undefined, 3, {}])('rechaza %j', (value) => expect(isSection(value)).toBe(false))
})

describe('parseDisabledSections', () => {
  it('devuelve las secciones conocidas', () => {
    expect([...parseDisabledSections(['inventario', 'recetas'])]).toEqual(['inventario', 'recetas'])
  })

  it('ignora lo desconocido y los duplicados', () => {
    expect([...parseDisabledSections(['caja', 'recetas', 'recetas', 7, null])]).toEqual(['recetas'])
  })

  it.each([null, undefined, 'recetas', 5, {}])('con %j no hay ninguna desactivada', (value) => {
    expect(parseDisabledSections(value).size).toBe(0)
  })
})
