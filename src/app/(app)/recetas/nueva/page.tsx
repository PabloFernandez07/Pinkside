import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/lib/access'
import { toInventoryItem, type InventoryItem } from '@/lib/stock'
import { createClient } from '@/lib/supabase/server'
import { RecipeEditor } from '../recipe-editor'

export const metadata: Metadata = { title: 'Nueva receta' }

export default async function NuevaRecetaPage() {
  await requirePermission('recipes.edit')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_overview')
    .select('id, name, category, min_stock, unit_cost, archived, stock, created_at, image_path')
  if (error) throw new Error('No se pudo cargar el inventario')

  const items = data
    .map(toInventoryItem)
    .filter((item): item is InventoryItem => item !== null && !item.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(({ id, name, unitCost, archived, imagePath }) => ({ id, name, unitCost, archived, imagePath }))

  return (
    <div className="page">
      <div className="phead">
        <h1>Nueva receta</h1>
        <p>Elige los ingredientes del inventario y las cantidades por tanda</p>
        <Link href="/recetas" className="btn sm ghost">
          ← Volver a recetas
        </Link>
      </div>
      <div className="grid one">
        <section className="card">
          <div className="scroll scroll-top">
            <RecipeEditor items={items} />
          </div>
        </section>
      </div>
    </div>
  )
}
