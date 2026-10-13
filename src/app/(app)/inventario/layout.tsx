import type { ReactNode } from 'react'
import { requireSection } from '@/lib/access'

/** Si Inventario está desactivado en Administración, ninguna de sus páginas se puede abrir (ni por enlace directo). */
export default async function InventarioLayout({ children }: { children: ReactNode }) {
  await requireSection('inventario')
  return children
}
