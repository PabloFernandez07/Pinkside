import type { Database } from '@/lib/database.types'

type OverviewRow = Database['public']['Views']['inventory_overview']['Row']

export interface InventoryItem {
  id: number
  name: string
  category: string | null
  minStock: number
  unitCost: number
  archived: boolean
  stock: number
  /** Nombre del archivo de la foto en Storage (ver `itemImageUrl`), o null si no tiene. */
  imagePath: string | null
}

/** Cantidad máxima por movimiento (coincide con la restricción de la base de datos). */
export const MAX_QUANTITY = 1_000_000

/** Supabase tipa todas las columnas de una vista como anulables; descartamos filas incompletas. */
export function toInventoryItem(row: OverviewRow): InventoryItem | null {
  if (row.id === null || row.name === null) return null
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    minStock: row.min_stock ?? 0,
    unitCost: row.unit_cost ?? 0,
    archived: row.archived ?? false,
    stock: row.stock ?? 0,
    imagePath: row.image_path,
  }
}

/** `empty`: agotado y se esperaba tener; `low`: por debajo del mínimo; `ok`: correcto (o sin mínimo). */
export type StockState = 'empty' | 'low' | 'ok'

export function stockState(stock: number, minStock: number): StockState {
  if (minStock <= 0) return 'ok'
  if (stock <= 0) return 'empty'
  return stock < minStock ? 'low' : 'ok'
}

/** Está por debajo del mínimo (incluye agotado). Sin mínimo configurado nunca hay alerta. */
export const isLowStock = (stock: number, minStock: number): boolean => stockState(stock, minStock) !== 'ok'

/** Porcentaje para la barra de nivel: el mínimo equivale al 50 %; con el doble del mínimo está llena. */
export function stockLevelPercent(stock: number, minStock: number): number {
  if (stock <= 0) return 0
  if (minStock <= 0) return 100
  return Math.min(100, Math.round((stock / (minStock * 2)) * 100))
}

/** Valor del inventario a coste unitario (ignora los archivados). */
export const inventoryValue = (items: readonly InventoryItem[]): number =>
  items.reduce((total, item) => (item.archived ? total : total + item.stock * item.unitCost), 0)

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Búsqueda por nombre o categoría sin distinguir mayúsculas ni tildes. Vacío = todo. */
export function matchesSearch(item: Pick<InventoryItem, 'name' | 'category'>, query: string): boolean {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(item.name).includes(needle) || fold(item.category ?? '').includes(needle)
}
