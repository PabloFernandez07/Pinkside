import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT, formatMoney, formatSignedMoney, parseMoney } from '@/lib/money'

describe('formatMoney', () => {
  it.each([
    [0, '$0'],
    [999, '$999'],
    [1000, '$1.000'], // 4 cifras: es-ES no agrupa por defecto, nosotros sí
    [5000, '$5.000'],
    [118450, '$118.450'],
    [1234567, '$1.234.567'],
    [-18000, '−$18.000'],
    [-500, '−$500'],
  ])('formatea %d como %s', (amount, expected) => {
    expect(formatMoney(amount)).toBe(expected)
  })
})

describe('formatSignedMoney', () => {
  it('añade siempre el signo', () => {
    expect(formatSignedMoney(5000)).toBe('+$5.000')
    expect(formatSignedMoney(-9750)).toBe('−$9.750')
    expect(formatSignedMoney(0)).toBe('+$0')
  })
})

describe('parseMoney', () => {
  it.each([
    ['1500', 1500],
    ['1.500', 1500],
    ['1,500', 1500],
    ['1 500', 1500],
    ['$1.500', 1500],
    ['  250  ', 250],
    ['1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['0', 0],
    ['007', 7],
  ])('lee %j como %d', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '1.5', '12,50', '1234.567', '1.23', '-100', '+100', '1e3', '1..500', '$', '1.500.5', '١٢٣', '0,500', '0.001', '1,500.000', '1.500,000', '5\n000'])(
    'rechaza %j',
    (input) => {
      expect(parseMoney(input)).toBeNull()
    },
  )

  it('rechaza números que no caben de forma segura', () => {
    expect(parseMoney('9'.repeat(20))).toBeNull()
  })

  it('el máximo coincide con el de la base de datos', () => {
    expect(MAX_AMOUNT).toBe(1_000_000_000)
    expect(parseMoney('1.000.000.000')).toBe(MAX_AMOUNT)
  })
})
