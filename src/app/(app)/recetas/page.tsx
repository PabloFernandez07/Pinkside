import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/lib/access'
import { ItemThumb } from '@/components/item-thumb'
import { formatMoney } from '@/lib/money'
import { CRAFT_LABEL, analyzeRecipe, toRecipeData } from '@/lib/recipes'
import { toInventoryItem, type InventoryItem } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { RecipeCalculator } from './recipe-calculator'

export const metadata: Metadata = { title: 'Recetas' }

const signed = (value: number) => (value < 0 ? `−${formatMoney(Math.abs(value))}` : formatMoney(value))

export default async function RecetasPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; archivadas?: string }>
}) {
  const actor = await requirePermission('recipes.view')
  const canEdit = actor.permissions.has('recipes.edit')
  const canCraft = actor.permissions.has('inventory.edit')

  const params = await searchParams
  const showArchived = params.archivadas === '1'

  const supabase = await createClient()
  const [recipesRes, itemsRes] = await Promise.all([
    supabase
      .from('recipes')
      .select('id, name, notes, sale_price, output_qty, output_item_id, craft_location, archived, recipe_ingredients(item_id, quantity)'),
    supabase.from('inventory_overview').select('id, name, category, min_stock, unit_cost, archived, stock, created_at, image_path'),
  ])
  if (recipesRes.error || itemsRes.error) throw new Error('No se pudieron cargar las recetas')

  const items = new Map<number, InventoryItem>()
  for (const row of itemsRes.data) {
    const item = toInventoryItem(row)
    if (item) items.set(item.id, item)
  }
  const all = recipesRes.data
    .map((row) => toRecipeData(row, items))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const archivedCount = all.filter((recipe) => recipe.archived).length
  const visible = all.filter((recipe) => showArchived || !recipe.archived)

  const requested = Number.parseInt(params.r ?? '', 10)
  const selected = visible.find((recipe) => recipe.id === requested) ?? visible[0] ?? null
  const outputName = selected?.outputItemId ? (items.get(selected.outputItemId)?.name ?? null) : null

  return (
    <div className="page">
      <div className="phead">
        <h1>Recetas</h1>
        <p>Calcula lo que cuesta fabricar, lo que ganas y lo que te falta, con el stock real</p>
        {canEdit && (
          <Link href="/recetas/nueva" className="btn">
            Nueva receta
          </Link>
        )}
      </div>

      <div className="grid g-rec">
        <section className="card">
          <header>
            <h2>Catálogo</h2>
            <span className="hint">{visible.length} recetas</span>
          </header>
          <div className="scroll">
            {visible.length === 0 ? (
              <p className="muted">
                {all.length === 0
                  ? canEdit
                    ? 'Todavía no hay recetas. Crea la primera con el botón de arriba.'
                    : 'Todavía no hay recetas.'
                  : 'No hay recetas activas.'}
              </p>
            ) : (
              <ul className="recipe-list">
                {visible.map((recipe) => {
                  const a = analyzeRecipe(recipe, 1)
                  const isSelected = selected?.id === recipe.id
                  return (
                    <li key={recipe.id}>
                      <Link
                        href={`/recetas?r=${recipe.id}${showArchived ? '&archivadas=1' : ''}`}
                        className={`recipe-item${isSelected ? ' on' : ''}`}
                        aria-current={isSelected ? 'true' : undefined}
                      >
                        <span className="item-cell">
                          <ItemThumb
                            name={recipe.name}
                            path={recipe.outputItemId ? items.get(recipe.outputItemId)?.imagePath : null}
                          />
                          <span className="recipe-text">
                            <b>{recipe.name}</b>
                            <span className="mono small">
                              {signed(Math.round(a.profitPerUnit))} / ud.
                              {a.maxBatches > 0 ? ` · ${a.maxBatches} ${a.maxBatches === 1 ? 'tanda' : 'tandas'}` : ' · sin stock'}
                              {` · ${CRAFT_LABEL[recipe.craftLocation]}`}
                            </span>
                            {recipe.archived && <span className="chip tag-block">Archivada</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {archivedCount > 0 && (
              <p className="small">
                <Link href={showArchived ? '/recetas' : '/recetas?archivadas=1'} className="muted">
                  {showArchived ? 'Ocultar archivadas' : `Ver ${archivedCount} archivadas`}
                </Link>
              </p>
            )}
          </div>
        </section>

        <section className="card">
          {selected ? (
            <>
              <header>
                <h2 className="item-cell">
                  <ItemThumb
                    name={selected.name}
                    path={selected.outputItemId ? items.get(selected.outputItemId)?.imagePath : null}
                    size="sm"
                  />
                  {selected.name}
                </h2>
                {canEdit && (
                  <Link href={`/recetas/${selected.id}`} className="btn sm ghost">
                    Editar
                  </Link>
                )}
              </header>
              <div className="scroll">
                <p className="muted small recipe-meta">
                  Vende a {formatMoney(selected.salePrice)} la unidad · produce {selected.outputQty}{' '}
                  {selected.outputQty === 1 ? 'unidad' : 'unidades'} por tanda
                  {outputName ? ` de «${outputName}»` : ' (sin item de salida)'} · se fabrica{' '}
                  {selected.craftLocation === 'hand' ? 'a mano' : 'en la Workbench'}
                  {selected.archived ? ' · archivada' : ''}
                </p>
                {selected.notes && <p className="recipe-notes">{selected.notes}</p>}
                {selected.ingredients.length === 0 ? (
                  <p className="muted">Esta receta no tiene ingredientes conocidos.</p>
                ) : (
                  <RecipeCalculator
                    key={selected.id}
                    recipe={selected}
                    canCraft={canCraft}
                    canRequestUrgent={actor.permissions.has('urgent.send')}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <header>
                <h2>Calculadora</h2>
              </header>
              <div className="scroll">
                <p className="muted">Elige una receta del catálogo para calcular su coste y su beneficio.</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
