import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/access'
import { toInventoryItem, type InventoryItem } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { RecipeDangerZone, RecipeEditor } from '../recipe-editor'

export const metadata: Metadata = { title: 'Editar receta' }

export default async function EditarRecetaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('recipes.edit')

  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const supabase = await createClient()
  const [recipeRes, itemsRes] = await Promise.all([
    supabase
      .from('recipes')
      .select('id, name, notes, sale_price, output_qty, output_item_id, craft_location, archived, recipe_ingredients(item_id, quantity)')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('inventory_overview').select('id, name, category, min_stock, unit_cost, archived, stock, created_at, image_path'),
  ])
  if (recipeRes.error || itemsRes.error) throw new Error('No se pudo cargar la receta')
  const recipe = recipeRes.data
  if (!recipe) notFound()

  // Items activos, más los archivados que la receta ya usa (para que sigan apareciendo).
  const used = new Set([...recipe.recipe_ingredients.map((line) => line.item_id), recipe.output_item_id])
  const items = itemsRes.data
    .map(toInventoryItem)
    .filter((item): item is InventoryItem => item !== null && (!item.archived || used.has(item.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(({ id: itemId, name, unitCost, archived, imagePath }) => ({ id: itemId, name, unitCost, archived, imagePath }))

  return (
    <div className="page">
      <div className="phead">
        <h1>{recipe.name}</h1>
        <p>{recipe.archived ? 'Receta archivada' : 'Editar receta'}</p>
        <Link href={`/recetas?r=${recipe.id}`} className="btn sm ghost">
          ← Volver a la receta
        </Link>
      </div>
      <div className="grid one">
        <section className="card">
          <div className="scroll scroll-top">
            <RecipeEditor
              items={items}
              initial={{
                recipeId: recipe.id,
                name: recipe.name,
                notes: recipe.notes,
                salePrice: recipe.sale_price,
                outputQty: recipe.output_qty,
                outputItemId: recipe.output_item_id,
                craftLocation: recipe.craft_location === 'hand' ? 'hand' : 'workbench',
                ingredients: recipe.recipe_ingredients.map((line) => ({ itemId: line.item_id, quantity: line.quantity })),
              }}
            />
            <RecipeDangerZone recipeId={recipe.id} name={recipe.name} archived={recipe.archived} />
          </div>
        </section>
      </div>
    </div>
  )
}
