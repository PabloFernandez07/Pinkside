import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminTabs } from '@/components/admin-tabs'
import { requirePermission } from '@/lib/access'
import { currentWeekStart, parseSections, parseWeek, shiftWeek, weekLabel } from '@/lib/report'
import { createClient } from '@/lib/supabase/server'
import { ReportForm } from './report-form'

export const metadata: Metadata = { title: 'Informe semanal' }

const COLUMNS = 'week_start, sections, updated_at, updated_by_name'

export default async function InformePage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const actor = await requirePermission('roles.manage')
  const { semana } = await searchParams
  const current = currentWeekStart()
  const week = parseWeek(semana) ?? current

  const supabase = await createClient()
  const { data: saved, error } = await supabase.from('weekly_reports').select(COLUMNS).eq('week_start', week).maybeSingle()
  if (error) throw new Error('No se pudo cargar el informe')

  // Semana sin informe: se parte del último anterior, porque casi todo se repite de una semana a otra.
  const { data: previous } = saved
    ? { data: null }
    : await supabase.from('weekly_reports').select(COLUMNS).lt('week_start', week).order('week_start', { ascending: false }).limit(1).maybeSingle()
  const source = saved ?? previous

  return (
    <div className="page">
      <div className="phead">
        <h1>Administración</h1>
        <p>Informe semanal de actos ilícitos, listo para copiar al canal de Discord</p>
      </div>
      <AdminTabs current="informe" canMembers={actor.permissions.has('members.manage')} canRoles />

      <section className="card">
        <header>
          <h2>Semana {weekLabel(week)}</h2>
          <span className="hint">
            {saved
              ? `Guardado por ${saved.updated_by_name}`
              : previous
                ? `Sin guardar: parte del informe de la semana ${weekLabel(previous.week_start)}`
                : 'Sin guardar'}
          </span>
        </header>
        <div className="scroll">
          <nav className="actions" aria-label="Cambiar de semana">
            <Link className="btn ghost sm" href={`/admin/informe?semana=${shiftWeek(week, -1)}`}>
              ← Semana anterior
            </Link>
            {week !== current && (
              <Link className="btn ghost sm" href="/admin/informe">
                Esta semana
              </Link>
            )}
            {week < current && (
              <Link className="btn ghost sm" href={`/admin/informe?semana=${shiftWeek(week, 1)}`}>
                Semana siguiente →
              </Link>
            )}
          </nav>
          <ReportForm key={week} week={week} initial={parseSections(source?.sections)} />
        </div>
      </section>
    </div>
  )
}
