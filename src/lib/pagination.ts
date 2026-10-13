/** Filas por página en todas las listas (entre 10 y 15 para que cada pantalla cargue ligera). */
export const PAGE_SIZE = 12

/** Número de página pedido en la URL; cualquier valor raro vale 1. */
export function parsePage(raw: string | undefined): number {
  const page = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export interface Paged<T> {
  rows: T[]
  page: number
  lastPage: number
  total: number
}

/** Recorta una lista ya filtrada a la página pedida (la última si se pide una que no existe). */
export function paginate<T>(rows: readonly T[], requested: number, size = PAGE_SIZE): Paged<T> {
  const lastPage = Math.max(1, Math.ceil(rows.length / size))
  const page = Math.min(requested, lastPage)
  return { rows: rows.slice((page - 1) * size, page * size), page, lastPage, total: rows.length }
}

/** Enlace a una página conservando el resto de parámetros de la URL; la página 1 no lleva parámetro. */
export function pageHref(
  path: string,
  params: Record<string, string | undefined>,
  page: number,
  key = 'pagina',
): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value && name !== key) search.set(name, value)
  }
  if (page > 1) search.set(key, String(page))
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
