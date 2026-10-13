import type { Point } from '@/lib/map'

/** Un icono se define una vez (emoji, título y nota) y sale en la leyenda; sus marcas en el mapa son tantas como se quiera. */
export interface IconData {
  id: number
  emoji: string
  title: string
  note: string | null
  authorName: string
}

/** Una marca: dónde está un icono en el mapa. */
export interface MarkerData {
  id: number
  iconId: number
  x: number
  y: number
  authorName: string
}

export interface AreaData {
  id: number
  name: string
  note: string | null
  color: string
  points: Point[]
  authorName: string
}

export type Selection =
  | { type: 'icon'; id: number }
  | { type: 'marker'; id: number }
  | { type: 'area'; id: number }
  | null

/** Icono que se está creando (id nulo) o editando (afecta a todas sus marcas). */
export interface IconDraft {
  id: number | null
  emoji: string
  title: string
  note: string
}

/** Zona que se está creando (con sus puntos recién marcados) o editando (sin tocar su forma). */
export interface AreaDraft {
  id: number | null
  points: Point[]
  name: string
  note: string
  color: string
}

export interface MapViewProps {
  initialIcons: IconData[]
  initialMarkers: MarkerData[]
  initialAreas: AreaData[]
  canEdit: boolean
  /** Nombre de quien mira el mapa, para firmar lo que cree. */
  currentName: string
}
