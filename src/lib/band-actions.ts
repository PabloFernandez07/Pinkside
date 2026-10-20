import { emptySections, type ReportSectionId, type ReportSections } from '@/lib/report'

/** Acciones que la banda registra con un toque. Cada una cae en una sección del informe semanal. */
export const BAND_ACTIONS = [
  { id: 'rob_casas', section: 'robos', label: 'Robo a casas' },
  { id: 'rob_badulaques', section: 'robos', label: 'Robo a badulaques y licorerías' },
  { id: 'rob_pawnshop', section: 'robos', label: 'Robo a la Pawnshop' },
  { id: 'conflicto', section: 'conflictos', label: 'Enfrentamiento con otra banda o grupo' },
  { id: 'trabajo_ilegal', section: 'interacciones', label: 'Trabajo ilegal para otra banda' },
  { id: 'contrato_proteccion', section: 'interacciones', label: 'Contrato de protección o venta de materiales' },
  { id: 'reunion', section: 'interacciones', label: 'Reunión o contacto con bandas y grupos' },
  { id: 'reclutamiento', section: 'interacciones', label: 'Conversación con posibles integrantes' },
  { id: 'marihuana', section: 'drogas', label: 'Marihuana (plantación y venta)' },
  { id: 'setas', section: 'drogas', label: 'Setas con peces irradiados (plantación y venta)' },
  { id: 'moonshine', section: 'drogas', label: 'Moonshine (producción)' },
  { id: 'oxicodona', section: 'drogas', label: 'Oxicodona (encapsulación)' },
  { id: 'venta_droga', section: 'drogas', label: 'Ruta de venta de droga' },
  { id: 'reposicion_armas', section: 'armas', label: 'Reposición de pistolas, munición y chalecos' },
  { id: 'boosting', section: 'vehiculos', label: 'Boosting (Underground)' },
  { id: 'chop', section: 'vehiculos', label: 'Chop shop' },
  { id: 'rob_npc', section: 'otras', label: 'Robo a ciudadanos (NPCs)' },
  { id: 'basuras', section: 'otras', label: 'Búsqueda en basuras' },
  { id: 'parquimetros', section: 'otras', label: 'Robo a parquímetros' },
  { id: 'tumbas', section: 'otras', label: 'Levantamiento de tumbas' },
  { id: 'venta_info', section: 'observaciones', label: 'Venta de información' },
] as const satisfies readonly { id: string; section: ReportSectionId; label: string }[]

export type BandActionId = (typeof BAND_ACTIONS)[number]['id']

export const MAX_ACTION_QTY = 99
export const MAX_ACTION_NOTE = 120

const BY_ID: ReadonlyMap<string, (typeof BAND_ACTIONS)[number]> = new Map(BAND_ACTIONS.map((action) => [action.id, action]))

export const isBandAction = (value: unknown): value is BandActionId => typeof value === 'string' && BY_ID.has(value)

/** Nombre legible; si la acción ya no existe en el catálogo se muestra su identificador. */
export const actionLabel = (kind: string): string => BY_ID.get(kind)?.label ?? kind

/** «Robo a casas — 12 veces», agrupado por sección del informe. Lo que no está en el catálogo se ignora. */
export function suggestedLines(counts: readonly { kind: string; total: number }[]): ReportSections {
  const totals = new Map(counts.map(({ kind, total }) => [kind, total]))
  const sections = emptySections()
  for (const { id, section, label } of BAND_ACTIONS) {
    const total = totals.get(id)
    if (total) sections[section].push(`${label} — ${total} ${total === 1 ? 'vez' : 'veces'}`)
  }
  return sections
}
