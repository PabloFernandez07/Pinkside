import { MAX_AMOUNT, parseMoney } from '@/lib/money'
import { MAX_QUANTITY } from '@/lib/stock'

/** Máximo de filas por importación (coincide con la función de la base de datos). */
export const MAX_IMPORT_ROWS = 500

export interface ImportRow {
  name: string
  category: string | null
  minStock: number
  unitCost: number
}

export interface ImportIssue {
  /** Número de línea del texto pegado (1 = primera línea); 0 para problemas generales. */
  line: number
  message: string
}

export interface ImportResult {
  rows: ImportRow[]
  issues: ImportIssue[]
}

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Tabulador (pegado desde Excel/Sheets), punto y coma o coma; en ese orden de preferencia.
 * Se decide mirando TODO el texto: la primera línea puede ser solo un nombre sin separadores.
 */
function detectDelimiter(text: string): string {
  if (text.includes('\t')) return '\t'
  if (text.includes(';')) return ';'
  return ','
}

/** Divide una línea respetando las comillas ("a;b" cuenta como una sola celda; "" es una comilla). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

const HEADER_WORDS = new Set(['nombre', 'item', 'name', 'articulo', 'producto'])

function parseRow(cells: string[]): { row?: ImportRow; error?: string } {
  const [name = '', category = '', min = '', cost = ''] = cells
  if (name.length < 2 || name.length > 60) return { error: 'el nombre debe tener entre 2 y 60 caracteres' }
  if (category !== '' && (category.length < 2 || category.length > 40)) {
    return { error: 'la categoría debe tener entre 2 y 40 caracteres' }
  }
  if (min !== '' && !/^\d+$/.test(min)) return { error: `el mínimo «${min}» no es un número entero` }
  const minStock = min === '' ? 0 : Number(min)
  if (minStock > MAX_QUANTITY) return { error: `el mínimo no puede pasar de ${MAX_QUANTITY}` }
  let unitCost = 0
  if (cost !== '') {
    const parsed = parseMoney(cost)
    if (parsed === null) return { error: `el coste «${cost}» no es válido (solo enteros; usa ; o tabulador para separar)` }
    if (parsed > MAX_AMOUNT) return { error: `el coste no puede pasar de ${MAX_AMOUNT}` }
    unitCost = parsed
  }
  return { row: { name, category: category === '' ? null : category, minStock, unitCost } }
}

/**
 * Lee items pegados como texto: `nombre; categoría; mínimo; coste`, con o sin fila de títulos.
 * Si hay cualquier problema se devuelven todos los avisos y se importa nada (todo o nada).
 */
export function parseItemsCsv(text: string): ImportResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter(({ raw }) => raw.trim() !== '')

  if (lines.length === 0) return { rows: [], issues: [{ line: 0, message: 'No hay ninguna fila que importar' }] }

  const delimiter = detectDelimiter(lines.map(({ raw }) => raw).join('\n'))
  const parsed = lines.map(({ raw, line }) => ({ cells: splitLine(raw, delimiter), line }))
  const hasHeader = HEADER_WORDS.has(fold(parsed[0].cells[0] ?? ''))
  const body = hasHeader ? parsed.slice(1) : parsed

  if (body.length === 0) return { rows: [], issues: [{ line: 0, message: 'Solo hay títulos y ninguna fila' }] }
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], issues: [{ line: 0, message: `Máximo ${MAX_IMPORT_ROWS} filas por importación (hay ${body.length})` }] }
  }

  const rows: ImportRow[] = []
  const issues: ImportIssue[] = []
  const seen = new Map<string, number>()

  for (const { cells, line } of body) {
    const result = parseRow(cells)
    if (!result.row) {
      issues.push({ line, message: result.error ?? 'fila no válida' })
      continue
    }
    const key = fold(result.row.name)
    const first = seen.get(key)
    if (first !== undefined) {
      issues.push({ line, message: `«${result.row.name}» está repetido (ya aparece en la línea ${first})` })
      continue
    }
    seen.set(key, line)
    rows.push(result.row)
  }

  return issues.length > 0 ? { rows: [], issues } : { rows, issues }
}
