import type { Metadata } from 'next'
import { AdminTabs } from '@/components/admin-tabs'
import { Pager } from '@/components/pager'
import { requirePermission } from '@/lib/access'
import { paginate, parsePage } from '@/lib/pagination'
import { canManageRank } from '@/lib/rules'
import { createClient } from '@/lib/supabase/server'
import { ApproveForm, BlockForm, RankForm } from './member-actions'

export const metadata: Metadata = { title: 'Administración' }

const STATUS_LABEL = { pending: 'Pendiente', active: 'Activo', blocked: 'Bloqueado' } as const

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; pendientes?: string }>
}) {
  const actor = await requirePermission('members.manage')
  const { pagina, pendientes } = await searchParams
  const supabase = await createClient()

  const [membersRes, ranksRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, discord_username, first_name, last_name, state_id, phone, status, rank_id, created_at')
      .in('status', ['pending', 'active', 'blocked'])
      .order('created_at'),
    supabase.from('ranks').select('id, name, level').order('level', { ascending: false }),
  ])
  if (membersRes.error || ranksRes.error) throw new Error('No se pudo cargar la administración')

  const actorLevel = actor.rankLevel ?? 0
  const ranks = ranksRes.data
  const rankById = new Map(ranks.map((rank) => [rank.id, rank]))
  const assignable = ranks.filter((rank) => rank.level <= actorLevel)
  const pending = membersRes.data.filter((member) => member.status === 'pending')
  const fullName = (member: (typeof pending)[number]) =>
    [member.first_name, member.last_name].filter(Boolean).join(' ') || '—'
  const levelOf = (member: (typeof pending)[number]) => rankById.get(member.rank_id ?? -1)?.level ?? 0
  // Ordenados por rango (de mayor a menor) y, dentro de cada rango, por nombre.
  const members = membersRes.data
    .filter((member) => member.status !== 'pending')
    .sort((a, b) => levelOf(b) - levelOf(a) || fullName(a).localeCompare(fullName(b), 'es'))
  const pendingPage = paginate(pending, parsePage(pendientes))
  const memberPage = paginate(members, parsePage(pagina))

  return (
    <div className="page">
      <div className="phead">
        <h1>Administración</h1>
        <p>Aprueba accesos y gestiona los rangos de la banda</p>
      </div>
      <AdminTabs current="miembros" canMembers canRoles={actor.permissions.has('roles.manage')} />
      <div className="grid g-admin">
        <section className="card">
          <header>
            <h2>Pendientes de aprobar</h2>
            <span className="hint">{pending.length}</span>
          </header>
          <div className="scroll">
            {pending.length === 0 ? (
              <p className="muted">No hay nadie esperando.</p>
            ) : (
              <ul className="stacked">
                {pendingPage.rows.map((member) => (
                  <li key={member.id}>
                    <div>
                      <b>{fullName(member)}</b>
                      <small className="muted">
                        @{member.discord_username ?? '—'} · StateID {member.state_id} · {member.phone}
                      </small>
                    </div>
                    <ApproveForm
                      memberId={member.id}
                      ranks={assignable.map(({ id, name }) => ({ id, name }))}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Pager
              label="Paginación de pendientes"
              path="/admin"
              params={{ pagina }}
              paramName="pendientes"
              page={pendingPage.page}
              lastPage={pendingPage.lastPage}
            />
          </div>
        </section>

        <section className="card">
          <header>
            <h2>Miembros</h2>
            <span className="hint">{members.length}</span>
          </header>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Miembro</th>
                  <th>StateID</th>
                  <th>Rango</th>
                  <th>Estado</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {memberPage.rows.map((member) => {
                  const rank = member.rank_id === null ? undefined : rankById.get(member.rank_id)
                  const isSelf = member.id === actor.profile.id
                  const canManage = !isSelf && canManageRank(actorLevel, rank?.level ?? 0)
                  return (
                    <tr key={member.id}>
                      <td>
                        {fullName(member)}
                        <small className="muted block">@{member.discord_username ?? '—'}</small>
                      </td>
                      <td className="mono">{member.state_id}</td>
                      <td>
                        {canManage && member.status === 'active' && member.rank_id !== null ? (
                          <RankForm
                            memberId={member.id}
                            current={member.rank_id}
                            ranks={assignable.map(({ id, name }) => ({ id, name }))}
                          />
                        ) : (
                          (rank?.name ?? '—')
                        )}
                      </td>
                      <td>
                        <span className={`chip ${member.status === 'blocked' ? 'bad' : 'ok'}`}>
                          {STATUS_LABEL[member.status as keyof typeof STATUS_LABEL]}
                        </span>
                      </td>
                      <td className="num">
                        {canManage && <BlockForm memberId={member.id} blocked={member.status === 'blocked'} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pager
              label="Paginación de miembros"
              path="/admin"
              params={{ pendientes }}
              page={memberPage.page}
              lastPage={memberPage.lastPage}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
