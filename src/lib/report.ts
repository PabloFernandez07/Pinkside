/** Informe semanal de actos ilícitos: secciones fijas, semanas de lunes a domingo y texto listo para Discord. */

export const REPORT_SECTIONS = [
  { id: 'robos', emoji: '🏠', title: 'Robos' },
  { id: 'conflictos', emoji: '⚔️', title: 'Enfrentamientos / Conflictos' },
  { id: 'interacciones', emoji: '🤝', title: 'Interacciones destacables' },
  { id: 'drogas', emoji: '💊', title: 'Drogas' },
  { id: 'armas', emoji: '🔫', title: 'Armas / Material ilícito' },
  { id: 'vehiculos', emoji: '🚗', title: 'Vehículos / Boosting / Chop' },
  { id: 'otras', emoji: '📦', title: 'Otras actividades ilícitas' },
  { id: 'observaciones', emoji: '📝', title: 'Observaciones' },
] as const

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]['id']
export type ReportSections = Record<ReportSectionId, string[]>

export const MAX_LINES = 40
export const MAX_LINE_LENGTH = 600

const DAY_MS = 86_400_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Lunes de la semana a la que pertenece la fecha (`YYYY-MM-DD`). */
export function weekStartOf(iso: string): string {
  const ms = toUtc(iso)
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7
  return fromUtc(ms - sinceMonday * DAY_MS)
}

/** Lunes de la semana actual en hora de Madrid, que es la de la banda. */
export function currentWeekStart(now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now)
  return weekStartOf(today)
}

export const shiftWeek = (weekStart: string, weeks: number): string => fromUtc(toUtc(weekStart) + weeks * 7 * DAY_MS)

/** Un lunes válido (`YYYY-MM-DD`), o null. */
export function parseWeek(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null
  const ms = toUtc(value)
  if (Number.isNaN(ms) || fromUtc(ms) !== value) return null
  return weekStartOf(value) === value ? value : null
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** «12/10 – 18/10»: del lunes al domingo. */
export const weekLabel = (weekStart: string): string =>
  `${dayMonth(weekStart)} – ${dayMonth(fromUtc(toUtc(weekStart) + 6 * DAY_MS))}`

export const emptySections = (): ReportSections =>
  Object.fromEntries(REPORT_SECTIONS.map(({ id }) => [id, []])) as unknown as ReportSections

/** Convierte lo guardado (JSON de la base) en secciones válidas; lo desconocido se ignora. */
export function parseSections(value: unknown): ReportSections {
  const sections = emptySections()
  if (typeof value !== 'object' || value === null) return sections
  for (const { id } of REPORT_SECTIONS) {
    const lines = (value as Record<string, unknown>)[id]
    if (Array.isArray(lines)) sections[id] = lines.filter((line): line is string => typeof line === 'string')
  }
  return sections
}

/** Un punto por línea: se recortan los espacios y se descartan las líneas vacías. */
export const linesOf = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

/** El informe tal y como se pega en el canal. Las secciones vacías no salen. */
export function formatReport(weekStart: string, sections: ReportSections, organization = 'Pinkside'): string {
  const head = ['📋 Informe semanal de actos ilícitos', `Organización: ${organization}`, `Semana: ${weekLabel(weekStart)}`]
  const blocks = REPORT_SECTIONS.flatMap(({ id, emoji, title }) =>
    sections[id].length > 0 ? [[`${emoji} ${title}`, ...sections[id]].join('\n')] : [],
  )
  return [head.join('\n'), ...blocks].join('\n\n')
}
