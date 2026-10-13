import type { InventoryItem } from '@/lib/stock'

export const MAX_BATCHES = 10_000

export type CraftLocation = 'workbench' | 'hand'

export const CRAFT_LABEL: Record<CraftLocation, string> = { workbench: 'Workbench', hand: 'A mano' }

export interface RecipeIngredient {
  itemId: number
  name: string
  /** Cantidad por tanda. */
  quantity: number
  unitCost: number
  stock: number
  imagePath: string | null
}

export interface RecipeData {
  id: number
  name: string
  notes: string | null
  /** Precio de venta por unidad producida. */
  salePrice: number
  /** Unidades que produce cada tanda. */
  outputQty: number
  outputItemId: number | null
  /** Dónde se fabrica: en la Workbench o directamente con las manos. */
  craftLocation: CraftLocation
  archived: boolean
  ingredients: RecipeIngredient[]
}

export interface IngredientRow {
  itemId: number
  name: string
  perBatch: number
  needed: number
  stock: number
  missing: number
  cost: number
  imagePath: string | null
}

export interface RecipeAnalysis {
  batches: number
  rows: IngredientRow[]
  costPerBatch: number
  revenuePerBatch: number
  profitPerBatch: number
  /** Puede ser decimal (el coste de una tanda repartido entre sus unidades). */
  costPerUnit: number
  profitPerUnit: number
  /** Beneficio sobre ingresos, en %. Nulo si no hay precio de venta. */
  marginPercent: number | null
  units: number
  totalCost: number
  totalRevenue: number
  totalProfit: number
  /** Tandas completas que se pueden hacer con el stock actual. */
  maxBatches: number
  /** Hay stock de todo para las tandas pedidas y la receta no está archivada. */
  canCraft: boolean
}

/** Convierte lo escrito en el campo de tandas a un entero entre 1 y MAX_BATCHES (vacío o inválido = 1). */
export function clampBatches(input: string | number): number {
  const value = typeof input === 'number' ? input : Number.parseInt(input.trim(), 10)
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(Math.floor(value), MAX_BATCHES)
}

/** Calcula costes, beneficio, qué falta y cuántas tandas se pueden hacer con el stock actual. */
export function analyzeRecipe(recipe: RecipeData, batchesInput: number): RecipeAnalysis {
  const batches = clampBatches(batchesInput)

  const rows: IngredientRow[] = recipe.ingredients.map((ingredient) => {
    const needed = ingredient.quantity * batches
    return {
      itemId: ingredient.itemId,
      name: ingredient.name,
      perBatch: ingredient.quantity,
      needed,
      stock: ingredient.stock,
      missing: Math.max(0, needed - ingredient.stock),
      cost: needed * ingredient.unitCost,
      imagePath: ingredient.imagePath,
    }
  })

  const costPerBatch = recipe.ingredients.reduce((total, i) => total + i.quantity * i.unitCost, 0)
  const revenuePerBatch = recipe.salePrice * recipe.outputQty
  const profitPerBatch = revenuePerBatch - costPerBatch
  const maxBatches =
    recipe.ingredients.length === 0
      ? 0
      : Math.min(...recipe.ingredients.map((i) => Math.floor(Math.max(0, i.stock) / i.quantity)))

  return {
    batches,
    rows,
    costPerBatch,
    revenuePerBatch,
    profitPerBatch,
    costPerUnit: costPerBatch / recipe.outputQty,
    profitPerUnit: recipe.salePrice - costPerBatch / recipe.outputQty,
    marginPercent: revenuePerBatch > 0 ? Math.round((profitPerBatch / revenuePerBatch) * 100) : null,
    units: recipe.outputQty * batches,
    totalCost: costPerBatch * batches,
    totalRevenue: revenuePerBatch * batches,
    totalProfit: profitPerBatch * batches,
    maxBatches,
    canCraft: !recipe.archived && rows.length > 0 && rows.every((row) => row.missing === 0),
  }
}

interface RecipeRow {
  id: number
  name: string
  notes: string | null
  sale_price: number
  output_qty: number
  output_item_id: number | null
  craft_location: string
  archived: boolean
  recipe_ingredients: { item_id: number; quantity: number }[]
}

/** Une una fila de receta de la base de datos con los items (coste y stock) del inventario. */
export function toRecipeData(row: RecipeRow, items: ReadonlyMap<number, InventoryItem>): RecipeData {
  const ingredients: RecipeIngredient[] = []
  for (const line of row.recipe_ingredients) {
    const item = items.get(line.item_id)
    if (!item) continue
    ingredients.push({
      itemId: item.id,
      name: item.name,
      quantity: line.quantity,
      unitCost: item.unitCost,
      stock: item.stock,
      imagePath: item.imagePath,
    })
  }
  ingredients.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    salePrice: row.sale_price,
    outputQty: row.output_qty,
    outputItemId: row.output_item_id,
    craftLocation: row.craft_location === 'hand' ? 'hand' : 'workbench',
    archived: row.archived,
    ingredients,
  }
}
