import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYOUT,
  cardsInSlot,
  moveCard,
  parseLayout,
  serializeLayout,
  toggleCard,
  visibleInSlot,
  type CardId,
} from './dashboard-layout'

const ALL = new Set<CardId>(DEFAULT_LAYOUT.order)

describe('parseLayout', () => {
  it('sin cookie devuelve el orden por defecto y nada oculto', () => {
    expect(parseLayout(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout('')).toEqual(DEFAULT_LAYOUT)
  })

  it('respeta el orden y lo oculto, ignora basura y duplicados y añade las tarjetas que faltan', () => {
    const layout = parseLayout('flujo,-saldo,nada,flujo,kpis')
    expect(layout.order.slice(0, 3)).toEqual(['flujo', 'saldo', 'kpis'])
    expect(layout.order).toHaveLength(DEFAULT_LAYOUT.order.length)
    expect(layout.hidden).toEqual(['saldo'])
  })
})

describe('serializeLayout', () => {
  it('es la inversa de parseLayout', () => {
    const raw = serializeLayout(toggleCard(moveCard(DEFAULT_LAYOUT, 'flujo', -1), 'actividad'))
    expect(serializeLayout(parseLayout(raw))).toBe(raw)
    expect(raw).toContain('-actividad')
  })
})

describe('toggleCard', () => {
  it('oculta y vuelve a mostrar', () => {
    const hidden = toggleCard(DEFAULT_LAYOUT, 'saldo')
    expect(hidden.hidden).toEqual(['saldo'])
    expect(toggleCard(hidden, 'saldo').hidden).toEqual([])
  })
})

describe('moveCard', () => {
  it('intercambia con la vecina de su zona', () => {
    const moved = moveCard(DEFAULT_LAYOUT, 'flujo', -1)
    expect(cardsInSlot(moved, 'left', ALL)).toEqual(['flujo', 'saldo'])
  })

  it('no sale de su zona ni del principio o final', () => {
    expect(moveCard(DEFAULT_LAYOUT, 'saldo', -1)).toBe(DEFAULT_LAYOUT)
    expect(moveCard(DEFAULT_LAYOUT, 'actividad', 1)).toBe(DEFAULT_LAYOUT)
  })
})

describe('visibleInSlot', () => {
  it('omite lo oculto y lo no disponible para este miembro', () => {
    const layout = toggleCard(DEFAULT_LAYOUT, 'atencion')
    expect(visibleInSlot(layout, 'right', ALL)).toEqual(['actividad'])
    expect(visibleInSlot(DEFAULT_LAYOUT, 'left', new Set<CardId>(['flujo']))).toEqual(['flujo'])
  })
})
