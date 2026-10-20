import { describe, expect, it } from 'vitest'
import {
  currentWeekStart,
  emptySections,
  formatReport,
  linesOf,
  parseSections,
  parseWeek,
  shiftWeek,
  weekLabel,
  weekStartOf,
} from '@/lib/report'

describe('semanas', () => {
  it('el lunes de cualquier día de la semana', () => {
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12')
    expect(weekStartOf('2026-10-15')).toBe('2026-10-12')
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12')
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19')
  })

  it('la semana actual usa la fecha de Madrid', () => {
    // Domingo 18/10 a las 23:30 en Madrid (21:30 UTC) sigue siendo la semana del 12.
    expect(currentWeekStart(new Date('2026-10-18T21:30:00Z'))).toBe('2026-10-12')
    // Pasada la medianoche en Madrid ya es lunes 19.
    expect(currentWeekStart(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19')
  })

  it('mueve semanas y cruza el cambio de año', () => {
    expect(shiftWeek('2026-10-12', -1)).toBe('2026-10-05')
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04')
  })

  it('etiqueta de lunes a domingo', () => {
    expect(weekLabel('2026-10-12')).toBe('12/10 – 18/10')
    expect(weekLabel('2026-12-28')).toBe('28/12 – 03/01')
  })

  it.each(['2026-10-13', '2026-02-30', 'hoy', '', null, undefined, 5])('rechaza %j como semana', (value) => {
    expect(parseWeek(value)).toBeNull()
  })
  it('acepta un lunes', () => expect(parseWeek('2026-10-12')).toBe('2026-10-12'))
})

describe('secciones', () => {
  it('un punto por línea, sin vacías', () => {
    expect(linesOf('  uno \r\n\n dos\n   ')).toEqual(['uno', 'dos'])
  })

  it('ignora claves y valores desconocidos', () => {
    const parsed = parseSections({ robos: ['a', 3, 'b'], otra: ['x'], drogas: 'no' })
    expect(parsed.robos).toEqual(['a', 'b'])
    expect(parsed.drogas).toEqual([])
  })

  it.each([null, undefined, 'x', 4])('con %j devuelve todo vacío', (value) => {
    expect(parseSections(value)).toEqual(emptySections())
  })
})

describe('formatReport', () => {
  it('omite las secciones vacías y mantiene el formato de Discord', () => {
    const sections = { ...emptySections(), robos: ['Robos a casas — con éxito.'], observaciones: ['Todo bien.'] }
    expect(formatReport('2026-10-12', sections)).toBe(
      [
        '📋 Informe semanal de actos ilícitos',
        'Organización: Pinkside',
        'Semana: 12/10 – 18/10',
        '',
        '🏠 Robos',
        'Robos a casas — con éxito.',
        '',
        '📝 Observaciones',
        'Todo bien.',
      ].join('\n'),
    )
  })
})
