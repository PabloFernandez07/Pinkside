/** Secciones del menú que se pueden desactivar desde Administración. */
export const SECTION_IDS = ['inventario', 'recetas'] as const
export type SectionId = (typeof SECTION_IDS)[number]

export const SECTION_LABEL: Record<SectionId, string> = { inventario: 'Inventario', recetas: 'Recetas' }

export const isSection = (value: unknown): value is SectionId =>
  typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value)

/** Convierte lo que devuelve la base de datos en un conjunto de secciones conocidas (ignora basura). */
export function parseDisabledSections(value: unknown): ReadonlySet<SectionId> {
  return new Set(Array.isArray(value) ? value.filter(isSection) : [])
}
