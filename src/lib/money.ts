/** Importe máximo por movimiento (coincide con la restricción de la base de datos). */
export const MAX_AMOUNT = 1_000_000_000

const FORMATTER = new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 })

/** `$1.500`, o `−$1.500` si es negativo. Con `useGrouping: 'always'` también agrupa los de 4 cifras. */
export const formatMoney = (amount: number): string =>
  `${amount < 0 ? '−' : ''}$${FORMATTER.format(Math.abs(amount))}`

/** Igual que formatMoney pero siempre con signo: `+$1.500` o `−$1.500`. */
export const formatSignedMoney = (amount: number): string =>
  `${amount < 0 ? '−' : '+'}$${FORMATTER.format(Math.abs(amount))}`

/**
 * Lee un importe escrito a mano: `1500`, `1.500`, `1,500`, `1 500` o `$1.500` → 1500.
 * Devuelve null si tiene decimales, letras o separadores mal puestos (`1.5`, `12,50`, `1234.567`).
 */
export function parseMoney(input: string): number | null {
  const text = input.trim().replace(/^\$/, '')
  // Un único tipo de separador de millares y sin ceros a la izquierda en el primer grupo (`0,500` o `1,500.000` no valen).
  if (!/^[1-9]\d{0,2}(?:([.,  ])\d{3}(?:\1\d{3})*)$|^\d+$/.test(text)) return null
  const value = Number(text.replace(/[.,  ]/g, ''))
  return Number.isSafeInteger(value) ? value : null
}
