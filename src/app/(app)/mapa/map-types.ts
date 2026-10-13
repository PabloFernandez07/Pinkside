import type { Point } from '@/lib/map'

export interface MarkerData {
  id: number
  x: number
  y: number
  emoji: string
  title: string
  note: string | null
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

export type Selection = { type: 'marker'; id: number } | { type: 'area'; id: number } | null

/** Icono que se está creando (id nulo) o editando. */
export interface MarkerDraft {
  id: number | null
  x: number
  y: number
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
  initialMarkers: MarkerData[]
  initialAreas: AreaData[]
  canEdit: boolean
  /** Nombre de quien mira el mapa, para firmar lo que cree. */
  currentName: string
}
