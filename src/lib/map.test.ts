import { describe, expect, it } from 'vitest'
import {
  EMOJI_PRESETS,
  MAP_COLORS,
  WORLD,
  clamp01,
  fromLatLng,
  isMapColor,
  isSingleEmoji,
  parsePoints,
  polygonCenter,
  tileUrl,
  toLatLng,
} from '@/lib/map'

describe('conversión de coordenadas', () => {
  it('el origen (arriba a la izquierda) es lat 0, lng 0 y la esquina opuesta ocupa todo el mundo', () => {
    expect(toLatLng(0, 0)).toEqual([-0, 0])
    expect(toLatLng(1, 1)).toEqual([-WORLD, WORLD])
    expect(toLatLng(0.5, 0.25)).toEqual([-64, 128])
  })

  it('ida y vuelta sin pérdida', () => {
    for (const [x, y] of [[0, 0], [1, 1], [0.123, 0.987], [0.5, 0.5]] as const) {
      const [lat, lng] = toLatLng(x, y)
      const back = fromLatLng(lat, lng)
      expect(back.x).toBeCloseTo(x, 10)
      expect(back.y).toBeCloseTo(y, 10)
    }
  })

  it('fromLatLng nunca sale de 0..1 aunque se pinche fuera del mapa', () => {
    expect(fromLatLng(50, -20)).toEqual({ x: 0, y: 0 })
    expect(fromLatLng(-999, 999)).toEqual({ x: 1, y: 1 })
  })

  it.each([
    [0.5, 0.5],
    [-1, 0],
    [2, 1],
    [NaN, 0],
    [Infinity, 0],
  ])('clamp01(%d) = %d', (value, expected) => expect(clamp01(value)).toBe(expected))
})

describe('tileUrl', () => {
  it('apunta a las teselas del propio proyecto', () => {
    expect(tileUrl('satelite')).toBe('/mapa/satelite/{z}/{x}-{y}.webp')
    expect(tileUrl('atlas')).toBe('/mapa/atlas/{z}/{x}-{y}.webp')
  })
})

describe('isSingleEmoji', () => {
  it.each(['📍', '🔫', '⚠️', '🧑‍🚀', '👍🏽', '🇪🇸', '⭐'])('acepta %s', (value) => expect(isSingleEmoji(value)).toBe(true))

  it.each(['', '  ', 'a', 'A', '1', '#', 'hola', '📍📍', '📍a', 'ab🔫', '<b>', 'x'.repeat(30)])(
    'rechaza %j',
    (value) => expect(isSingleEmoji(value)).toBe(false),
  )

  it('todos los emojis de ejemplo son válidos', () => {
    for (const emoji of EMOJI_PRESETS) expect(isSingleEmoji(emoji)).toBe(true)
  })

  it('ignora espacios alrededor', () => {
    expect(isSingleEmoji(' 📍 ')).toBe(true)
  })
})

describe('colores', () => {
  it('toda la paleta cumple el formato que exige la base de datos', () => {
    for (const color of MAP_COLORS) expect(isMapColor(color)).toBe(true)
  })

  it.each(['#FF3D8B', '#fff', 'rojo', '', '#ff3d8bzz'])('rechaza %j', (value) => expect(isMapColor(value)).toBe(false))
})

describe('polygonCenter', () => {
  it('es la media de los vértices', () => {
    expect(polygonCenter([[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([0.5, 0.5])
    expect(polygonCenter([[0.2, 0.2], [0.4, 0.2], [0.3, 0.5]])[0]).toBeCloseTo(0.3)
  })

  it('sin vértices cae en el centro del mapa', () => {
    expect(polygonCenter([])).toEqual([0.5, 0.5])
  })
})

describe('parsePoints', () => {
  it('lee pares válidos', () => {
    expect(parsePoints([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]])).toEqual([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]])
  })

  it('descarta basura y valores fuera de rango', () => {
    expect(parsePoints([[0.1, 0.2], [2, 0.1], ['a', 0.1], [0.1], null, [0.1, 0.2, 0.3], [0.9, 0.9]])).toEqual([
      [0.1, 0.2],
      [0.9, 0.9],
    ])
  })

  it.each([null, undefined, 'x', 5, {}])('con %j no hay vértices', (value) => expect(parsePoints(value)).toEqual([]))
})
