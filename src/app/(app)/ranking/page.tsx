import type { Metadata } from 'next'
import Link from 'next/link'
import { MemberAvatar } from '@/components/member-avatar'
import { Pager } from '@/components/pager'
import { requireMember } from '@/lib/access'
import { rankBand, toBandStat } from '@/lib/community'
import { paginate, parsePage } from '@/lib/pagination'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Ranking' }

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { profile } = await requireMember('active')
  const { pagina } = await searchParams

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('band_stats')
  if (error) throw new Error('No se pudo cargar el ranking')

  const board = rankBand(data.map((row) => toBandStat(row)))
  const podium = board.filter((row) => row.medal).slice(0, 3)
  const paged = paginate(board, parsePage(pagina))
  const champion = board[0]?.medal ? board[0] : null

  return (
    <div className="page">
      <div className="phead">
        <h1>Ranking de la banda</h1>
        <p>Actividad de los últimos 30 días: 1 punto por movimiento de caja o de inventario y 2 por cada pedido urgente</p>
      </div>

      {champion && (
        <section className="champion" aria-label="Miembro del mes">
          <MemberAvatar name={champion.stat.name} url={champion.stat.avatarUrl} size="lg" />
          <div>
            <span className="small muted">Miembro del mes</span>
            <h2>
              <Link href={`/miembros/${champion.stat.id}`}>{champion.stat.name}</Link>
            </h2>
            <p className="muted">
              {champion.stat.points30d} puntos
              {champion.stat.motto ? ` · «${champion.stat.motto}»` : ''}
            </p>
          </div>
        </section>
      )}

      {podium.length > 1 && (
        <ol className="podium" aria-label="Podio">
          {podium.map(({ stat, place, medal }) => (
            <li key={stat.id} data-place={place}>
              <span className="medal" aria-hidden="true">
                {medal}
              </span>
              <MemberAvatar name={stat.name} url={stat.avatarUrl} size="md" />
              <b>
                <Link href={`/miembros/${stat.id}`}>{stat.name}</Link>
              </b>
              <span className="mono">{stat.points30d} pts</span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid one">
        <section className="card">
          <header>
            <h2>Clasificación</h2>
            <span className="hint">{board.length} miembros</span>
          </header>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Puesto</th>
                  <th scope="col">Miembro</th>
                  <th scope="col">Rango</th>
                  <th scope="col" className="num">Puntos · 30 d</th>
                  <th scope="col" className="num">Caja · total</th>
                  <th scope="col" className="num">Inventario · total</th>
                  <th scope="col" className="num">Crafteos · total</th>
                  <th scope="col" className="num">Urgentes · total</th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map(({ stat, place, medal }) => (
                  <tr key={stat.id} className={stat.id === profile.id ? 'me' : undefined}>
                    <td className="mono">{medal ?? place}</td>
                    <td>
                      <Link href={`/miembros/${stat.id}`} className="who-cell">
                        <MemberAvatar name={stat.name} url={stat.avatarUrl} size="sm" />
                        <b>{stat.name}</b>
                      </Link>
                    </td>
                    <td>{stat.rankName ?? '—'}</td>
                    <td className="num mono">{stat.points30d}</td>
                    <td className="num mono">{stat.cashMoves}</td>
                    <td className="num mono">{stat.stockMoves}</td>
                    <td className="num mono">{stat.crafts}</td>
                    <td className="num mono">{stat.urgents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager label="Paginación del ranking" path="/ranking" page={paged.page} lastPage={paged.lastPage} />
          </div>
        </section>
      </div>
    </div>
  )
}
