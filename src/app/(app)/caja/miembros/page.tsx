import type { Metadata } from 'next'
import { Pager } from '@/components/pager'
import { SectionTabs } from '@/components/section-tabs'
import { requirePermission } from '@/lib/access'
import { formatMoney, formatSignedMoney } from '@/lib/money'
import { paginate, parsePage } from '@/lib/pagination'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dinero por miembro' }

export default async function CajaMiembrosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  // Lo ven quienes tienen `cash.members` (por defecto Líder y Lugarteniente); la base de datos lo vuelve a comprobar.
  await requirePermission('cash.view')
  await requirePermission('cash.members')
  const { pagina } = await searchParams

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cash_by_member')
  if (error) throw new Error('No se pudo cargar el dinero por miembro')

  const paged = paginate(data, parsePage(pagina))
  const deposited = data.reduce((sum, row) => sum + row.deposited, 0)
  const withdrawn = data.reduce((sum, row) => sum + row.withdrawn, 0)

  return (
    <div className="page">
      <div className="phead">
        <h1>Caja común</h1>
        <p>Lo que ha aportado y retirado cada miembro, sin contar lo anulado</p>
      </div>
      <SectionTabs
        label="Secciones de la caja"
        tabs={[
          { href: '/caja', label: 'Movimientos', current: false },
          { href: '/caja/miembros', label: 'Por miembro', current: true },
        ]}
      />

      <div className="kpis">
        <article className="kpi main">
          <span className="l">Balance de los miembros</span>
          <strong className={`v mono${deposited - withdrawn < 0 ? ' neg' : ''}`}>{formatMoney(deposited - withdrawn)}</strong>
          <span className="s">aportado menos retirado</span>
        </article>
        <article className="kpi">
          <span className="l">Aportado</span>
          <strong className="v mono">{formatMoney(deposited)}</strong>
          <span className="s">entradas de {data.length} {data.length === 1 ? 'miembro' : 'miembros'}</span>
        </article>
        <article className="kpi">
          <span className="l">Retirado</span>
          <strong className="v mono">{formatMoney(withdrawn)}</strong>
          <span className="s">salidas registradas</span>
        </article>
      </div>

      <div className="grid one">
        <section className="card">
          <header>
            <h2>Por miembro</h2>
            <span className="hint">{data.length === 0 ? 'ninguno todavía' : `${data.length} con movimientos`}</span>
          </header>
          <div className="scroll">
            {paged.rows.length === 0 ? (
              <p className="muted">Todavía no hay movimientos en la caja.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th className="num">Aportado</th>
                    <th className="num">Retirado</th>
                    <th className="num">Balance</th>
                    <th className="num">Movimientos</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((row) => (
                    <tr key={row.member_id}>
                      <td>
                        <b>{row.member_name}</b>
                      </td>
                      <td className="num mono in">{formatMoney(row.deposited)}</td>
                      <td className="num mono out">{formatMoney(row.withdrawn)}</td>
                      <td className={`num mono ${row.net < 0 ? 'out' : 'in'}`}>{formatSignedMoney(row.net)}</td>
                      <td className="num mono">{row.movements}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager label="Paginación por miembro" path="/caja/miembros" page={paged.page} lastPage={paged.lastPage} />
          </div>
        </section>
      </div>
    </div>
  )
}
