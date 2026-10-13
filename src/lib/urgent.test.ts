import { describe, expect, it } from 'vitest'
import { MAX_DM_LENGTH, buildDm, describeDelivery, summarizeDelivery } from '@/lib/urgent'

const base = { priority: 'critical', title: 'Falta acero', body: null, authorName: 'Lucía Romero', itemName: null } as const

describe('buildDm', () => {
  it('construye el aviso mínimo', () => {
    expect(buildDm(base)).toBe(
      ['🚨 **URGENTE · Prioridad crítica**', '**Falta acero**', 'Pedido por Lucía Romero · Pinkside'].join('\n'),
    )
  })

  it('prioridad alta usa otro icono y texto', () => {
    expect(buildDm({ ...base, priority: 'high' })).toContain('⚠️ **URGENTE · Prioridad alta**')
  })

  it('incluye detalle e item cuando existen, recortando espacios', () => {
    const text = buildDm({ ...base, title: '  Falta acero ', body: '  Para el crafteo de hoy ', itemName: 'Acero' })
    expect(text).toContain('**Falta acero**\nPara el crafteo de hoy\nItem: Acero\nPedido por')
  })

  it('ignora un detalle que solo tiene espacios', () => {
    expect(buildDm({ ...base, body: '   ' })).not.toContain('\n\n')
  })

  it('no supera el límite de Discord', () => {
    const text = buildDm({ ...base, body: 'x'.repeat(5000) })
    expect(text.length).toBeLessThanOrEqual(MAX_DM_LENGTH)
    expect(text.endsWith('…')).toBe(true)
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
