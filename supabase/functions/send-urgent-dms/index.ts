// Pinkside · Envío de MD de Discord para pedidos urgentes (Edge Function de Supabase, runtime Deno).
//
// ESTADO: desplegada (verify_jwt desactivado: la autenticación es la cabecera `x-worker-secret`). Necesita dos
// secretos que pone el dueño del proyecto en Supabase (Edge Functions → Secrets): DISCORD_BOT_TOKEN y
// URGENT_WORKER_SECRET, y el mismo valor de este último en Vault como `urgent_worker_secret` para el trigger.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente en la función.
//
// Cómo funciona: lee los avisos `pending` de pedidos aún abiertos, abre un MD con cada destinatario por su
// Discord ID y los marca `sent` o `failed`. Escribe a quien haya instalado la aplicación en su cuenta
// (User Install, sin servidor compartido; verificado con dos cuentas). Quien no la instaló recibe `failed`.
// Se invoca con POST y la cabecera `x-worker-secret`: lo hace el trigger `urgent_notifications_dm` (migración
// 0020) en cuanto se encolan avisos, así el MD sale al crear el pedido.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const DISCORD_API = 'https://discord.com/api/v10'
const BATCH = 25

const PRIORITY_LABEL: Record<string, string> = { high: 'alta', critical: 'crítica' }

// Mismos colores que ACCENT_COLORS de src/lib/accents.ts (el recuadro lleva el acento de cada destinatario).
const ACCENT_COLORS: Record<string, string> = {
  emerald: '#54bf92',
  pink: '#ff6cae',
  indigo: '#8a9cff',
  amber: '#d78c00',
  cyan: '#00728a',
}
const DEFAULT_ACCENT = 'pink'

// Límites de un embed de Discord.
const LIMITS = { title: 256, description: 4096, field: 1024, footer: 2048 }
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

interface RequestRow {
  priority: string
  title: string
  body: string | null
  author_name: string
  status: string
  created_at: string
  item: { name: string } | null
}

// Debe coincidir con `buildDm` de src/lib/urgent.ts (es lo que ve la vista previa de la web).
function buildDm(request: RequestRow, accent: string | undefined) {
  const hex = ACCENT_COLORS[accent ?? ''] ?? ACCENT_COLORS[DEFAULT_ACCENT]
  return {
    content: `${request.priority === 'critical' ? '🚨' : '⚠️'} **URGENTE · Prioridad ${PRIORITY_LABEL[request.priority] ?? request.priority}**`,
    embeds: [
      {
        title: clip(request.title.trim(), LIMITS.title),
        ...(request.body?.trim() ? { description: clip(request.body.trim(), LIMITS.description) } : {}),
        color: Number.parseInt(hex.slice(1), 16),
        ...(request.item?.name ? { fields: [{ name: 'Item', value: clip(request.item.name, LIMITS.field) }] } : {}),
        footer: { text: clip(`Pedido por ${request.author_name} · Pinkside`, LIMITS.footer) },
        timestamp: request.created_at,
      },
    ],
  }
}

async function discord(path: string, token: string, body: unknown): Promise<Response> {
  return await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const CLAIM_MARK = 'enviando'

// Comparación en tiempo constante (no revela cuántos caracteres del secreto coinciden).
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i]
  return diff === 0
}

type Outcome = { status: 'sent' | 'failed' | 'skipped'; error?: string }

Deno.serve(async (req) => {
  const token = Deno.env.get('DISCORD_BOT_TOKEN')
  const secret = Deno.env.get('URGENT_WORKER_SECRET')
  if (!token || !secret) return new Response('No configurado', { status: 503 })
  if (req.method !== 'POST' || !sameSecret(req.headers.get('x-worker-secret') ?? '', secret)) {
    return new Response('No autorizado', { status: 401 })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: queued, error: queueError } = await db
    .from('urgent_notifications')
    .select('id')
    .eq('status', 'pending')
    .is('error', null)
    .order('id')
    .limit(BATCH)
  if (queueError) return new Response('Error leyendo la cola', { status: 500 })

  // Reserva atómica: solo la ejecución que consigue cambiar `error` de null a 'enviando' se queda con la fila,
  // así dos ejecuciones simultáneas (dos pedidos seguidos) nunca envían el mismo aviso dos veces.
  const { data: pending, error } = await db
    .from('urgent_notifications')
    .update({ error: CLAIM_MARK })
    .in('id', (queued ?? []).map((row) => row.id))
    .eq('status', 'pending')
    .is('error', null)
    .select('id, recipient:profiles(discord_id, accent), request:urgent_requests(priority, title, body, author_name, status, created_at, item:items(name))')
  if (error) return new Response('Error reservando la cola', { status: 500 })

  let sent = 0
  let failed = 0
  const done = new Set<number>()
  // ponytail: envío secuencial; si una ejecución muere a mitad, sus filas quedan con error 'enviando' (revisar a mano).
  for (const row of pending ?? []) {
    const request = row.request as RequestRow | null
    const recipient = row.recipient as { discord_id: string; accent: string } | null
    const discordId = recipient?.discord_id
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
          ...buildDm(request, recipient?.accent),
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
    done.add(row.id)
    if (outcome.status === 'sent') sent += 1
    else if (outcome.status === 'failed') failed += 1
  }

  // Límite de Discord (429): las filas sin procesar vuelven a la cola para el siguiente pedido.
  const unprocessed = (pending ?? []).map((row) => row.id).filter((id) => !done.has(id))
  if (unprocessed.length > 0) await db.from('urgent_notifications').update({ error: null }).in('id', unprocessed)

  return Response.json({ processed: (pending ?? []).length, sent, failed })
})
