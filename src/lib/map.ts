/**
 * Mapa de GTA V con teselas. Las posiciones se guardan como proporción del mapa (x, y entre 0 y 1, con el origen
 * arriba a la izquierda), independientes del zoom. Leaflet usa CRS.Simple: con teselas de 256 px, a zoom 0 el mapa
 * entero ocupa una tesela, así que el mundo mide 256 unidades de lado (latitud negativa hacia abajo).
 */
export const WORLD = 256
export const MIN_ZOOM = 0
export const MAX_ZOOM = 5

export type TileStyle = 'satelite' | 'atlas'

export const TILE_STYLES: readonly { id: TileStyle; label: string }[] = [
  { id: 'satelite', label: 'Satélite' },
  { id: 'atlas', label: 'Atlas' },
]

/** Plantilla de Leaflet: las teselas viven en `public/mapa/<estilo>/<z>/<x>-<y>.webp`. */
export const tileUrl = (style: TileStyle): string => `/mapa/${style}/{z}/{x}-{y}.webp`

export type Point = readonly [number, number]

export const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/** (x, y) del mapa → [latitud, longitud] de Leaflet. */
export const toLatLng = (x: number, y: number): [number, number] => [-clamp01(y) * WORLD, clamp01(x) * WORLD]

/** [latitud, longitud] de Leaflet → (x, y) del mapa, siempre dentro de 0..1. */
export const fromLatLng = (lat: number, lng: number): { x: number; y: number } => ({
  x: clamp01(lng / WORLD),
  y: clamp01(-lat / WORLD),
})

/** Colores de las zonas (en minúsculas: la base de datos exige `#rrggbb`). */
export const MAP_COLORS = ['#ff3d8b', '#ff9f1a', '#ffd60a', '#34c759', '#00c7be', '#0a84ff', '#bf5af2', '#ffffff'] as const
export const DEFAULT_AREA_COLOR = MAP_COLORS[0]

export const isMapColor = (value: string): boolean => /^#[0-9a-f]{6}$/.test(value)

/** Emojis de ejemplo para elegir con un clic (también se puede escribir cualquier otro). */
export const EMOJI_PRESETS = ['📍', '🧑', '🔫', '💰', '🚗', '🏠', '⚠️', '🎯', '🔒', '💊', '📦', '🏪', '⭐', '❓', '🚁', '⚓'] as const
export const DEFAULT_EMOJI = EMOJI_PRESETS[0]

/** Exactamente un emoji (un solo «grafema» pictográfico): rechaza texto, números y varios emojis. */
export function isSingleEmoji(text: string): boolean {
  const value = text.trim()
  if (value === '' || value.length > 16) return false
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
  // Las banderas (🇪🇸) son pares de «indicadores regionales», que Unicode no marca como pictográficos.
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)
}

/** Centro de una zona (media de sus vértices): sirve para volar hasta ella y colocar su etiqueta. */
export function polygonCenter(points: readonly Point[]): Point {
  if (points.length === 0) return [0.5, 0.5]
  const sum = points.reduce<[number, number]>((total, [x, y]) => [total[0] + x, total[1] + y], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

/** Lee los vértices guardados (JSON) y descarta lo que no sea un par de números entre 0 y 1. */
export function parsePoints(value: unknown): Point[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): Point[] =>
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'number' &&
    typeof entry[1] === 'number' &&
    entry.every((n) => n >= 0 && n <= 1)
      ? [[entry[0], entry[1]]]
      : [],
  )
}
