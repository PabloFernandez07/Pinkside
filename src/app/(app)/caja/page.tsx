import type { Metadata } from 'next'
import { requirePermission } from '@/lib/access'
import { formatDateTime } from '@/lib/format'
import { Pager } from '@/components/pager'
import { formatMoney, formatSignedMoney } from '@/lib/money'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { createClient } from '@/lib/supabase/server'
import { MovementForm, ReverseForm } from './movement-forms'

export const metadata: Metadata = { title: 'Caja' }

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const actor = await requirePermission('cash.view')
  const canIn = actor.permissions.has('cash.write')
  const canOut = actor.permissions.has('cash.withdraw')

  const { pagina } = await searchParams
  const page = parsePage(pagina)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const [summaryRes, listRes] = await Promise.all([
    supabase.from('cash_summary').select('balance, income_7d, expense_7d, movements').single(),
    supabase
      .from('cash_movements')
      .select('id, amount, reason, author_name, created_at, reverses_id', { count: 'exact' })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ])
  if (summaryRes.error || listRes.error) throw new Error('No se pudo cargar la caja')

  const rows = listRes.data
  const total = listRes.count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Qué movimientos de esta página ya han sido anulados.
  const reversedRes = rows.length
    ? await supabase.from('cash_movements').select('reverses_id').in('reverses_id', rows.map((row) => row.id))
    : { data: [], error: null }
  if (reversedRes.error) throw new Error('No se pudo cargar la caja')
  const reversed = new Set((reversedRes.data ?? []).map((row) => row.reverses_id))

  const summary = summaryRes.data
  const balance = summary.balance ?? 0

  return (
    <div className="page">
      <div className="phead">
        <h1>Caja común</h1>
        <p>Libro de movimientos: se añade, nunca se edita ni se borra</p>
      </div>

      <div className="kpis">
        <article className="kpi main">
          <span className="l">Saldo de la caja</span>
          <strong className={`v mono${balance < 0 ? ' neg' : ''}`}>{formatMoney(balance)}</strong>
          <span className="s">{summary.movements ?? 0} movimientos registrados</span>
        </article>
        <article className="kpi">
          <span className="l">Entradas · 7 días</span>
          <strong className="v mono">{formatMoney(summary.income_7d ?? 0)}</strong>
          <span className="s">sin contar lo anulado</span>
        </article>
        <article className="kpi">
          <span className="l">Salidas · 7 días</span>
          <strong className="v mono">{formatMoney(summary.expense_7d ?? 0)}</strong>
          <span className="s">sin contar lo anulado</span>
        </article>
      </div>

      <div className="grid g-caja">
        <section className="card">
          <header>
            <h2>Movimientos</h2>
            <span className="hint">
              {total === 0 ? 'ninguno todavía' : `página ${page} de ${lastPage}`}
            </span>
          </header>
          <div className="scroll">
            {rows.length === 0 ? (
              <p className="muted">
                {total === 0 ? 'Todavía no hay movimientos en la caja.' : 'No hay movimientos en esta página.'}
              </p>
            ) : (
              <table className="movements">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Quién</th>
                    <th>Motivo</th>
                    <th className="num">Importe</th>
                    <th><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isReversed = reversed.has(row.id)
                    const isReversal = row.reverses_id !== null
                    return (
                      <tr key={row.id} className={isReversed ? 'reversed' : undefined}>
                        <td className="mono nowrap">{formatDateTime(row.created_at)}</td>
                        <td>{row.author_name}</td>
                        <td>
                          {row.reason}
                          {isReversed && <span className="chip warn tag">Anulado</span>}
                          {isReversal && <span className="chip tag">Anulación</span>}
                        </td>
                        <td className={`num mono ${row.amount < 0 ? 'out' : 'in'}`}>
                          {formatSignedMoney(row.amount)}
                        </td>
                        <td className="num">
                          {canOut && !isReversed && !isReversal && <ReverseForm movementId={row.id} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <Pager
              label="Paginación de movimientos"
              path="/caja"
              page={page}
              lastPage={lastPage}
              previous="← Más recientes"
              next="Más antiguos →"
            />
          </div>
        </section>

        <section className="card">
          <header>
            <h2>Registrar movimiento</h2>
          </header>
          <div className="scroll">
            {canIn || canOut ? (
              <MovementForm canIn={canIn} canOut={canOut} />
            ) : (
              <p className="muted">Tu rango solo permite consultar la caja.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
