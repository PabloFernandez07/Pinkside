import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MemberAvatar } from '@/components/member-avatar'
import { requireMember } from '@/lib/access'
import { achievementsFor, toBandStat } from '@/lib/community'
import { formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Perfil de miembro' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireMember('active')
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('band_stats', { p_member: id })
  if (error) throw new Error('No se pudo cargar el perfil')
  const row = data.find((entry) => entry.member_id === id)
  if (!row) notFound()

  const stat = toBandStat(row)
  const achievements = achievementsFor(stat)
  const earned = achievements.filter((achievement) => achievement.done).length
  const facts: [string, string | number][] = [
    ['Puntos · 30 días', stat.points30d],
    ['Movimientos de caja', stat.cashMoves],
    ['Movimientos de inventario', stat.stockMoves],
    ['Crafteos', stat.crafts],
    ['Pedidos urgentes', stat.urgents],
    ['Días en la banda', stat.days],
  ]

  return (
    <div className="page">
      <div className="phead">
        <h1>Perfil de miembro</h1>
        <p>
          <Link href="/miembros">← Miembros</Link> · <Link href="/ranking">Ranking</Link>
        </p>
      </div>

      <section className="member-hero card">
        <MemberAvatar name={stat.name} url={stat.avatarUrl} size="lg" />
        <div>
          <h2>{stat.name}</h2>
          <p>
            <span className="chip ok">{stat.rankName ?? 'Sin rango'}</span>{' '}
            <span className="small muted">en la banda desde {formatDateTime(stat.joinedAt)}</span>
          </p>
          {stat.motto && <p className="motto">«{stat.motto}»</p>}
          {stat.id === profile.id && (
            <p className="small">
              <Link href="/perfil">Editar mi perfil y mi lema</Link>
            </p>
          )}
        </div>
      </section>

      <div className="kpis kpis-6">
        {facts.map(([label, value]) => (
          <article key={label} className="kpi">
            <span className="l">{label}</span>
            <strong className="v mono">{value}</strong>
          </article>
        ))}
      </div>

      <div className="grid one">
        <section className="card">
          <header>
            <h2>Logros</h2>
            <span className="hint">
              {earned} de {achievements.length}
            </span>
          </header>
          <div className="scroll">
            <ul className="achievements">
              {achievements.map((achievement) => (
                <li key={achievement.id} className={achievement.done ? 'done' : undefined}>
                  <span className="icon" aria-hidden="true">
                    {achievement.icon}
                  </span>
                  <div>
                    <b>{achievement.title}</b>
                    <span className="small muted">{achievement.description}</span>
                    {achievement.done ? (
                      <span className="chip ok tag-block">Conseguido</span>
                    ) : (
                      <>
                        <span className="bar" aria-hidden="true">
                          <i style={{ width: `${achievement.percent}%` }} />
                        </span>
                        <span className="small mono muted">
                          {achievement.current} / {achievement.target}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
