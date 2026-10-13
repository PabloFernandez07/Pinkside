import { describe, expect, it } from 'vitest'
import { formatDateTime } from '@/lib/format'

describe('formatDateTime', () => {
  it('muestra la hora de Madrid en verano (UTC+2)', () => {
    // 10:00 UTC = 12:00 en Madrid con horario de verano
    expect(formatDateTime('2026-10-13T10:00:00Z')).toMatch(/13.*oct.*12:00/)
  })

  it('muestra la hora de Madrid en invierno (UTC+1)', () => {
    // 10:00 UTC = 11:00 en Madrid con horario de invierno
    expect(formatDateTime('2026-12-01T10:00:00Z')).toMatch(/1.*dic.*11:00/)
  })

  it('cambia de día según la hora de Madrid, no la del servidor', () => {
    // 23:30 UTC del 13 de octubre ya es 01:30 del día 14 en Madrid
    expect(formatDateTime('2026-10-13T23:30:00Z')).toMatch(/14.*oct.*01:30/)
  })

  it('el resultado no depende de la zona horaria del proceso', () => {
    const iso = '2026-07-01T00:00:00Z'
    const before = process.env.TZ
    try {
      process.env.TZ = 'America/Los_Angeles'
      const a = formatDateTime(iso)
      process.env.TZ = 'Asia/Tokyo'
      expect(formatDateTime(iso)).toBe(a)
    } finally {
      if (before === undefined) delete process.env.TZ
      else process.env.TZ = before
    }
  })
})
