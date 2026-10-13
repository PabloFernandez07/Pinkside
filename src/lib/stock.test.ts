import { describe, expect, it } from 'vitest'
import {
  inventoryValue,
  isLowStock,
  matchesSearch,
  stockLevelPercent,
  stockState,
  toInventoryItem,
  type InventoryItem,
} from '@/lib/stock'

const item = (override: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 1,
  name: 'Acero',
  category: 'Materiales',
  minStock: 40,
  unitCost: 120,
  archived: false,
  stock: 84,
  imagePath: null,
  ...override,
})

describe('toInventoryItem', () => {
  const row = {
    id: 3,
    name: 'Pólvora',
    category: null,
    min_stock: 30,
    unit_cost: 310,
    archived: false,
    stock: 12,
    image_path: '3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp',
    created_at: '2026-10-13T10:00:00Z',
  }

  it('convierte una fila completa', () => {
    expect(toInventoryItem(row)).toEqual({
      id: 3,
      name: 'Pólvora',
      category: null,
      minStock: 30,
      unitCost: 310,
      archived: false,
      stock: 12,
      imagePath: '3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp',
    })
  })

  it('descarta filas sin id o sin nombre', () => {
    expect(toInventoryItem({ ...row, id: null })).toBeNull()
    expect(toInventoryItem({ ...row, name: null })).toBeNull()
  })

  it('rellena con ceros lo que llegue nulo', () => {
    const result = toInventoryItem({ ...row, min_stock: null, unit_cost: null, stock: null, archived: null })
    expect(result).toMatchObject({ minStock: 0, unitCost: 0, stock: 0, archived: false })
  })
})

describe('stockState / isLowStock', () => {
  it.each([
    [84, 40, 'ok'],
    [40, 40, 'ok'], // justo en el mínimo no es alerta
    [39, 40, 'low'],
    [1, 40, 'low'],
    [0, 40, 'empty'],
    [0, 0, 'ok'], // sin mínimo configurado no hay alerta aunque esté agotado
    [5, 0, 'ok'],
  ] as const)('stock %d con mínimo %d → %s', (stock, min, expected) => {
    expect(stockState(stock, min)).toBe(expected)
    expect(isLowStock(stock, min)).toBe(expected !== 'ok')
  })
})

describe('stockLevelPercent', () => {
  it.each([
    [0, 40, 0],
    [20, 40, 25],
    [40, 40, 50], // el mínimo es el 50 %
    [80, 40, 100],
    [500, 40, 100], // nunca pasa del 100 %
    [10, 0, 100], // sin mínimo: lleno si hay algo
    [0, 0, 0],
    [-5, 40, 0],
  ])('stock %d con mínimo %d → %d %%', (stock, min, expected) => {
    expect(stockLevelPercent(stock, min)).toBe(expected)
  })
})

describe('inventoryValue', () => {
  it('suma stock × coste de los items activos', () => {
    expect(inventoryValue([item(), item({ id: 2, stock: 10, unitCost: 310 })])).toBe(84 * 120 + 10 * 310)
  })

  it('ignora los archivados y la lista vacía', () => {
    expect(inventoryValue([item({ archived: true })])).toBe(0)
    expect(inventoryValue([])).toBe(0)
  })
})

describe('matchesSearch', () => {
  it('sin texto coincide todo', () => {
    expect(matchesSearch(item(), '')).toBe(true)
    expect(matchesSearch(item(), '   ')).toBe(true)
  })

  it('no distingue mayúsculas ni tildes', () => {
    expect(matchesSearch(item({ name: 'Pólvora' }), 'polvora')).toBe(true)
    expect(matchesSearch(item({ name: 'Pólvora' }), 'PÓLV')).toBe(true)
    expect(matchesSearch(item({ name: 'Munición 9 mm' }), 'municion')).toBe(true)
  })

  it('busca también en la categoría', () => {
    expect(matchesSearch(item({ category: 'Materiales' }), 'materi')).toBe(true)
    expect(matchesSearch(item({ category: null }), 'materi')).toBe(false)
  })

  it('no coincide si no aparece', () => {
    expect(matchesSearch(item(), 'plástico')).toBe(false)
  })

  it('trata los caracteres especiales como texto normal', () => {
    expect(matchesSearch(item({ name: '100%' }), '%')).toBe(true)
    expect(matchesSearch(item(), '%')).toBe(false)
    expect(matchesSearch(item(), '.*')).toBe(false)
  })
})
