import type { Database } from '@/lib/database.types'

type StatsRow = Database['public']['Functions']['band_stats']['Returns'][number]

export interface BandStat {
  id: string
  name: string
  avatarUrl: string | null
  motto: string | null
  rankName: string | null
  rankLevel: number
  joinedAt: string
  days: number
  cashMoves: number
  stockMoves: number
  crafts: number
  urgents: number
  points30d: number
}

const DAY_MS = 86_400_000

/** Las columnas de texto llegan nulables en runtime aunque los tipos generados no lo digan. */
export function toBandStat(row: StatsRow, now = Date.now()): BandStat {
  return {
    id: row.member_id,
    name: row.member_name,
    avatarUrl: row.avatar_url || null,
    motto: row.motto || null,
    rankName: row.rank_name || null,
    rankLevel: row.rank_level ?? 0,
    joinedAt: row.joined_at,
    days: Math.max(0, Math.floor((now - new Date(row.joined_at).getTime()) / DAY_MS)),
    cashMoves: row.cash_moves,
    stockMoves: row.stock_moves,
    crafts: row.crafts,
    urgents: row.urgents,
    points30d: row.points_30d,
  }
}

/** Reacciones permitidas en el muro (la base de datos acepta exactamente estas). */
export const WALL_EMOJIS = ['👍', '🔥', '😂', '❤️', '👀'] as const

export type MetricKey ='days' | 'cash_moves' | 'stock_moves' | 'crafts' | 'urgents'

export const METRICS: Record<MetricKey, { label: string; unit: string; read: (stat: BandStat) => number }> = {
  days: { label: 'Antigüedad', unit: 'días en la banda', read: (s) => s.days },
  cash_moves: { label: 'Movimientos de caja', unit: 'movimientos de caja', read: (s) => s.cashMoves },
  stock_moves: { label: 'Movimientos de inventario', unit: 'movimientos de inventario', read: (s) => s.stockMoves },
  crafts: { label: 'Crafteos', unit: 'crafteos', read: (s) => s.crafts },
  urgents: { label: 'Pedidos urgentes', unit: 'pedidos urgentes', read: (s) => s.urgents },
}

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[]

export const isMetric = (value: string): value is MetricKey => value in METRICS

export interface Achievement {
  id: string
  icon: string
  title: string
  description: string
  metric: MetricKey
  target: number
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'primer-aporte', icon: '💰', title: 'Primer paso', description: 'Registra tu primer movimiento de caja', metric: 'cash_moves', target: 1 },
  { id: 'caja-confianza', icon: '🏦', title: 'Caja de confianza', description: '25 movimientos de caja', metric: 'cash_moves', target: 25 },
  { id: 'almacenero', icon: '📦', title: 'Almacenero', description: '25 movimientos de inventario', metric: 'stock_moves', target: 25 },
  { id: 'fabricante', icon: '🛠️', title: 'Fabricante', description: '10 crafteos', metric: 'crafts', target: 10 },
  { id: 'centinela', icon: '🚨', title: 'Centinela', description: '5 pedidos urgentes', metric: 'urgents', target: 5 },
  { id: 'veterano', icon: '🎖️', title: 'Veterano', description: '30 días en la banda', metric: 'days', target: 30 },
  { id: 'leyenda', icon: '👑', title: 'Leyenda', description: '180 días en la banda', metric: 'days', target: 180 },
]

export interface Progress {
  current: number
  target: number
  done: boolean
  /** 0 a 100, redondeado hacia abajo para no enseñar «100 %» sin haberlo cumplido. */
  percent: number
}

export function progressOf(current: number, target: number): Progress {
  const done = current >= target
  return { current, target, done, percent: done ? 100 : Math.floor((current / target) * 100) }
}

export function achievementsFor(stat: BandStat) {
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    ...progressOf(METRICS[achievement.metric].read(stat), achievement.target),
  }))
}

export interface Requirement {
  metric: MetricKey
  target: number
}

export function requirementsProgress(requirements: readonly Requirement[], stat: BandStat) {
  const items = requirements.map((req) => ({
    ...req,
    ...progressOf(METRICS[req.metric].read(stat), req.target),
  }))
  return { items, ready: items.length > 0 && items.every((item) => item.done) }
}

/** Medalla por puesto; empates en puntos comparten puesto. Sin puntos no hay medalla. */
export function rankBand(stats: readonly BandStat[]) {
  const sorted = [...stats].sort((a, b) => b.points30d - a.points30d || a.name.localeCompare(b.name, 'es'))
  let place = 0
  return sorted.map((stat, index) => {
    if (index === 0 || stat.points30d !== sorted[index - 1].points30d) place = index + 1
    return { stat, place, medal: stat.points30d > 0 ? (['🥇', '🥈', '🥉'][place - 1] ?? null) : null }
  })
}
