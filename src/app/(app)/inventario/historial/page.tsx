import type { Metadata } from 'next'
import Link from 'next/link'
import { ItemThumb } from '@/components/item-thumb'
import { SectionTabs } from '@/components/section-tabs'
import { requirePermission } from '@/lib/access'
import { formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { ReverseStockForm } from '../inventory-forms'

export const metadata: Metadata = { title: 'Historial de inventario' }

const PAGE_SIZE = 25

export default async function HistorialPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const actor = await requirePermission('inventory.view')
  const canEdit = actor.permissions.has('inventory.edit')

  const { pagina } = await searchParams
  const page = Math.max(1, Number.parseInt(pagina ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('stock_movements')
    .select('id, delta, reason, author_name, created_at, reverses_id, item:items(id, name, image_path)', { count: 'exact' })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error('No se pudo cargar el historial')

  const rows = data
  const total = count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const reversedRes = rows.length
    ? await supabase.from('stock_movements').select('reverses_id').in('reverses_id', rows.map((row) => row.id))
    : { data: [], error: null }
  if (reversedRes.error) throw new Error('No se pudo cargar el historial')
  const reversed = new Set((reversedRes.data ?? []).map((row) => row.reverses_id))

  return (
    <div className="page">
      <div className="phead">
        <h1>Inventario</h1>
        <p>Cada entrada y salida de stock, con quién la hizo. No se edita ni se borra.</p>
      </div>
      <SectionTabs
        label="Secciones del inventario"
        tabs={[
          { href: '/inventario', label: 'Items', current: false },
          { href: '/inventario/historial', label: 'Historial', current: true },
        ]}
      />

      <div className="grid one">
        <section className="card">
          <header>
            <h2>Movimientos</h2>
            <span className="hint">{total === 0 ? 'ninguno todavía' : `página ${page} de ${lastPage}`}</span>
          </header>
          <div className="scroll">
            {rows.length === 0 ? (
              <p className="muted">
                {total === 0 ? 'Todavía no hay movimientos de stock.' : 'No hay movimientos en esta página.'}
              </p>
            ) : (
              <table className="movements">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Item</th>
                    <th>Quién</th>
                    <th>Motivo</th>
                    <th className="num">Cantidad</th>
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
                        <td>
                          {row.item ? (
                            <div className="item-cell">
                              <ItemThumb name={row.item.name} path={row.item.image_path} size="sm" />
                              <Link href={`/inventario/${row.item.id}`} className="item-link">
                                {row.item.name}
                              </Link>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{row.author_name}</td>
                        <td>
                          {row.reason}
                          {isReversed && <span className="chip warn tag">Anulado</span>}
                          {isReversal && <span className="chip tag">Anulación</span>}
                        </td>
                        <td className={`num mono ${row.delta < 0 ? 'out' : 'in'}`}>
                          {row.delta > 0 ? '+' : '−'}
                          {Math.abs(row.delta)}
                        </td>
                        <td className="num">
                          {canEdit && !isReversed && !isReversal && <ReverseStockForm movementId={row.id} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {lastPage > 1 && (
              <nav className="pager" aria-label="Paginación del historial">
                {page > 1 ? <Link href={`/inventario/historial?pagina=${page - 1}`}>← Más recientes</Link> : <span />}
                {page < lastPage ? <Link href={`/inventario/historial?pagina=${page + 1}`}>Más antiguos →</Link> : <span />}
              </nav>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
