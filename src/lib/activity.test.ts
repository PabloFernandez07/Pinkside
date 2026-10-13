import { describe, expect, it } from 'vitest'
import { describeActivity, relativeTime, type ActivityRow } from '@/lib/activity'

const row = (override: Partial<ActivityRow> = {}): ActivityRow => ({
  kind: 'cash',
  id: 1,
  created_at: '2026-10-13T10:00:00Z',
  author_name: 'Lucía Romero',
  detail: 'Venta de materiales',
  amount: 42500,
  item_name: null,
  is_reversal: false,
  ...override,
})

describe('describeActivity', () => {
  it('describe una entrada de caja', () => {
    expect(describeActivity(row())).toBe('registró una entrada de $42.500 · Venta de materiales')
  })

  it('describe una salida de caja sin signo en el importe', () => {
    expect(describeActivity(row({ amount: -18000, detail: 'Compra de munición' }))).toBe(
      'registró una salida de $18.000 · Compra de munición',
    )
  })

  it('describe una anulación de caja', () => {
    expect(describeActivity(row({ amount: -42500, is_reversal: true, detail: 'Anulación #3: Error' }))).toBe(
      'anuló un movimiento de caja · Anulación #3: Error',
    )
  })

  it('describe entradas y salidas de stock con el nombre del item', () => {
    expect(describeActivity(row({ kind: 'stock', amount: 100, item_name: 'Acero', detail: 'Compra inicial' }))).toBe(
      'sumó 100× Acero · Compra inicial',
    )
    expect(describeActivity(row({ kind: 'stock', amount: -30, item_name: 'Acero', detail: 'Crafteo: Cargador ×2' }))).toBe(
      'sacó 30× Acero · Crafteo: Cargador ×2',
    )
  })

  it('describe la anulación de un movimiento de stock', () => {
    expect(
      describeActivity(row({ kind: 'stock', amount: 30, item_name: 'Acero', is_reversal: true, detail: 'Anulación #2: Error' })),
    ).toBe('anuló un movimiento de Acero · Anulación #2: Error')
  })

  it('si falta el nombre del item usa un texto genérico', () => {
    expect(describeActivity(row({ kind: 'stock', amount: 5, item_name: null }))).toContain('5× un item')
  })

  it('no interpreta HTML: devuelve el texto tal cual para que React lo escape', () => {
    expect(describeActivity(row({ detail: '<script>alert(1)</script>' }))).toContain('<script>alert(1)</script>')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-10-13T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR

  it.each([
    [0, 'ahora'],
    [30_000, 'ahora'],
    [MIN, 'hace 1 min'],
    [59 * MIN, 'hace 59 min'],
    [HOUR, 'hace 1 h'],
    [23 * HOUR, 'hace 23 h'],
    [DAY, 'ayer'],
    [47 * HOUR, 'ayer'],
    [2 * DAY, 'hace 2 días'],
    [6 * DAY, 'hace 6 días'],
  ])('hace %d ms → %s', (elapsed, expected) => {
    expect(relativeTime(ago(elapsed), now)).toBe(expected)
  })

  it('pasada una semana muestra la fecha corta', () => {
    expect(relativeTime(ago(10 * DAY), now)).toBe('03 oct')
  })

  it('una fecha futura o inválida se trata como "ahora"', () => {
    expect(relativeTime(new Date(now.getTime() + HOUR).toISOString(), now)).toBe('ahora')
    expect(relativeTime('no es una fecha', now)).toBe('ahora')
  })
})
