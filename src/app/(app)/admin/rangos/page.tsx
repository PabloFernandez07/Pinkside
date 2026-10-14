import type { Metadata } from 'next'
import { AdminTabs } from '@/components/admin-tabs'
import { requirePermission } from '@/lib/access'
import { LEADER_LEVEL, canManageRank, isProtectedPermission } from '@/lib/rules'
import { createClient } from '@/lib/supabase/server'
import { PermissionToggle } from './permission-toggle'
import { isMetric, type MetricKey } from '@/lib/community'
import { CreateRankForm, DeleteRankForm, EditRankForm, RequirementsForm } from './rank-forms'

export const metadata: Metadata = { title: 'Rangos y permisos' }

export default async function RangosPage() {
  const actor = await requirePermission('roles.manage')
  const supabase = await createClient()

  const [ranksRes, permissionsRes, grantsRes, membersRes, reqRes] = await Promise.all([
    supabase.from('ranks').select('id, name, level').order('level', { ascending: false }),
    supabase.from('permissions').select('key, label, description').order('key'),
    supabase.from('rank_permissions').select('rank_id, permission'),
    supabase.from('profiles').select('rank_id').not('rank_id', 'is', null),
    supabase.from('rank_requirements').select('rank_id, metric, target'),
  ])
  if (ranksRes.error || permissionsRes.error || grantsRes.error || membersRes.error || reqRes.error) {
    throw new Error('No se pudieron cargar los rangos')
  }
  const requirements = new Map<number, Partial<Record<MetricKey, number>>>()
  for (const row of reqRes.data) {
    if (isMetric(row.metric)) requirements.set(row.rank_id, { ...requirements.get(row.rank_id), [row.metric]: row.target })
  }

  const actorLevel = actor.rankLevel ?? 0
  const ranks = ranksRes.data
  const granted = new Set(grantsRes.data.map((row) => `${row.rank_id}:${row.permission}`))
  const memberCount = new Map<number, number>()
  for (const row of membersRes.data) {
    if (row.rank_id !== null) memberCount.set(row.rank_id, (memberCount.get(row.rank_id) ?? 0) + 1)
  }

  const lockReason = (rank: (typeof ranks)[number], permission: string, checked: boolean): string | undefined => {
    if (!canManageRank(actorLevel, rank.level)) return 'Solo puedes editar rangos inferiores al tuyo'
    if (checked && isProtectedPermission(rank.level, permission)) return 'El Líder no puede perder este permiso'
    if (!checked && actorLevel < LEADER_LEVEL && !actor.permissions.has(permission)) {
      return 'No puedes conceder un permiso que no tienes'
    }
    return undefined
  }

  return (
    <div className="page">
      <div className="phead">
        <h1>Administración</h1>
        <p>Qué puede hacer cada rango. Los cambios se guardan al marcar la casilla.</p>
      </div>
      <AdminTabs current="rangos" canMembers={actor.permissions.has('members.manage')} canRoles />

      <div className="grid g-ranks">
        <section className="card">
          <header>
            <h2>Permisos por rango</h2>
            <span className="hint">{ranks.length} rangos</span>
          </header>
          <div className="scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Permiso</th>
                  {ranks.map((rank) => (
                    <th key={rank.id} scope="col" className="ctr">
                      {rank.name}
                      <small className="block mono">nivel {rank.level}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionsRes.data.map((permission) => (
                  <tr key={permission.key}>
                    <th scope="row">
                      {permission.label}
                      <small className="block muted">{permission.description}</small>
                    </th>
                    {ranks.map((rank) => {
                      const checked = granted.has(`${rank.id}:${permission.key}`)
                      const reason = lockReason(rank, permission.key, checked)
                      return (
                        <td key={rank.id} className="ctr">
                          <PermissionToggle
                            key={`${rank.id}:${permission.key}:${checked}`}
                            rankId={rank.id}
                            permission={permission.key}
                            label={`${permission.label} para ${rank.name}`}
                            checked={checked}
                            disabled={Boolean(reason)}
                            reason={reason}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="card grow">
            <header>
              <h2>Rangos</h2>
              <span className="hint">nombre y nivel</span>
            </header>
            <div className="scroll">
              <ul className="rank-list">
                {ranks.map((rank) => {
                  const manageable = canManageRank(actorLevel, rank.level)
                  const isLeader = rank.level >= LEADER_LEVEL
                  const members = memberCount.get(rank.id) ?? 0
                  const blockedReason = isLeader
                    ? 'el rango Líder no se puede borrar'
                    : members > 0
                      ? 'tiene miembros'
                      : undefined
                  return (
                    <li key={rank.id}>
                      {manageable ? (
                        <EditRankForm rankId={rank.id} name={rank.name} level={rank.level} isLeader={isLeader} />
                      ) : (
                        <div className="rank-static">
                          <b>{rank.name}</b>
                          <span className="mono">nivel {rank.level}</span>
                        </div>
                      )}
                      <div className="rank-meta">
                        <small className="muted">
                          {members} {members === 1 ? 'miembro' : 'miembros'}
                        </small>
                        {manageable && <DeleteRankForm rankId={rank.id} name={rank.name} blockedReason={blockedReason} />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>

          <section className="card">
            <header>
              <h2>Requisitos para ascender</h2>
              <span className="hint">se ven en «Tu camino»</span>
            </header>
            <div className="scroll">
              {ranks.filter((rank) => rank.level < LEADER_LEVEL && canManageRank(actorLevel, rank.level)).map((rank) => (
                <RequirementsForm
                  key={`${rank.id}:${JSON.stringify(requirements.get(rank.id) ?? {})}`}
                  rankId={rank.id}
                  rankName={rank.name}
                  values={requirements.get(rank.id) ?? {}}
                />
              ))}
            </div>
          </section>

          <section className="card">
            <header>
              <h2>Nuevo rango</h2>
            </header>
            <div className="scroll">
              <CreateRankForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
