import { describe, expect, it } from 'vitest'
import { MAX_BATCHES, analyzeRecipe, clampBatches, toRecipeData, type RecipeData } from '@/lib/recipes'
import type { InventoryItem } from '@/lib/stock'

const cargador: RecipeData = {
  id: 1,
  name: 'Cargador 9 mm',
  notes: null,
  salePrice: 1800,
  outputQty: 5,
  outputItemId: 4,
  archived: false,
  ingredients: [
    { itemId: 1, name: 'Acero', quantity: 4, unitCost: 120, stock: 100, imagePath: null },
    { itemId: 2, name: 'Pólvora', quantity: 2, unitCost: 310, stock: 50, imagePath: null },
    { itemId: 3, name: 'Plástico', quantity: 1, unitCost: 60, stock: 10, imagePath: null },
  ],
}

describe('clampBatches', () => {
  it.each([
    ['1', 1],
    ['25', 25],
    [' 7 ', 7],
    ['3.9', 3],
    ['', 1],
    ['abc', 1],
    ['0', 1],
    ['-4', 1],
    ['99999', MAX_BATCHES],
    [12, 12],
    [0, 1],
    [NaN, 1],
    [Infinity, 1],
  ])('%j → %d', (input, expected) => {
    expect(clampBatches(input)).toBe(expected)
  })
})

describe('analyzeRecipe', () => {
  it('calcula coste, ingresos y beneficio por tanda', () => {
    const a = analyzeRecipe(cargador, 1)
    expect(a.costPerBatch).toBe(4 * 120 + 2 * 310 + 60) // 1160
    expect(a.revenuePerBatch).toBe(1800 * 5) // 9000
    expect(a.profitPerBatch).toBe(9000 - 1160)
    expect(a.units).toBe(5)
  })

  it('reparte el coste de la tanda entre las unidades producidas', () => {
    const a = analyzeRecipe(cargador, 1)
    expect(a.costPerUnit).toBeCloseTo(232)
    expect(a.profitPerUnit).toBeCloseTo(1800 - 232)
  })

  it('escala con el número de tandas', () => {
    const a = analyzeRecipe(cargador, 3)
    expect(a.totalCost).toBe(1160 * 3)
    expect(a.totalRevenue).toBe(9000 * 3)
    expect(a.totalProfit).toBe((9000 - 1160) * 3)
    expect(a.units).toBe(15)
    expect(a.rows.map((r) => r.needed)).toEqual([12, 6, 3])
  })

  it('el margen es beneficio sobre ingresos, redondeado', () => {
    expect(analyzeRecipe(cargador, 1).marginPercent).toBe(Math.round(((9000 - 1160) / 9000) * 100)) // 87
  })

  it('sin precio de venta no hay margen y el beneficio es negativo', () => {
    const a = analyzeRecipe({ ...cargador, salePrice: 0 }, 1)
    expect(a.marginPercent).toBeNull()
    expect(a.profitPerBatch).toBe(-1160)
  })

  it('con pérdidas el margen es negativo', () => {
    const a = analyzeRecipe({ ...cargador, salePrice: 100, outputQty: 1 }, 1)
    expect(a.marginPercent).toBeLessThan(0)
  })

  it('calcula cuántas tandas se pueden hacer con el stock (el ingrediente más escaso manda)', () => {
    // Acero 100/4=25, Pólvora 50/2=25, Plástico 10/1=10 → 10
    expect(analyzeRecipe(cargador, 1).maxBatches).toBe(10)
  })

  it('el stock sobrante que no completa una tanda no cuenta', () => {
    const recipe: RecipeData = { ...cargador, ingredients: [{ itemId: 1, name: 'Acero', quantity: 4, unitCost: 1, stock: 7, imagePath: null }] }
    expect(analyzeRecipe(recipe, 1).maxBatches).toBe(1)
  })

  it('lo que falta se calcula por ingrediente para las tandas pedidas', () => {
    const a = analyzeRecipe(cargador, 12)
    const plastico = a.rows.find((r) => r.name === 'Plástico')
    expect(plastico).toMatchObject({ needed: 12, stock: 10, missing: 2 })
    expect(a.rows.find((r) => r.name === 'Acero')?.missing).toBe(0)
    expect(a.canCraft).toBe(false)
  })

  it('se puede fabricar justo cuando hay exactamente lo necesario', () => {
    expect(analyzeRecipe(cargador, 10).canCraft).toBe(true)
    expect(analyzeRecipe(cargador, 11).canCraft).toBe(false)
  })

  it('una receta archivada no se puede fabricar aunque haya stock', () => {
    expect(analyzeRecipe({ ...cargador, archived: true }, 1).canCraft).toBe(false)
  })

  it('una receta sin ingredientes no se puede fabricar ni tiene tandas', () => {
    const a = analyzeRecipe({ ...cargador, ingredients: [] }, 1)
    expect(a.canCraft).toBe(false)
    expect(a.maxBatches).toBe(0)
    expect(a.costPerBatch).toBe(0)
  })

  it('un stock negativo o cero impide cualquier tanda', () => {
    const recipe: RecipeData = { ...cargador, ingredients: [{ itemId: 1, name: 'Acero', quantity: 4, unitCost: 1, stock: -3, imagePath: null }] }
    expect(analyzeRecipe(recipe, 1).maxBatches).toBe(0)
  })

  it('sanea el número de tandas', () => {
    expect(analyzeRecipe(cargador, 0).batches).toBe(1)
    expect(analyzeRecipe(cargador, 999_999).batches).toBe(MAX_BATCHES)
  })
})

describe('toRecipeData', () => {
  const item = (id: number, name: string, stock: number, unitCost: number): InventoryItem => ({
    id,
    name,
    category: null,
    minStock: 0,
    unitCost,
    archived: false,
    stock,
    imagePath: null,
  })
  const items = new Map([
    [1, item(1, 'Pólvora', 50, 310)],
    [2, item(2, 'Acero', 100, 120)],
  ])
  const row = {
    id: 7,
    name: 'Cargador 9 mm',
    notes: 'Receta base',
    sale_price: 1800,
    output_qty: 5,
    output_item_id: 9,
    archived: false,
    recipe_ingredients: [
      { item_id: 1, quantity: 2 },
      { item_id: 2, quantity: 4 },
    ],
  }

  it('une la receta con el coste y el stock del inventario y ordena los ingredientes por nombre', () => {
    const data = toRecipeData(row, items)
    expect(data).toMatchObject({ id: 7, name: 'Cargador 9 mm', salePrice: 1800, outputQty: 5, outputItemId: 9 })
    expect(data.ingredients.map((i) => i.name)).toEqual(['Acero', 'Pólvora'])
    expect(data.ingredients[1]).toEqual({ itemId: 1, name: 'Pólvora', quantity: 2, unitCost: 310, stock: 50, imagePath: null })
  })

  it('omite ingredientes cuyo item no se conoce', () => {
    const data = toRecipeData({ ...row, recipe_ingredients: [{ item_id: 99, quantity: 1 }, { item_id: 1, quantity: 2 }] }, items)
    expect(data.ingredients.map((i) => i.itemId)).toEqual([1])
  })
})
