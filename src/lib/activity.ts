import { formatMoney } from '@/lib/money'

export interface ActivityRow {
  kind: string
  id: number
  created_at: string
  author_name: string
  detail: string
  amount: number
  item_name: string | null
  is_reversal: boolean
}

/** Frase corta de lo ocurrido, sin el nombre de quien lo hizo (se muestra aparte en negrita). */
export function describeActivity(row: ActivityRow): string {
  const size = Math.abs(row.amount)
  if (row.kind === 'cash') {
    if (row.is_reversal) return `anuló un movimiento de caja · ${row.detail}`
    return row.amount > 0
      ? `registró una entrada de ${formatMoney(size)} · ${row.detail}`
      : `registró una salida de ${formatMoney(size)} · ${row.detail}`
  }
  const item = row.item_name ?? 'un item'
  if (row.is_reversal) return `anuló un movimiento de ${item} · ${row.detail}`
  return row.amount > 0 ? `sumó ${size}× ${item} · ${row.detail}` : `sacó ${size}× ${item} · ${row.detail}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "ahora", "hace 5 min", "hace 2 h", "ayer", "hace 3 días"; pasada una semana, la fecha corta. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime()
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return 'ahora'
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`
  if (elapsed < 2 * DAY) return 'ayer'
  if (elapsed < 7 * DAY) return `hace ${Math.floor(elapsed / DAY)} días`
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' })
    .format(new Date(iso))
    .replace('.', '')
}
