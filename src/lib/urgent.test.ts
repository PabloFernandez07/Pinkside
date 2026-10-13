import { describe, expect, it } from 'vitest'
import { EMBED_LIMITS, buildDm, describeDelivery, summarizeDelivery } from '@/lib/urgent'

const base = { priority: 'critical', title: 'Falta acero', body: null, authorName: 'Lucía Romero', itemName: null } as const

describe('buildDm', () => {
  it('construye el aviso mínimo', () => {
    expect(buildDm(base)).toEqual({
      heading: '🚨 **URGENTE · Prioridad crítica**',
      title: 'Falta acero',
      description: null,
      fields: [],
      footer: 'Pedido por Lucía Romero · Pinkside',
    })
  })

  it('prioridad alta usa otro icono y texto', () => {
    expect(buildDm({ ...base, priority: 'high' }).heading).toBe('⚠️ **URGENTE · Prioridad alta**')
  })

  it('incluye detalle e item cuando existen, recortando espacios', () => {
    const card = buildDm({ ...base, title: '  Falta acero ', body: '  Para el crafteo de hoy ', itemName: 'Acero' })
    expect(card.title).toBe('Falta acero')
    expect(card.description).toBe('Para el crafteo de hoy')
    expect(card.fields).toEqual([{ name: 'Item', value: 'Acero' }])
  })

  it('ignora un detalle que solo tiene espacios', () => {
    expect(buildDm({ ...base, body: '   ' }).description).toBeNull()
  })

  it('no supera los límites del recuadro de Discord', () => {
    const card = buildDm({ ...base, title: 't'.repeat(999), body: 'x'.repeat(9999), itemName: 'i'.repeat(9999) })
    expect(card.title).toHaveLength(EMBED_LIMITS.title)
    expect(card.description).toHaveLength(EMBED_LIMITS.description)
    expect(card.fields[0]?.value).toHaveLength(EMBED_LIMITS.field)
    expect(card.title.endsWith('…')).toBe(true)
  })
})

describe('summarizeDelivery / describeDelivery', () => {
  it('cuenta por estado', () => {
    expect(summarizeDelivery(['sent', 'sent', 'pending', 'failed', 'skipped'])).toEqual({
      sent: 2,
      pending: 1,
      failed: 1,
      skipped: 1,
    })
  })

  it('redacta el resumen con singulares y plurales', () => {
    expect(describeDelivery({ sent: 2, pending: 1, failed: 1, skipped: 3 })).toBe(
      '2 enviados · 1 en cola · 1 fallido · 3 sin MD',
    )
    expect(describeDelivery({ sent: 1, pending: 0, failed: 2, skipped: 0 })).toBe('1 enviado · 2 fallidos')
  })

  it('sin avisos devuelve vacío', () => {
    expect(describeDelivery(summarizeDelivery([]))).toBe('')
  })
})
