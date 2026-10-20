import type { Metadata } from 'next'
import { requireAuditor } from '@/lib/access'
import { formatDateTime } from '@/lib/format'
import { Pager } from '@/components/pager'
import { SectionTabs } from '@/components/section-tabs'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Auditoría' }

const EVENTS: Record<string, { label: string; chip: string }> = {
  login: { label: 'Entró', chip: 'chip ok' },
  denied: { label: 'Denegado', chip: 'chip bad' },
  blocked: { label: 'Bloqueado', chip: 'chip warn' },
}

const UA_MAX = 70

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; ver?: string }>
}) {
  await requireAuditor()

  const { pagina, ver } = await searchParams
  const onlyDenied = ver === 'denegados'
  const page = parsePage(pagina)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  let query = supabase
    .from('access_log')
    .select('id, created_at, event, discord_id, discord_username, member_name, ip, user_agent', { count: 'exact' })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (onlyDenied) query = query.eq('event', 'denied')
  const { data: rows, count, error } = await query
  if (error) throw new Error('No se pudo cargar la auditoría')

  const total = count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="page">
      <div className="phead">
        <h1>Auditoría de accesos</h1>
        <p>Cada vez que alguien vuelve de Discord, tenga cuenta o no. Solo la ves tú</p>
      </div>
      <SectionTabs
        label="Filtro de la auditoría"
        tabs={[
          { href: '/auditoria', label: 'Todos', current: !onlyDenied },
          { href: '/auditoria?ver=denegados', label: 'Denegados', current: onlyDenied },
        ]}
      />

      <section className="card">
        <header>
          <h2>{onlyDenied ? 'Intentos denegados' : 'Accesos'}</h2>
          <span className="hint">{total === 0 ? 'ninguno todavía' : `página ${page} de ${lastPage}`}</span>
        </header>
        <div className="scroll">
          {rows.length === 0 ? (
            <p className="muted">{total === 0 ? 'Todavía no hay accesos registrados.' : 'No hay accesos en esta página.'}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Resultado</th>
                  <th>Discord</th>
                  <th>Miembro</th>
                  <th>IP</th>
                  <th>Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const event = EVENTS[row.event] ?? { label: row.event, chip: 'chip' }
                  const agent = row.user_agent ?? ''
                  return (
                    <tr key={row.id}>
                      <td className="mono nowrap">{formatDateTime(row.created_at)}</td>
                      <td>
                        <span className={event.chip}>{event.label}</span>
                      </td>
                      <td>
                        {row.discord_username ?? '—'}
                        <br />
                        <span className="mono muted small">{row.discord_id}</span>
                      </td>
                      <td>{row.member_name ?? <span className="muted">Sin cuenta de miembro</span>}</td>
                      <td className="mono">{row.ip || '—'}</td>
                      <td className="muted small" title={agent}>
                        {agent.length > UA_MAX ? `${agent.slice(0, UA_MAX)}…` : agent || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <Pager
            label="Paginación de la auditoría"
            path="/auditoria"
            params={{ ver: onlyDenied ? 'denegados' : undefined }}
            page={page}
            lastPage={lastPage}
            previous="← Más recientes"
            next="Más antiguos →"
          />
        </div>
      </section>
    </div>
  )
}
