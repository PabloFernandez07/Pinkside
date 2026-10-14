export const DASHBOARD_COOKIE = 'pk_resumen'

export type Slot = 'top' | 'left' | 'right'

/** Las tarjetas del Resumen. `slot` fija en qué zona se dibuja; el orden dentro de cada zona lo elige el miembro. */
export const DASHBOARD_CARDS = [
  { id: 'kpis', label: 'Indicadores', slot: 'top' },
  { id: 'camino', label: 'Tu camino', slot: 'top' },
  { id: 'aviso', label: 'Último aviso del muro', slot: 'top' },
  { id: 'saldo', label: 'Saldo de la caja', slot: 'left' },
  { id: 'flujo', label: 'Entradas y salidas', slot: 'left' },
  { id: 'atencion', label: 'Requiere atención', slot: 'right' },
  { id: 'actividad', label: 'Actividad reciente', slot: 'right' },
] as const

export type CardId = (typeof DASHBOARD_CARDS)[number]['id']

const IDS: readonly CardId[] = DASHBOARD_CARDS.map((card) => card.id)
const isCardId = (value: string): value is CardId => (IDS as readonly string[]).includes(value)
const slotOf = (id: CardId): Slot => DASHBOARD_CARDS.find((card) => card.id === id)!.slot

export interface DashboardLayout {
  order: readonly CardId[]
  hidden: readonly CardId[]
}

export const DEFAULT_LAYOUT: DashboardLayout = { order: IDS, hidden: [] }

/**
 * Formato de la cookie: ids separados por comas en orden; un `-` delante marca la tarjeta oculta.
 * Lo desconocido se ignora y las tarjetas nuevas que falten se añaden al final, visibles.
 */
export function parseLayout(raw: string | undefined): DashboardLayout {
  if (!raw) return DEFAULT_LAYOUT
  const order: CardId[] = []
  const hidden: CardId[] = []
  for (const part of raw.split(',')) {
    const isHidden = part.startsWith('-')
    const id = isHidden ? part.slice(1) : part
    if (!isCardId(id) || order.includes(id)) continue
    order.push(id)
    if (isHidden) hidden.push(id)
  }
  return { order: [...order, ...IDS.filter((id) => !order.includes(id))], hidden }
}

export const serializeLayout = ({ order, hidden }: DashboardLayout): string =>
  order.map((id) => (hidden.includes(id) ? `-${id}` : id)).join(',')

export const toggleCard = (layout: DashboardLayout, id: CardId): DashboardLayout => ({
  order: layout.order,
  hidden: layout.hidden.includes(id) ? layout.hidden.filter((other) => other !== id) : [...layout.hidden, id],
})

/** Intercambia la tarjeta con su vecina de la misma zona (hacia arriba con -1, hacia abajo con +1). */
export function moveCard(layout: DashboardLayout, id: CardId, direction: -1 | 1): DashboardLayout {
  const slot = slotOf(id)
  const peers = layout.order.filter((other) => slotOf(other) === slot)
  const target = peers[peers.indexOf(id) + direction]
  if (!target) return layout
  const order = layout.order.map((other) => (other === id ? target : other === target ? id : other))
  return { order, hidden: layout.hidden }
}

/** Tarjetas de una zona, en orden, sin las ocultas ni las que este miembro no puede ver. */
export const visibleInSlot = (layout: DashboardLayout, slot: Slot, available: ReadonlySet<CardId>): CardId[] =>
  layout.order.filter((id) => slotOf(id) === slot && available.has(id) && !layout.hidden.includes(id))

/** Todas las tarjetas de una zona (también las ocultas), para el editor. */
export const cardsInSlot = (layout: DashboardLayout, slot: Slot, available: ReadonlySet<CardId>): CardId[] =>
  layout.order.filter((id) => slotOf(id) === slot && available.has(id))
