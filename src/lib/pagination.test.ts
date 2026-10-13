import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, pageHref, paginate, parsePage } from './pagination'

describe('parsePage', () => {
  it('devuelve 1 si falta, no es número o no es positivo', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-3')).toBe(1)
  })

  it('respeta una página válida', () => {
    expect(parsePage('4')).toBe(4)
  })
})

describe('paginate', () => {
  const rows = Array.from({ length: PAGE_SIZE * 2 + 1 }, (_, i) => i)

  it('corta la página pedida', () => {
    const result = paginate(rows, 2)
    expect(result.rows).toEqual(rows.slice(PAGE_SIZE, PAGE_SIZE * 2))
    expect(result).toMatchObject({ page: 2, lastPage: 3, total: rows.length })
  })

  it('lleva a la última página si se pide una que no existe', () => {
    const result = paginate(rows, 99)
    expect(result.page).toBe(3)
    expect(result.rows).toEqual([PAGE_SIZE * 2])
  })

  it('una lista vacía tiene una sola página', () => {
    expect(paginate([], 1)).toEqual({ rows: [], page: 1, lastPage: 1, total: 0 })
  })
})

describe('pageHref', () => {
  it('conserva los demás parámetros y omite los vacíos', () => {
    expect(pageHref('/inventario', { q: 'kit', bajo: '1', archivados: undefined }, 3)).toBe(
      '/inventario?q=kit&bajo=1&pagina=3',
    )
  })

  it('la página 1 no lleva parámetro y sustituye al anterior', () => {
    expect(pageHref('/caja', { pagina: '5' }, 1)).toBe('/caja')
  })

  it('admite otro nombre de parámetro', () => {
    expect(pageHref('/miembros', { q: 'a' }, 2, 'accesos')).toBe('/miembros?q=a&accesos=2')
  })
})
