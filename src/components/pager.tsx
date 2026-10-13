import Link from 'next/link'
import { pageHref } from '@/lib/pagination'

interface PagerProps {
  /** Nombre accesible de la navegación, p. ej. «Paginación de movimientos». */
  label: string
  path: string
  /** Parámetros actuales de la URL: se conservan al cambiar de página. */
  params?: Record<string, string | undefined>
  page: number
  lastPage: number
  /** Nombre del parámetro de página (por defecto `pagina`). */
  paramName?: string
  previous?: string
  next?: string
}

export function Pager({
  label,
  path,
  params = {},
  page,
  lastPage,
  paramName,
  previous = '← Anteriores',
  next = 'Siguientes →',
}: PagerProps) {
  if (lastPage <= 1) return null
  return (
    <nav className="pager" aria-label={label}>
      {page > 1 ? <Link href={pageHref(path, params, page - 1, paramName)}>{previous}</Link> : <span />}
      <span className="muted small">
        Página {page} de {lastPage}
      </span>
      {page < lastPage ? <Link href={pageHref(path, params, page + 1, paramName)}>{next}</Link> : <span />}
    </nav>
  )
}
