import { describe, expect, it } from 'vitest'
import { achievementsFor, progressOf, rankBand, requirementsProgress, toBandStat, type BandStat } from './community'

const NOW = Date.parse('2026-10-31T00:00:00Z')

const stat = (over: Partial<BandStat> = {}): BandStat => ({
  id: 'a',
  name: 'Ana',
  avatarUrl: null,
  motto: null,
  rankName: 'Miembro',
  rankLevel: 50,
  joinedAt: '2026-10-01T00:00:00Z',
  days: 30,
  cashMoves: 0,
  stockMoves: 0,
  crafts: 0,
  urgents: 0,
  points30d: 0,
  ...over,
})

describe('toBandStat', () => {
  it('calcula la antigüedad en días completos y normaliza los nulos', () => {
    const row = {
      member_id: 'x', member_name: 'Ana', avatar_url: null as unknown as string, motto: '' as string,
      rank_name: null as unknown as string, rank_level: 50, joined_at: '2026-10-01T12:00:00Z',
      cash_moves: 1, stock_moves: 2, crafts: 3, urgents: 4, points_30d: 5,
    }
    const result = toBandStat(row, NOW)
    expect(result.days).toBe(29)
    expect(result.avatarUrl).toBeNull()
    expect(result.motto).toBeNull()
    expect(result.rankName).toBeNull()
  })

  it('no devuelve días negativos si la fecha es futura', () => {
    const row = {
      member_id: 'x', member_name: 'Ana', avatar_url: '', motto: '', rank_name: '', rank_level: 1,
      joined_at: '2027-01-01T00:00:00Z', cash_moves: 0, stock_moves: 0, crafts: 0, urgents: 0, points_30d: 0,
    }
    expect(toBandStat(row, NOW).days).toBe(0)
  })
})

describe('progressOf', () => {
  it('no enseña 100 % hasta cumplir', () => {
    expect(progressOf(9, 10)).toMatchObject({ done: false, percent: 90 })
    expect(progressOf(299, 300).percent).toBe(99)
    expect(progressOf(10, 10)).toMatchObject({ done: true, percent: 100 })
    expect(progressOf(50, 10).percent).toBe(100)
  })
})

describe('achievementsFor', () => {
  it('marca solo los logros alcanzados', () => {
    const earned = achievementsFor(stat({ days: 40, cashMoves: 1, crafts: 10 }))
      .filter((a) => a.done)
      .map((a) => a.id)
    expect(earned).toEqual(['primer-aporte', 'fabricante', 'veterano'])
  })
})

describe('requirementsProgress', () => {
  it('está listo solo si cumple todos y hay al menos uno', () => {
    expect(requirementsProgress([], stat()).ready).toBe(false)
    expect(requirementsProgress([{ metric: 'days', target: 30 }, { metric: 'crafts', target: 1 }], stat()).ready).toBe(false)
    expect(requirementsProgress([{ metric: 'days', target: 30 }, { metric: 'crafts', target: 1 }], stat({ crafts: 2 })).ready).toBe(true)
  })
})

describe('rankBand', () => {
  it('reparte medallas, comparte puesto en empates y no premia el cero', () => {
    const rows = rankBand([
      stat({ id: '1', name: 'Zoe', points30d: 10 }),
      stat({ id: '2', name: 'Ana', points30d: 10 }),
      stat({ id: '3', name: 'Bea', points30d: 4 }),
      stat({ id: '4', name: 'Cris', points30d: 0 }),
    ])
    expect(rows.map((r) => [r.stat.name, r.place, r.medal])).toEqual([
      ['Ana', 1, '🥇'],
      ['Zoe', 1, '🥇'],
      ['Bea', 3, '🥉'],
      ['Cris', 4, null],
    ])
  })
})
