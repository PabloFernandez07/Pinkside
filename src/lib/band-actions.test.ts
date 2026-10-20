import { describe, expect, it } from 'vitest'
import { actionLabel, BAND_ACTIONS, isBandAction, suggestedLines } from '@/lib/band-actions'
import { REPORT_SECTIONS } from '@/lib/report'

describe('catálogo', () => {
  it('los identificadores son únicos y válidos para la base de datos', () => {
    const ids = BAND_ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z_]{1,40}$/)
  })

  it('cada acción cae en una sección que existe en el informe', () => {
    const sections = new Set<string>(REPORT_SECTIONS.map((section) => section.id))
    for (const { section } of BAND_ACTIONS) expect(sections.has(section)).toBe(true)
  })

  it('reconoce solo acciones del catálogo', () => {
    expect(isBandAction('rob_casas')).toBe(true)
    for (const value of ['', 'nada', null, undefined, 4]) expect(isBandAction(value)).toBe(false)
  })

  it('el nombre desconocido se muestra tal cual', () => {
    expect(actionLabel('rob_casas')).toBe('Robo a casas')
    expect(actionLabel('antigua')).toBe('antigua')
  })
})

describe('suggestedLines', () => {
  it('agrupa por sección, concuerda el plural e ignora lo desconocido', () => {
    const lines = suggestedLines([
      { kind: 'rob_casas', total: 12 },
      { kind: 'rob_pawnshop', total: 1 },
      { kind: 'antigua', total: 5 },
      { kind: 'boosting', total: 0 },
    ])
    expect(lines.robos).toEqual(['Robo a casas — 12 veces', 'Robo a la Pawnshop — 1 vez'])
    expect(lines.vehiculos).toEqual([])
    expect(lines.drogas).toEqual([])
  })
})
