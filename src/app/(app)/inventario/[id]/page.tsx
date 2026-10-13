import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/access'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { PAGE_SIZE, parsePage } from '@/lib/pagination'
import { stockState, toInventoryItem } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { ItemThumb } from '@/components/item-thumb'
import { Pager } from '@/components/pager'
import { ArchiveForm, EditItemForm, MoveStockForm, ReverseStockForm } from '../inventory-forms'
import { PhotoForm } from './photo-form'

export const metadata: Metadata = { title: 'Item' }

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pagina?: string }>
}) {
  const actor = await requirePermission('inventory.view')
  const canEdit = actor.permissions.has('inventory.edit')

  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const page = parsePage((await searchParams).pagina)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const [itemRes, movesRes] = await Promise.all([
    supabase
      .from('inventory_overview')
      .select('id, name, category, min_stock, unit_cost, archived, stock, created_at, image_path')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('stock_movements')
      .select('id, delta, reason, author_name, created_at, reverses_id', { count: 'exact' })
      .eq('item_id', id)
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ])
  if (itemRes.error || movesRes.error) throw new Error('No se pudo cargar el item')

  const item = itemRes.data ? toInventoryItem(itemRes.data) : null
  if (!item) notFound()
  const moves = movesRes.data
  const totalMoves = movesRes.count ?? 0
  const lastPage = Math.max(1, Math.ceil(totalMoves / PAGE_SIZE))

  const reversedRes = moves.length
    ? await supabase.from('stock_movements').select('reverses_id').in('reverses_id', moves.map((move) => move.id))
    : { data: [], error: null }
  if (reversedRes.error) throw new Error('No se pudo cargar el item')
  const reversed = new Set((reversedRes.data ?? []).map((row) => row.reverses_id))

  const state = stockState(item.stock, item.minStock)

  return (
    <div className="page">
      <div className="phead">
        <ItemThumb name={item.name} path={item.imagePath} size="lg" />
        <h1>{item.name}</h1>
        <p>
          {item.category ?? 'Sin categoría'}
          {item.archived && ' · archivado'}
        </p>
        {state !== 'ok' && !item.archived && actor.permissions.has('urgent.send') && (
          <Link href={`/urgentes?item=${item.id}`} className="btn sm">
            Pedir urgente
          </Link>
        )}
        <Link href="/inventario" className="btn sm ghost">
          ← Volver al inventario
        </Link>
      </div>

      <div className="kpis kpis-4">
        <article className="kpi main">
          <span className="l">Stock actual</span>
          <strong className="v mono">{item.stock}</strong>
          <span className="s">{state === 'ok' ? 'por encima del mínimo' : state === 'low' ? 'por debajo del mínimo' : 'agotado'}</span>
        </article>
        <article className="kpi">
          <span className="l">Stock mínimo</span>
          <strong className="v mono">{item.minStock}</strong>
          <span className="s">{item.minStock === 0 ? 'sin aviso configurado' : 'por debajo salta la alerta'}</span>
        </article>
        <article className="kpi">
          <span className="l">Coste por unidad</span>
          <strong className="v mono">{formatMoney(item.unitCost)}</strong>
          <span className="s">para recetas y valoración</span>
        </article>
        <article className="kpi">
          <span className="l">Valor en stock</span>
          <strong className="v mono">{formatMoney(item.stock * item.unitCost)}</strong>
          <span className="s">stock × coste</span>
        </article>
      </div>

      <div className="grid g-inv">
        <section className="card">
          <header>
            <h2>Movimientos de este item</h2>
            <span className="hint">{totalMoves === 0 ? 'ninguno' : `${totalMoves} en total`}</span>
          </header>
          <div className="scroll">
            {moves.length === 0 ? (
              <p className="muted">Todavía no hay movimientos de este item.</p>
            ) : (
              <table className="movements">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Quién</th>
                    <th>Motivo</th>
                    <th className="num">Cantidad</th>
                    <th><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((move) => {
                    const isReversed = reversed.has(move.id)
                    const isReversal = move.reverses_id !== null
                    return (
                      <tr key={move.id} className={isReversed ? 'reversed' : undefined}>
                        <td className="mono nowrap">{formatDateTime(move.created_at)}</td>
                        <td>{move.author_name}</td>
                        <td>
                          {move.reason}
                          {isReversed && <span className="chip warn tag">Anulado</span>}
                          {isReversal && <span className="chip tag">Anulación</span>}
                        </td>
                        <td className={`num mono ${move.delta < 0 ? 'out' : 'in'}`}>
                          {move.delta > 0 ? '+' : '−'}
                          {Math.abs(move.delta)}
                        </td>
                        <td className="num">
                          {canEdit && !isReversed && !isReversal && <ReverseStockForm movementId={move.id} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <Pager
              label="Paginación de movimientos del item"
              path={`/inventario/${item.id}`}
              page={page}
              lastPage={lastPage}
              previous="← Más recientes"
              next="Más antiguos →"
            />
          </div>
        </section>

        <div className="stack">
          {canEdit && !item.archived && (
            <section className="card">
              <header>
                <h2>Mover stock</h2>
              </header>
              <div className="scroll">
                <MoveStockForm itemId={item.id} itemName={item.name} />
              </div>
            </section>
          )}
          {canEdit ? (
            <section className="card grow">
              <header>
                <h2>Datos del item</h2>
              </header>
              <div className="scroll">
                <PhotoForm itemId={item.id} itemName={item.name} imagePath={item.imagePath} />
                <EditItemForm
                  itemId={item.id}
                  name={item.name}
                  category={item.category}
                  minStock={item.minStock}
                  unitCost={item.unitCost}
                />
                <div className="danger-zone">
                  <ArchiveForm itemId={item.id} archived={item.archived} />
                  <small className="muted">
                    Archivar oculta el item del inventario pero conserva su historial. No se puede borrar.
                  </small>
                </div>
              </div>
            </section>
          ) : (
            <section className="card">
              <header>
                <h2>Solo consulta</h2>
              </header>
              <div className="scroll">
                <p className="muted">Tu rango permite ver este item, pero no editarlo ni mover su stock.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
