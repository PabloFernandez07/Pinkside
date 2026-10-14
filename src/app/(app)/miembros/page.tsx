import type { Metadata } from 'next'
import Link from 'next/link'
import { requireMember } from '@/lib/access'
import { Pager } from '@/components/pager'
import { formatDateTime } from '@/lib/format'
import { paginate, parsePage } from '@/lib/pagination'
import { matchesSearch } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { AddAllowedForm, RemoveAllowedForm } from './allowlist-forms'
import { MapAccessToggle } from './map-access-toggle'

export const metadata: Metadata = { title: 'Miembros' }

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; accesos?: string }>
}) {
  const { profile, permissions } = await requireMember('active')
  const canAllow = permissions.has('members.allow')
  const { q = '', pagina, accesos } = await searchParams

  const supabase = await createClient()
  const [membersRes, allowedRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, discord_id, discord_username, first_name, last_name, state_id, phone, created_at, map_access, rank:ranks(name, level, rank_permissions(permission))')
      .eq('status', 'active'),
    canAllow
      ? supabase
          .from('allowed_discord_ids')
          .select('discord_id, label, added_by_name, created_at')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (membersRes.error || allowedRes.error) throw new Error('No se pudieron cargar los miembros')
  const data = membersRes.data
  const allowed = allowedRes.data
  const activeByDiscordId = new Map(data.map((member) => [member.discord_id, member]))

  const all = data
    .map((member) => ({
      ...member,
      fullName: [member.first_name, member.last_name].filter(Boolean).join(' ') || '—',
    }))
    .sort(
      (a, b) =>
        (b.rank?.level ?? 0) - (a.rank?.level ?? 0) || a.fullName.localeCompare(b.fullName, 'es'),
    )
  // Busca por nombre, Discord, StateID o teléfono, sin distinguir mayúsculas ni tildes.
  const members = all.filter((member) =>
    matchesSearch(
      { name: `${member.fullName} ${member.discord_username ?? ''} ${member.state_id ?? ''} ${member.phone ?? ''}`, category: null },
      q,
    ),
  )
  const memberPage = paginate(members, parsePage(pagina))
  const allowedPage = paginate(allowed, parsePage(accesos))

  return (
    <div className="page">
      <div className="phead">
        <h1>Miembros</h1>
        <p>Toda la banda, con sus datos de contacto</p>
      </div>

      <div className={`grid${canAllow ? ' g-urg' : ''}`}>
      <section className="card">
        <header>
          <h2>Banda</h2>
          <span className="hint">
            {members.length === all.length ? `${all.length} miembros` : `${members.length} de ${all.length}`}
          </span>
        </header>
        <form method="get" className="filters" role="search">
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre, Discord, StateID o teléfono" aria-label="Buscar miembros" />
          <button type="submit" className="btn sm">
            Buscar
          </button>
          {q && (
            <Link href="/miembros" className="muted small">
              Limpiar
            </Link>
          )}
        </form>
        <div className="scroll">
          {members.length === 0 ? (
            <p className="muted">Nadie coincide con la búsqueda.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Miembro</th>
                  <th scope="col">Discord</th>
                  <th scope="col">StateID</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Rango</th>
                  {canAllow && <th scope="col">Mapa</th>}
                  <th scope="col">Desde</th>
                </tr>
              </thead>
              <tbody>
                {memberPage.rows.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link href={`/miembros/${member.id}`}>
                        <b>{member.fullName}</b>
                      </Link>
                    </td>
                    <td className="muted">@{member.discord_username ?? '—'}</td>
                    <td className="mono">{member.state_id ?? '—'}</td>
                    <td className="mono nowrap">{member.phone ?? '—'}</td>
                    <td>{member.rank?.name ?? '—'}</td>
                    {canAllow && (
                      <td>
                        <MapAccessToggle
                          memberId={member.id}
                          name={member.fullName}
                          allowed={member.map_access}
                          locked={member.rank?.rank_permissions.some((row) => row.permission === 'members.allow') ?? false}
                        />
                      </td>
                    )}
                    <td className="mono nowrap">{formatDateTime(member.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pager
            label="Paginación de miembros"
            path="/miembros"
            params={{ q, accesos }}
            page={memberPage.page}
            lastPage={memberPage.lastPage}
          />
        </div>
      </section>

      {canAllow && (
        <section className="card">
          <header>
            <h2>Acceso permitido</h2>
            <span className="hint">{allowed.length} IDs de Discord</span>
          </header>
          <div className="scroll">
            <p className="muted small allow-intro">
              Solo las cuentas de Discord de esta lista pueden entrar en la web. Quien no esté aquí verá un aviso al intentarlo.
            </p>
            <AddAllowedForm />
            <ul className="allow-list">
              {allowedPage.rows.map((entry) => {
                const member = activeByDiscordId.get(entry.discord_id)
                const name = entry.label ?? member?.discord_username ?? entry.discord_id
                return (
                  <li key={entry.discord_id}>
                    <div className="allow-main">
                      <b>{name}</b>
                      <span className="mono small muted">{entry.discord_id}</span>
                      <span className="small muted">
                        {entry.added_by_name} · {formatDateTime(entry.created_at)}
                      </span>
                    </div>
                    <span className={`chip ${member ? 'ok' : 'warn'}`}>{member ? 'Ya es miembro' : 'Aún no ha entrado'}</span>
                    {entry.discord_id !== profile.discord_id && <RemoveAllowedForm discordId={entry.discord_id} name={name} />}
                  </li>
                )
              })}
            </ul>
            <Pager
              label="Paginación de accesos permitidos"
              path="/miembros"
              params={{ q, pagina }}
              paramName="accesos"
              page={allowedPage.page}
              lastPage={allowedPage.lastPage}
            />
          </div>
        </section>
      )}
      </div>
    </div>
  )
}
