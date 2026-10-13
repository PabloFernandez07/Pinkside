export type UrgentPriority = 'high' | 'critical'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export const PRIORITY_LABEL: Record<UrgentPriority, string> = { high: 'Alta', critical: 'Crítica' }

/** Límites de un recuadro (embed) de Discord. */
export const EMBED_LIMITS = { title: 256, description: 4096, field: 1024, footer: 2048 } as const

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

export interface DmInput {
  priority: UrgentPriority
  title: string
  body: string | null
  authorName: string
  itemName: string | null
}

/** Contenido del MD: una línea de texto (es lo que sale en la notificación) y un recuadro con color de acento. */
export interface DmCard {
  heading: string
  title: string
  description: string | null
  fields: { name: string; value: string }[]
  footer: string
}

/** Lo que ve el destinatario. Lo usan la vista previa del formulario y (copiado) la Edge Function que lo envía. */
export function buildDm({ priority, title, body, authorName, itemName }: DmInput): DmCard {
  return {
    heading: `${priority === 'critical' ? '🚨' : '⚠️'} **URGENTE · Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}**`,
    title: clip(title.trim(), EMBED_LIMITS.title),
    description: body?.trim() ? clip(body.trim(), EMBED_LIMITS.description) : null,
    fields: itemName ? [{ name: 'Item', value: clip(itemName, EMBED_LIMITS.field) }] : [],
    footer: clip(`Pedido por ${authorName} · Pinkside`, EMBED_LIMITS.footer),
  }
}

export type DeliverySummary = Record<NotificationStatus, number>

export function summarizeDelivery(statuses: readonly NotificationStatus[]): DeliverySummary {
  const summary: DeliverySummary = { pending: 0, sent: 0, failed: 0, skipped: 0 }
  for (const status of statuses) summary[status] += 1
  return summary
}

/** Frase corta para la lista: "2 enviados · 1 en cola · 1 sin MD". Vacío si no hay avisos. */
export function describeDelivery(summary: DeliverySummary): string {
  const parts: string[] = []
  if (summary.sent) parts.push(`${summary.sent} ${summary.sent === 1 ? 'enviado' : 'enviados'}`)
  if (summary.pending) parts.push(`${summary.pending} en cola`)
  if (summary.failed) parts.push(`${summary.failed} ${summary.failed === 1 ? 'fallido' : 'fallidos'}`)
  if (summary.skipped) parts.push(`${summary.skipped} sin MD`)
  return parts.join(' · ')
}
