import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MARGINS,
  bucketByDays,
  buildBarChart,
  buildLineChart,
  compactMoney,
  niceScale,
  niceStep,
  shortDate,
} from '@/lib/charts'

describe('compactMoney', () => {
  it.each([
    [0, '$0'],
    [800, '$800'],
    [999, '$999'],
    [1000, '$1k'],
    [12_400, '$12k'],
    [120_000, '$120k'],
    [1_000_000, '$1 M'],
    [1_500_000, '$1,5 M'],
    [12_000_000, '$12 M'],
    [-800, '−$800'],
    [-60_000, '−$60k'],
    [-2_500_000, '−$2,5 M'],
  ])('%d → %s', (value, expected) => {
    expect(compactMoney(value)).toBe(expected)
  })
})

describe('niceStep', () => {
  it.each([
    [0.3, 0.5],
    [1, 1],
    [1.2, 2],
    [3, 5],
    [7, 10],
    [140, 200],
    [20_000, 20_000],
    [33_333, 50_000],
  ])('%d → %d', (value, expected) => {
    expect(niceStep(value)).toBe(expected)
  })

  it('valores no válidos devuelven 1', () => {
    for (const bad of [0, -5, NaN, Infinity]) expect(niceStep(bad)).toBe(1)
  })
})

describe('niceScale', () => {
  it('contiene siempre el rango y usa pasos redondos', () => {
    for (const [min, max] of [[0, 100], [3, 97], [-250, 800], [0, 1_234_567], [40_000, 207_150], [-5_000, -1_000]]) {
      const { lo, hi, step } = niceScale(min, max, 3, 1)
      expect(lo).toBeLessThanOrEqual(min)
      expect(hi).toBeGreaterThanOrEqual(max)
      expect(hi - lo).toBeCloseTo(step * 3)
      expect(lo % step).toBeCloseTo(0)
    }
  })

  it('si el rango cae a caballo entre dos marcas, sube al siguiente paso redondo', () => {
    // 95..205 con paso 50 empezaría en 50 y acabaría en 200 (<205): hace falta paso 100.
    const { lo, hi, step } = niceScale(95, 205, 3, 1)
    expect(step).toBe(100)
    expect(lo).toBe(0)
    expect(hi).toBe(300)
  })

  it('con datos planos no se queda en 0-0: aplica el paso mínimo', () => {
    const { lo, hi } = niceScale(0, 0, 3, 1000)
    expect(hi - lo).toBeGreaterThanOrEqual(3000)
  })

  it('valores negativos producen una escala que los incluye', () => {
    const { lo, hi } = niceScale(-60_000, 20_000, 3, 1000)
    expect(lo).toBeLessThanOrEqual(-60_000)
    expect(hi).toBeGreaterThanOrEqual(20_000)
  })
})

