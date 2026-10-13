import type { Metadata } from 'next'
import Link from 'next/link'
import { ItemThumb } from '@/components/item-thumb'
import { SectionTabs } from '@/components/section-tabs'
import { requirePermission } from '@/lib/access'
import { formatMoney } from '@/lib/money'
import {
  inventoryValue,
  isLowStock,
  matchesSearch,
  stockLevelPercent,
  stockState,
  toInventoryItem,
  type InventoryItem,
} from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { ImportForm, MoveStockForm, NewItemForm } from './inventory-forms'

export const metadata: Metadata = { title: 'Inventario' }

const STATE_CHIP = {
  empty: { label: 'Agotado', className: 'chip bad' },
  low: { label: 'Bajo mínimo', className: 'chip bad' },
  ok: { label: 'Correcto', className: 'chip ok' },
} as const

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bajo?: string; archivados?: string }>
}) {
  const actor = await requirePermission('inventory.view')
  const canEdit = actor.permissions.has('inventory.edit')

  const params = await searchParams
  const query = (params.q ?? '').slice(0, 60)
  const onlyLow = params.bajo === '1'
  const showArchived = params.archivados === '1'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_overview')
    .select('id, name, category, min_stock, unit_cost, archived, stock, created_at, image_path')
  if (error) throw new Error('No se pudo cargar el inventario')

  const all = (data ?? [])
    .map(toInventoryItem)
    .filter((item): item is InventoryItem => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const active = all.filter((item) => !item.archived)
  const lowCount = active.filter((item) => isLowStock(item.stock, item.minStock)).length
  const visible = all.filter(
    (item) =>
      (showArchived || !item.archived) &&
      matchesSearch(item, query) &&
      (!onlyLow || isLowStock(item.stock, item.minStock)),
  )
  const filtered = Boolean(query) || onlyLow || showArchived

  return (
    <div className="page">
      <div className="phead">
        <h1>Inventario</h1>
        <p>Stock compartido de la banda, calculado a partir de cada movimiento</p>
      </div>
      <SectionTabs
        label="Secciones del inventario"
        tabs={[
          { href: '/inventario', label: 'Items', current: true },
          { href: '/inventario/historial', label: 'Historial', current: false },
        ]}
      />

      <div className="kpis">
        <article className="kpi">
          <span className="l">Referencias activas</span>
          <strong className="v mono">{active.length}</strong>
          <span className="s">{all.length - active.length} archivadas</span>
        </article>
        <article className="kpi">
          <span className="l">Bajo el mínimo</span>
          <strong className={`v mono${lowCount > 0 ? ' neg' : ''}`}>{lowCount}</strong>
          <span className="s">{lowCount === 0 ? 'todo en orden' : 'conviene reponer'}</span>
        </article>
        <article className="kpi">
          <span className="l">Valor a coste</span>
          <strong className="v mono">{formatMoney(inventoryValue(all))}</strong>
          <span className="s">stock × coste por unidad</span>
        </article>
      </div>

      <div className="grid g-inv">
        <section className="card">
          <header>
            <h2>Items</h2>
            <span className="hint">
              {filtered ? `${visible.length} de ${all.length}` : `${visible.length} items`}
            </span>
          </header>
          <form method="get" className="filters" role="search">
            <input type="search" name="q" defaultValue={query} placeholder="Buscar por nombre o categoría" aria-label="Buscar items" />
            <label className="check">
              <input type="checkbox" name="bajo" value="1" defaultChecked={onlyLow} /> Solo bajo mínimo
            </label>
            <label className="check">
              <input type="checkbox" name="archivados" value="1" defaultChecked={showArchived} /> Archivados
            </label>
            <button type="submit" className="btn sm ghost">
              Filtrar
            </button>
            {filtered && (
              <Link href="/inventario" className="muted small">
                Limpiar
              </Link>
            )}
          </form>
          <div className="scroll">
            {visible.length === 0 ? (
              <p className="muted">
                {all.length === 0
                  ? canEdit
                    ? 'Todavía no hay items. Crea el primero o importa una tabla desde el panel de la derecha.'
                    : 'Todavía no hay items en el inventario.'
                  : 'Ningún item coincide con ese filtro.'}
              </p>
            ) : (
              <table className="inventory">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Stock</th>
                    <th className="num">Mínimo</th>
                    <th>Nivel</th>
                    <th className="num">Mover</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const state = stockState(item.stock, item.minStock)
                    const chip = item.archived ? { label: 'Archivado', className: 'chip' } : STATE_CHIP[state]
                    return (
                      <tr key={item.id} className={item.archived ? 'reversed' : undefined}>
                        <td>
                          <div className="item-cell">
                            <ItemThumb name={item.name} path={item.imagePath} />
                            <div>
                              <Link href={`/inventario/${item.id}`} className="item-link">
                                {item.name}
                              </Link>
                              {item.category && <small className="block muted">{item.category}</small>}
                            </div>
                          </div>
                        </td>
                        <td className={`num mono${!item.archived && state !== 'ok' ? ' low' : ''}`}>{item.stock}</td>
                        <td className="num mono">{item.minStock}</td>
                        <td>
                          <span className={`bar ${state}`} aria-hidden="true">
                            <i style={{ width: `${stockLevelPercent(item.stock, item.minStock)}%` }} />
                          </span>
                          <span className={`${chip.className} tag-block`}>{chip.label}</span>
                        </td>
                        <td className="num">{canEdit && !item.archived && <MoveStockForm itemId={item.id} itemName={item.name} compact />}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="stack">
          {canEdit ? (
            <>
              <section className="card">
                <header>
                  <h2>Nuevo item</h2>
                </header>
                <div className="scroll">
                  <NewItemForm />
                </div>
              </section>
              <section className="card grow">
                <header>
                  <h2>Importar items</h2>
                  <span className="hint">hasta 500 filas</span>
                </header>
                <div className="scroll">
                  <ImportForm />
                </div>
              </section>
            </>
          ) : (
            <section className="card">
              <header>
                <h2>Solo consulta</h2>
              </header>
              <div className="scroll">
                <p className="muted">Tu rango permite ver el inventario, pero no crear items ni mover stock.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
