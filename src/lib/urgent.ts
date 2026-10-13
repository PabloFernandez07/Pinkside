export type UrgentPriority = 'high' | 'critical'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export const PRIORITY_LABEL: Record<UrgentPriority, string> = { high: 'Alta', critical: 'Crítica' }

/** Discord rechaza mensajes de más de 2.000 caracteres; dejamos margen. */
export const MAX_DM_LENGTH = 1800

export interface DmInput {
  priority: UrgentPriority
  title: string
  body: string | null
  authorName: string
  itemName: string | null
}

/** Texto exacto del MD de Discord. Lo usan la vista previa del formulario y (copiado) el proceso que lo envía. */
export function buildDm({ priority, title, body, authorName, itemName }: DmInput): string {
  const lines = [
    `${priority === 'critical' ? '🚨' : '⚠️'} **URGENTE · Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}**`,
    `**${title.trim()}**`,
  ]
  if (body?.trim()) lines.push(body.trim())
  if (itemName) lines.push(`Item: ${itemName}`)
  lines.push(`Pedido por ${authorName} · Pinkside`)
  const text = lines.join('\n')
  return text.length > MAX_DM_LENGTH ? `${text.slice(0, MAX_DM_LENGTH - 1)}…` : text
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
