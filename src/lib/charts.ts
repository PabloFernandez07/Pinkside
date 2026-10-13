/**
 * Geometría de gráficos en coordenadas normalizadas 0-100 (porcentajes del área del gráfico).
 * Así el SVG se estira al tamaño de su tarjeta y las etiquetas se colocan con porcentajes en HTML,
 * sin deformar el texto ni depender de medir el contenedor.
 */

export interface Margins {
  left: number
  right: number
  top: number
  bottom: number
}

export const DEFAULT_MARGINS: Margins = { left: 10, right: 2, top: 5, bottom: 11 }

export interface Tick {
  value: number
  /** Posición vertical en % (0 = arriba). */
  y: number
  label: string
}

export interface Point {
  x: number
  y: number
}

export interface XLabel {
  x: number
  text: string
  anchor: 'start' | 'middle' | 'end'
}

/** `$800`, `$12k`, `$1,5 M`; con signo menos si es negativo. Para los ejes. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '')} M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

/** Siguiente número "bonito" (1, 2, 5 × 10^k) mayor o igual que `value`. */
export function niceStep(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const fraction = value / magnitude
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * magnitude
}

/** Escala con divisiones redondas que contiene [min, max]. `minStep` evita escalas ridículas con datos planos. */
export function niceScale(min: number, max: number, divisions = 3, minStep = 1): { lo: number; hi: number; step: number } {
  const span = Math.max(max - min, minStep)
  let step = Math.max(niceStep(span / divisions), minStep)
  for (let i = 0; i < 40; i++) {
    const lo = Math.floor(min / step) * step
    const hi = lo + step * divisions
    if (hi >= max) return { lo, hi, step }
    step = niceStep(step * 1.0001) // siguiente paso redondo (1→2→5→10…) cuando el rango cae a caballo entre dos marcas
  }
  const lo = Math.floor(min / step) * step
  return { lo, hi: lo + step * divisions, step }
}

const round = (value: number): number => Math.round(value * 100) / 100

function ticksFor(lo: number, hi: number, divisions: number, margins: Margins): Tick[] {
  const plotHeight = 100 - margins.top - margins.bottom
  return Array.from({ length: divisions + 1 }, (_, k) => {
    const value = lo + ((hi - lo) * k) / divisions
    return { value, y: round(margins.top + plotHeight * (1 - k / divisions)), label: compactMoney(value) }
  })
}

export interface LineChartData {
  /** Trazo de la línea (coordenadas 0-100). */
  path: string
  /** Relleno bajo la línea, cerrado contra la base del gráfico. */
  area: string
  points: Point[]
  ticks: Tick[]
  xLabels: XLabel[]
  last: Point | null
  margins: Margins
}

/** Línea de valores (p. ej. el saldo de cada día) con sus ejes. */
export function buildLineChart(
  values: readonly number[],
  labels: readonly string[],
  margins: Margins = DEFAULT_MARGINS,
  divisions = 3,
): LineChartData {
  if (values.length === 0) {
    return { path: '', area: '', points: [], ticks: [], xLabels: [], last: null, margins }
  }
  const { lo, hi } = niceScale(Math.min(...values), Math.max(...values), divisions, 1000)
  const plotWidth = 100 - margins.left - margins.right
  const plotHeight = 100 - margins.top - margins.bottom
  const base = round(margins.top + plotHeight)

  const points = values.map((value, index) => ({
    x: round(values.length === 1 ? margins.left + plotWidth / 2 : margins.left + (plotWidth * index) / (values.length - 1)),
    y: round(margins.top + plotHeight * (1 - (value - lo) / (hi - lo))),
  }))
  const path = points.map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]

  const xLabels: XLabel[] = []
  if (labels.length > 0) {
    xLabels.push({ x: first.x, text: labels[0], anchor: 'start' })
    if (labels.length > 2) {
      const mid = Math.floor((labels.length - 1) / 2)
      xLabels.push({ x: points[mid].x, text: labels[mid], anchor: 'middle' })
    }
    if (labels.length > 1) xLabels.push({ x: last.x, text: labels[labels.length - 1], anchor: 'end' })
  }

  return {
    path,
    area: `${path} L${last.x},${base} L${first.x},${base} Z`,
    points,
    ticks: ticksFor(lo, hi, divisions, margins),
    xLabels,
    last,
    margins,
  }
}

export interface BarGroupInput {
  label: string
  income: number
  expense: number
}

export interface Bar {
  x: number
  y: number
  width: number
  height: number
}

export interface BarGroupData {
  label: string
  /** Centro del grupo en % (para la etiqueta del eje). */
  center: number
  income: Bar
  expense: Bar
}

export interface BarChartData {
  groups: BarGroupData[]
  ticks: Tick[]
  margins: Margins
}

/** Barras agrupadas (entradas y salidas por tramo), con el eje empezando en 0. */
export function buildBarChart(
  groups: readonly BarGroupInput[],
  margins: Margins = DEFAULT_MARGINS,
  divisions = 3,
): BarChartData {
  if (groups.length === 0) return { groups: [], ticks: [], margins }
  const peak = Math.max(0, ...groups.flatMap((group) => [group.income, group.expense]))
  const { hi } = niceScale(0, peak, divisions, 1000)
  const plotWidth = 100 - margins.left - margins.right
  const plotHeight = 100 - margins.top - margins.bottom
  const slot = plotWidth / groups.length
  const barWidth = Math.min(slot * 0.34, 4)
  const base = margins.top + plotHeight

  const bar = (value: number, x: number): Bar => {
    const height = hi === 0 ? 0 : (Math.max(0, value) / hi) * plotHeight
    return { x: round(x), y: round(base - height), width: round(barWidth), height: round(height) }
  }

  return {
    groups: groups.map((group, index) => {
      const center = margins.left + slot * (index + 0.5)
      return {
        label: group.label,
        center: round(center),
        income: bar(group.income, center - barWidth - 0.15),
        expense: bar(group.expense, center + 0.15),
      }
    }),
    ticks: ticksFor(0, hi, divisions, margins),
    margins,
  }
}

export interface DayRow {
  day: string
  income: number
  expense: number
}

/** Agrupa días consecutivos en tramos (los últimos días quedan completos; el primer tramo puede ser más corto). */
export function bucketByDays(rows: readonly DayRow[], size: number): BarGroupInput[] {
  if (size < 1 || rows.length === 0) return []
  const groups: BarGroupInput[] = []
  for (let end = rows.length; end > 0; end -= size) {
    const slice = rows.slice(Math.max(0, end - size), end)
    groups.unshift({
      label: shortDate(slice[0].day),
      income: slice.reduce((total, row) => total + row.income, 0),
      expense: slice.reduce((total, row) => total + row.expense, 0),
    })
  }
  return groups
}

const SHORT_DATE = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' })

/** `2026-10-13` → `13 oct`. Trabaja en UTC con el mediodía para que ninguna zona horaria cambie el día. */
export const shortDate = (day: string): string => SHORT_DATE.format(new Date(`${day}T12:00:00Z`)).replace('.', '')
