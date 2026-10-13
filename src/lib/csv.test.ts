import { describe, expect, it } from 'vitest'
import { MAX_IMPORT_ROWS, parseItemsCsv } from '@/lib/csv'

describe('parseItemsCsv', () => {
  it('lee filas separadas por punto y coma', () => {
    const result = parseItemsCsv('Acero;Materiales;40;120\nPólvora;Materiales;30;310')
    expect(result.issues).toEqual([])
    expect(result.rows).toEqual([
      { name: 'Acero', category: 'Materiales', minStock: 40, unitCost: 120 },
      { name: 'Pólvora', category: 'Materiales', minStock: 30, unitCost: 310 },
    ])
  })

  it('lee texto pegado desde Excel (tabuladores)', () => {
    const result = parseItemsCsv('Acero\tMateriales\t40\t120\r\nPlástico\t\t20\t60')
    expect(result.issues).toEqual([])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[1]).toEqual({ name: 'Plástico', category: null, minStock: 20, unitCost: 60 })
  })

  it('admite comas como separador', () => {
    const result = parseItemsCsv('Acero,Materiales,40,120')
    expect(result.rows).toEqual([{ name: 'Acero', category: 'Materiales', minStock: 40, unitCost: 120 }])
  })

  it('salta la fila de títulos aunque lleve tildes o mayúsculas', () => {
    for (const header of ['nombre;categoría;mínimo;coste', 'Nombre;Categoria;Minimo;Coste', 'ITEM;cat;min;coste']) {
      const result = parseItemsCsv(`${header}\nAcero;Materiales;40;120`)
      expect(result.issues).toEqual([])
      expect(result.rows).toHaveLength(1)
    }
  })

  it('las columnas de categoría, mínimo y coste son opcionales', () => {
    const result = parseItemsCsv('Acero\nPólvora;Materiales')
    expect(result.rows).toEqual([
      { name: 'Acero', category: null, minStock: 0, unitCost: 0 },
      { name: 'Pólvora', category: 'Materiales', minStock: 0, unitCost: 0 },
    ])
  })

  it('respeta las comillas: el separador dentro de comillas es texto', () => {
    const result = parseItemsCsv('"Cable; grueso";Eléctrico;5;"1.500"')
    expect(result.rows).toEqual([{ name: 'Cable; grueso', category: 'Eléctrico', minStock: 5, unitCost: 1500 }])
  })

  it('entiende las comillas dobles escapadas', () => {
    const result = parseItemsCsv('"Tubo 2"" PVC";Fontanería;1;10')
    expect(result.rows[0].name).toBe('Tubo 2" PVC')
  })

  it('acepta costes con puntos de millar', () => {
    expect(parseItemsCsv('Lingote;Metales;1;1.500.000').rows[0].unitCost).toBe(1_500_000)
  })

  it('ignora líneas en blanco, BOM y saltos de línea de Windows', () => {
    const result = parseItemsCsv('﻿Acero;Materiales;40;120\r\n\r\n   \r\nPlástico;Materiales;20;60\r\n')
    expect(result.rows).toHaveLength(2)
  })

  it('numera los problemas según la línea del texto pegado (con títulos y blancos)', () => {
    const result = parseItemsCsv('nombre;categoría;mínimo;coste\n\nAcero;Materiales;mucho;120')
    expect(result.rows).toEqual([])
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].line).toBe(3)
    expect(result.issues[0].message).toContain('mínimo')
  })

  it.each([
    ['nombre demasiado corto', 'A;Materiales;1;1', 'nombre'],
    ['nombre demasiado largo', `${'x'.repeat(61)};Materiales;1;1`, 'nombre'],
    ['categoría demasiado corta', 'Acero;M;1;1', 'categoría'],
    ['mínimo con decimales', 'Acero;Materiales;1.5;1', 'mínimo'],
    ['mínimo negativo', 'Acero;Materiales;-1;1', 'mínimo'],
    ['mínimo enorme', 'Acero;Materiales;1000001;1', 'mínimo'],
    ['coste con decimales', 'Acero;Materiales;1;12,50', 'coste'],
    ['coste con letras', 'Acero;Materiales;1;caro', 'coste'],
    ['coste sobre el máximo', 'Acero;Materiales;1;1.000.000.001', 'coste'],
  ])('rechaza %s', (_caso, input, palabra) => {
    const result = parseItemsCsv(input)
    expect(result.rows).toEqual([])
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].message).toContain(palabra)
  })

  it('todo o nada: una fila mala invalida el resto', () => {
    const result = parseItemsCsv('Acero;Materiales;40;120\nMalo;Materiales;x;1\nPlástico;Materiales;20;60')
    expect(result.rows).toEqual([])
    expect(result.issues.map((issue) => issue.line)).toEqual([2])
  })

  it('avisa de todos los problemas, no solo del primero', () => {
    const result = parseItemsCsv('A;;1;1\nAcero;;x;1\nPlástico;;1;caro')
    expect(result.issues.map((issue) => issue.line)).toEqual([1, 2, 3])
  })

  it('detecta nombres repetidos sin distinguir mayúsculas ni tildes', () => {
    const result = parseItemsCsv('Pólvora;Materiales;30;310\nPOLVORA;Materiales;1;1')
    expect(result.rows).toEqual([])
    expect(result.issues[0].line).toBe(2)
    expect(result.issues[0].message).toContain('línea 1')
  })

  it('un texto vacío o solo con títulos no importa nada', () => {
    expect(parseItemsCsv('').issues[0].line).toBe(0)
    expect(parseItemsCsv('  \n\n').issues[0].line).toBe(0)
    expect(parseItemsCsv('nombre;categoría;mínimo;coste').issues[0].message).toContain('títulos')
  })

  it('limita el número de filas', () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Item ${i};Cat;1;1`).join('\n')
    expect(parseItemsCsv(many).issues[0].message).toContain(String(MAX_IMPORT_ROWS))
    const exact = Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => `Item ${i};Cat;1;1`).join('\n')
    expect(parseItemsCsv(exact).rows).toHaveLength(MAX_IMPORT_ROWS)
  })

  it('no ejecuta ni interpreta contenido peligroso: lo trata como texto', () => {
    const result = parseItemsCsv('=HYPERLINK("http://evil");Cat;1;1\n<script>alert(1)</script>;Cat;1;1')
    expect(result.issues).toEqual([])
    expect(result.rows[1].name).toBe('<script>alert(1)</script>')
  })
})
