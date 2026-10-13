import type { Metadata } from 'next'
import Link from 'next/link'
import { ItemThumb } from '@/components/item-thumb'
import { Pager } from '@/components/pager'
import { requireMember } from '@/lib/access'
import { relativeTime } from '@/lib/activity'
import { paginate, parsePage } from '@/lib/pagination'
import { createClient } from '@/lib/supabase/server'
import {
  PRIORITY_LABEL,
  describeDelivery,
  summarizeDelivery,
  type NotificationStatus,
  type UrgentPriority,
} from '@/lib/urgent'
import { CloseForm } from './close-form'
import { UrgentForm, type RecipientOption } from './urgent-form'

export const metadata: Metadata = { title: 'Urgentes' }

const CLOSED_SHOWN = 10

const isPriority = (value: string): value is UrgentPriority => value === 'high' || value === 'critical'
const isNotificationStatus = (value: string): value is NotificationStatus =>
  value === 'pending' || value === 'sent' || value === 'failed' || value === 'skipped'

export default async function UrgentesPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; titulo?: string; pagina?: string }>
}) {
  const { profile, permissions } = await requireMember('active')
  const canSend = permissions.has('urgent.send')
  const params = await searchParams

  const supabase = await createClient()
  // Una sola ronda: abiertos (con el estado de sus avisos embebido; RLS lo oculta a quien no puede enviarlos),
  // cerrados, items (solo id y nombre: no hace falta el stock) y posibles destinatarios.
  const [openRes, closedRes, itemsRes, membersRes] = await Promise.all([
    supabase
      .from('urgent_requests')
      .select('id, title, body, priority, item_id, author_name, created_at, urgent_notifications(status)')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('urgent_requests')
      .select('id, title, status, author_name, closed_at, closed_by_name')
      .neq('status', 'open')
      .order('closed_at', { ascending: false })
      .limit(CLOSED_SHOWN),
    supabase.from('items').select('id, name, image_path').eq('archived', false).order('name'),
    canSend
      ? supabase.from('profiles').select('id, first_name, last_name, discord_username, dm_urgent').eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
  ])
  if (openRes.error || closedRes.error || itemsRes.error || membersRes.error) {
    throw new Error('No se pudieron cargar los pedidos urgentes')
  }

  const open = openRes.data
  const openPaged = paginate(open, parsePage(params.pagina))
  const closed = closedRes.data
  const items = new Map(itemsRes.data.map((item) => [item.id, item]))
  const delivery = new Map<number, NotificationStatus[]>(
    open.map((request) => [
      request.id,
      request.urgent_notifications.map((row) => row.status).filter(isNotificationStatus),
    ]),
  )

  const recipients: RecipientOption[] = (membersRes.data ?? [])
    .map((member) => ({
      id: member.id,
      name: [member.first_name, member.last_name].filter(Boolean).join(' ') || member.discord_username || 'Miembro',
      dmUrgent: member.dm_urgent,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const itemOptions = itemsRes.data
  const authorName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.discord_username || 'Miembro'

  const requestedItem = Number.parseInt(params.item ?? '', 10)
  const initialItemId = items.has(requestedItem) ? requestedItem : null
  const initialTitle = (params.titulo ?? '').slice(0, 80) || (initialItemId ? `Falta ${items.get(initialItemId)?.name}` : '')

  return (
    <div className="page">
      <div className="phead">
        <h1>Pedidos urgentes</h1>
        <p>Avisos prioritarios para la banda; los elegidos reciben además un MD de Discord</p>
      </div>

      <div className={`grid ${canSend ? 'g-urg' : ''}`}>
        <section className="card">
          <header>
            <h2>Abiertos</h2>
            <span className="hint">{open.length === 0 ? 'ninguno' : `${open.length} pendientes`}</span>
          </header>
          <div className="scroll">
            {open.length === 0 ? (
              <p className="muted">No hay pedidos urgentes abiertos.</p>
            ) : (
              <ul className="urgent-list">
                {openPaged.rows.map((request) => {
                  const priority = isPriority(request.priority) ? request.priority : 'high'
                  const summary = describeDelivery(summarizeDelivery(delivery.get(request.id) ?? []))
                  return (
                    <li key={request.id} className={`urgent ${priority}`}>
                      <div className="urgent-head">
                        <span className="item-cell">
                          {request.item_id && items.has(request.item_id) && (
                            <ItemThumb
                              name={items.get(request.item_id)?.name ?? ''}
                              path={items.get(request.item_id)?.image_path}
                            />
                          )}
                          <b>{request.title}</b>
                        </span>
                        <span className={`chip ${priority === 'critical' ? 'bad' : 'warn'}`}>{PRIORITY_LABEL[priority]}</span>
                      </div>
                      {request.body && <p>{request.body}</p>}
                      <p className="small muted">
                        {request.item_id && items.has(request.item_id) && (
                          <>
                            <Link href={`/inventario/${request.item_id}`}>{items.get(request.item_id)?.name}</Link> ·{' '}
                          </>
                        )}
                        {request.author_name} · {relativeTime(request.created_at)}
                        {summary && ` · ${summary}`}
                      </p>
                      {canSend && <CloseForm requestId={request.id} />}
                    </li>
                  )
                })}
              </ul>
            )}
            <Pager label="Paginación de pedidos abiertos" path="/urgentes" page={openPaged.page} lastPage={openPaged.lastPage} />

            {closed.length > 0 && (
              <>
                <h3 className="subhead">Cerrados recientemente</h3>
                <ul className="urgent-list closed">
                  {closed.map((request) => (
                    <li key={request.id} className="urgent">
                      <div className="urgent-head">
                        <b>{request.title}</b>
                        <span className="chip">{request.status === 'covered' ? 'Cubierto' : 'Cancelado'}</span>
                      </div>
                      <p className="small muted">
                        {request.author_name} · cerrado por {request.closed_by_name ?? 'alguien'}
                        {request.closed_at && ` · ${relativeTime(request.closed_at)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {canSend && (
          <section className="card">
            <header>
              <h2>Nuevo pedido</h2>
            </header>
            <div className="scroll">
              <UrgentForm
                recipients={recipients}
                items={itemOptions}
                authorName={authorName}
                initialTitle={initialTitle}
                initialItemId={initialItemId}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