describe('buildLineChart', () => {
  const values = [40_000, 45_000, 52_000, 48_000, 207_150]
  const labels = ['29 sept', '01 oct', '03 oct', '05 oct', 'hoy']

  it('una serie vacía no dibuja nada', () => {
    const chart = buildLineChart([], [])
    expect(chart.path).toBe('')
    expect(chart.points).toEqual([])
    expect(chart.last).toBeNull()
  })

  it('genera un punto por valor, dentro del área del gráfico', () => {
    const chart = buildLineChart(values, labels)
    expect(chart.points).toHaveLength(values.length)
    for (const point of chart.points) {
      expect(point.x).toBeGreaterThanOrEqual(DEFAULT_MARGINS.left)
      expect(point.x).toBeLessThanOrEqual(100 - DEFAULT_MARGINS.right)
      expect(point.y).toBeGreaterThanOrEqual(DEFAULT_MARGINS.top)
      expect(point.y).toBeLessThanOrEqual(100 - DEFAULT_MARGINS.bottom)
    }
  })

  it('el valor mayor queda más arriba (y menor) y x crece de izquierda a derecha', () => {
    const { points } = buildLineChart(values, labels)
    expect(points[4].y).toBeLessThan(points[0].y)
    for (let i = 1; i < points.length; i++) expect(points[i].x).toBeGreaterThan(points[i - 1].x)
  })

  it('el trazo empieza con M y el área se cierra contra la base', () => {
    const chart = buildLineChart(values, labels)
    expect(chart.path.startsWith('M')).toBe(true)
    expect(chart.area.endsWith('Z')).toBe(true)
    expect(chart.area).toContain(`${100 - DEFAULT_MARGINS.bottom}`)
  })

  it('los ejes cubren los datos con 4 marcas (3 divisiones) etiquetadas', () => {
    const chart = buildLineChart(values, labels)
    expect(chart.ticks).toHaveLength(4)
    expect(chart.ticks[0].value).toBeLessThanOrEqual(40_000)
    expect(chart.ticks[3].value).toBeGreaterThanOrEqual(207_150)
    expect(chart.ticks.every((tick) => tick.label.startsWith('$') || tick.label.startsWith('−'))).toBe(true)
    expect(chart.ticks[0].y).toBeGreaterThan(chart.ticks[3].y)
  })

  it('etiquetas del eje X: primera, central y última', () => {
    const chart = buildLineChart(values, labels)
    expect(chart.xLabels.map((l) => l.text)).toEqual(['29 sept', '03 oct', 'hoy'])
    expect(chart.xLabels.map((l) => l.anchor)).toEqual(['start', 'middle', 'end'])
  })

  it('con dos valores solo hay etiqueta inicial y final', () => {
    expect(buildLineChart([1, 2], ['a', 'b']).xLabels.map((l) => l.text)).toEqual(['a', 'b'])
  })

  it('un único valor se centra y no divide por cero', () => {
    const chart = buildLineChart([5000], ['hoy'])
    expect(chart.points).toHaveLength(1)
    expect(Number.isFinite(chart.points[0].x)).toBe(true)
    expect(Number.isFinite(chart.points[0].y)).toBe(true)
  })

  it('una serie plana en cero no produce NaN', () => {
    const chart = buildLineChart(new Array(14).fill(0), new Array(14).fill('x'))
    expect(chart.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(chart.path).not.toContain('NaN')
  })

  it('soporta saldos negativos', () => {
    const chart = buildLineChart([-5000, -2000, 3000], ['a', 'b', 'c'])
    expect(chart.ticks[0].value).toBeLessThanOrEqual(-5000)
    expect(chart.path).not.toContain('NaN')
  })
})

describe('buildBarChart', () => {
  const groups = [
    { label: '29 sept', income: 0, expense: 0 },
    { label: '01 oct', income: 120_000, expense: 18_000 },
    { label: '03 oct', income: 30_000, expense: 60_000 },
  ]

  it('sin grupos no dibuja nada', () => {
    expect(buildBarChart([]).groups).toEqual([])
  })

  it('la altura es proporcional al valor y el cero no tiene altura', () => {
    const chart = buildBarChart(groups)
    expect(chart.groups[0].income.height).toBe(0)
    expect(chart.groups[0].expense.height).toBe(0)
    expect(chart.groups[1].income.height).toBeGreaterThan(chart.groups[1].expense.height)
    expect(chart.groups[2].expense.height).toBeGreaterThan(chart.groups[2].income.height)
  })

  it('las barras nacen en la base del gráfico', () => {
    const chart = buildBarChart(groups)
    const base = 100 - DEFAULT_MARGINS.bottom
    for (const group of chart.groups) {
      expect(group.income.y + group.income.height).toBeCloseTo(base, 1)
      expect(group.expense.y + group.expense.height).toBeCloseTo(base, 1)
    }
  })

  it('entradas a la izquierda y salidas a la derecha del centro del grupo', () => {
    const chart = buildBarChart(groups)
    for (const group of chart.groups) {
      expect(group.income.x).toBeLessThan(group.center)
      expect(group.expense.x).toBeGreaterThan(group.center - 0.5)
    }
  })

  it('el eje empieza en 0 y llega al máximo', () => {
    const chart = buildBarChart(groups)
    expect(chart.ticks[0].value).toBe(0)
    expect(chart.ticks[chart.ticks.length - 1].value).toBeGreaterThanOrEqual(120_000)
  })

  it('con todo a cero no hay NaN', () => {
    const chart = buildBarChart([{ label: 'a', income: 0, expense: 0 }])
    expect(JSON.stringify(chart)).not.toContain('NaN')
    expect(chart.groups[0].income.height).toBe(0)
  })

  it('ignora valores negativos (altura 0)', () => {
    const chart = buildBarChart([{ label: 'a', income: -50, expense: 100 }])
    expect(chart.groups[0].income.height).toBe(0)
  })
})

describe('bucketByDays', () => {
  const days = Array.from({ length: 14 }, (_, i) => ({
    day: `2026-10-${String(i + 1).padStart(2, '0')}`,
    income: 100,
    expense: 10,
  }))

  it('agrupa 14 días en 7 tramos de 2 sumando entradas y salidas', () => {
    const groups = bucketByDays(days, 2)
    expect(groups).toHaveLength(7)
    expect(groups[0]).toEqual({ label: '01 oct', income: 200, expense: 20 })
  })

  it('los días de hoy quedan completos: el primer tramo es el que puede ser más corto', () => {
    const groups = bucketByDays(days.slice(0, 13), 2)
    expect(groups).toHaveLength(7)
    expect(groups[0]).toEqual({ label: '01 oct', income: 100, expense: 10 })
    expect(groups[6].income).toBe(200)
  })

  it('tamaño inválido o lista vacía devuelven vacío', () => {
    expect(bucketByDays(days, 0)).toEqual([])
    expect(bucketByDays([], 2)).toEqual([])
  })
})

describe('shortDate', () => {
  it.each([
    ['2026-10-13', '13 oct'],
    ['2026-01-05', '05 ene'],
    ['2026-12-31', '31 dic'],
  ])('%s → %s', (day, expected) => {
    expect(shortDate(day)).toBe(expected)
  })

  it('no depende de la zona horaria del proceso', () => {
    const before = process.env.TZ
    try {
      process.env.TZ = 'Pacific/Auckland'
      expect(shortDate('2026-10-13')).toBe('13 oct')
      process.env.TZ = 'America/Los_Angeles'
      expect(shortDate('2026-10-13')).toBe('13 oct')
    } finally {
      if (before === undefined) delete process.env.TZ
      else process.env.TZ = before
    }
  })
})
