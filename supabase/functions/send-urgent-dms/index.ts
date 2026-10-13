// Pinkside · Envío de MD de Discord para pedidos urgentes (Edge Function de Supabase, runtime Deno).
//
// ESTADO: preparada, NO desplegada. Necesita dos secretos que pone el dueño del proyecto en Supabase
// (Edge Functions → Secrets): DISCORD_BOT_TOKEN y URGENT_WORKER_SECRET. Nunca van en el repositorio.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente en la función.
//
// Cómo funciona: lee los avisos `pending` de pedidos aún abiertos, abre un MD con cada destinatario por su
// Discord ID y los marca `sent` o `failed`. Escribe a quien haya instalado la aplicación en su cuenta
// (User Install, sin servidor compartido; verificado con dos cuentas). Quien no la instaló recibe `failed`.
// Se invoca con POST y la cabecera `x-worker-secret` (p. ej. desde un Database Webhook al insertar en
// `urgent_notifications`, o desde un cron cada minuto).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const DISCORD_API = 'https://discord.com/api/v10'
const BATCH = 25
const MAX_DM_LENGTH = 1800

const PRIORITY_LABEL: Record<string, string> = { high: 'alta', critical: 'crítica' }

interface RequestRow {
  priority: string
  title: string
  body: string | null
  author_name: string
  status: string
  item: { name: string } | null
}

// Debe coincidir con `buildDm` de src/lib/urgent.ts (es lo que ve la vista previa de la web).
function buildDm(request: RequestRow): string {
  const lines = [
    `${request.priority === 'critical' ? '🚨' : '⚠️'} **URGENTE · Prioridad ${PRIORITY_LABEL[request.priority] ?? request.priority}**`,
    `**${request.title.trim()}**`,
  ]
  if (request.body?.trim()) lines.push(request.body.trim())
  if (request.item?.name) lines.push(`Item: ${request.item.name}`)
  lines.push(`Pedido por ${request.author_name} · Pinkside`)
  const text = lines.join('\n')
  return text.length > MAX_DM_LENGTH ? `${text.slice(0, MAX_DM_LENGTH - 1)}…` : text
}

async function discord(path: string, token: string, body: unknown): Promise<Response> {
  return await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

type Outcome = { status: 'sent' | 'failed' | 'skipped'; error?: string }

Deno.serve(async (req) => {
  const token = Deno.env.get('DISCORD_BOT_TOKEN')
  const secret = Deno.env.get('URGENT_WORKER_SECRET')
  if (!token || !secret) return new Response('No configurado', { status: 503 })
  if (req.method !== 'POST' || req.headers.get('x-worker-secret') !== secret) {
    return new Response('No autorizado', { status: 401 })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: pending, error } = await db
    .from('urgent_notifications')
    .select('id, recipient:profiles(discord_id), request:urgent_requests(priority, title, body, author_name, status, item:items(name))')
    .eq('status', 'pending')
    .order('id')
    .limit(BATCH)
  if (error) return new Response('Error leyendo la cola', { status: 500 })

  let sent = 0
  let failed = 0
  // ponytail: envío secuencial y un solo trabajador a la vez; si hiciera falta más caudal, reservar filas con un RPC.
  for (const row of pending ?? []) {
    const request = row.request as RequestRow | null
    const discordId = (row.recipient as { discord_id: string } | null)?.discord_id
    let outcome: Outcome = { status: 'failed', error: 'datos incompletos' }

    if (request && request.status !== 'open') {
      outcome = { status: 'skipped', error: 'pedido cerrado antes del envío' }
    } else if (request && discordId) {
      const channel = await discord('/users/@me/channels', token, { recipient_id: discordId })
      if (channel.status === 429) break // límite de Discord: se reintenta en la próxima ejecución
      if (!channel.ok) {
        outcome = { status: 'failed', error: `no se pudo abrir el MD (${channel.status})` }
      } else {
        const { id } = (await channel.json()) as { id: string }
        // allowed_mentions vacío: un título con @everyone no debe mencionar a nadie.
        const message = await discord(`/channels/${id}/messages`, token, {
          content: buildDm(request),
          allowed_mentions: { parse: [] },
        })
        if (message.status === 429) break
        outcome = message.ok ? { status: 'sent' } : { status: 'failed', error: `Discord respondió ${message.status}` }
      }
    }

    await db
      .from('urgent_notifications')
      .update({
        status: outcome.status,
        error: outcome.error ?? null,
        sent_at: outcome.status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', row.id)
    if (outcome.status === 'sent') sent += 1
    else if (outcome.status === 'failed') failed += 1
  }

  return Response.json({ processed: (pending ?? []).length, sent, failed })
})
