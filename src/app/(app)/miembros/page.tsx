import type { Metadata } from 'next'
import { requireMember } from '@/lib/access'
import { formatDateTime } from '@/lib/format'
import { matchesSearch } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Miembros' }

export default async function MiembrosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireMember('active')
  const { q = '' } = await searchParams

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, discord_username, first_name, last_name, state_id, phone, created_at, rank:ranks(name, level)')
    .eq('status', 'active')
  if (error) throw new Error('No se pudieron cargar los miembros')

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

  return (
    <div className="page">
      <div className="phead">
        <h1>Miembros</h1>
        <p>Toda la banda, con sus datos de contacto</p>
      </div>

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
            <a href="/miembros" className="muted small">
              Limpiar
            </a>
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
                  <th scope="col">Desde</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <b>{member.fullName}</b>
                    </td>
                    <td className="muted">@{member.discord_username ?? '—'}</td>
                    <td className="mono">{member.state_id ?? '—'}</td>
                    <td className="mono nowrap">{member.phone ?? '—'}</td>
                    <td>{member.rank?.name ?? '—'}</td>
                    <td className="mono nowrap">{formatDateTime(member.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
