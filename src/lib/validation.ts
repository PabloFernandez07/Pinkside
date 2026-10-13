import * as z from 'zod'
import { ACCENT_IDS, THEME_IDS } from '@/lib/accents'
import { MAX_AMOUNT, parseMoney } from '@/lib/money'
import { MAX_QUANTITY } from '@/lib/stock'

export type FormState =
  | {
      ok?: boolean
      message?: string
      errors?: Record<string, string[] | undefined>
    }
  | undefined

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} es obligatorio` })
    .trim()
    .min(1, { error: `${label} es obligatorio` })
    .max(max, { error: `${label}: máximo ${max} caracteres` })

const phone = z
  .string({ error: 'El teléfono es obligatorio' })
  .trim()
  .regex(/^[0-9][0-9 -]{1,18}[0-9]$/, {
    error: 'Teléfono no válido: solo números, espacios o guiones (3-20 caracteres)',
  })

export const profileFieldsSchema = z.object({
  firstName: requiredText('El nombre', 40),
  lastName: requiredText('Los apellidos', 60),
  phone,
})

export const onboardingSchema = profileFieldsSchema.extend({
  // Solo dígitos: z.coerce.number() aceptaría «1e3» o «0x10».
  stateId: z
    .string({ error: 'El StateID debe ser un número' })
    .trim()
    .regex(/^\d+$/, { error: 'El StateID debe ser un número' })
    .transform(Number)
    .pipe(
      z
        .number()
        .positive({ error: 'El StateID debe ser mayor que 0' })
        .max(2_000_000_000, { error: 'El StateID es demasiado grande' }),
    ),
})

export const preferencesSchema = z.object({
  theme: z.enum(THEME_IDS, { error: 'Tema no válido' }),
  accent: z.enum(ACCENT_IDS, { error: 'Color no válido' }),
})

export const approveMemberSchema = z.object({
  memberId: z.uuid(),
  rankId: z.coerce.number().int().positive(),
})

export const blockMemberSchema = z.object({
  memberId: z.uuid(),
  blocked: z.enum(['true', 'false']).transform((value) => value === 'true'),
})

const rankName = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, { error: 'El nombre necesita al menos 2 caracteres' })
  .max(30, { error: 'El nombre admite como máximo 30 caracteres' })

const rankId = z.coerce.number({ error: 'Rango no válido' }).int().positive()

export const createRankSchema = z.object({
  name: rankName,
  level: z.coerce
    .number({ error: 'El nivel debe ser un número' })
    .int({ error: 'El nivel debe ser un número entero' })
    .min(1, { error: 'El nivel mínimo es 1' })
    .max(99, { error: 'El nivel máximo es 99 (el 100 es del Líder)' }),
})

// En la edición el nivel llega hasta 100 porque el formulario del Líder envía su propio nivel.
export const updateRankSchema = z.object({
  rankId,
  name: rankName,
  level: z.coerce
    .number({ error: 'El nivel debe ser un número' })
    .int({ error: 'El nivel debe ser un número entero' })
    .min(1, { error: 'El nivel mínimo es 1' })
    .max(100, { error: 'El nivel máximo es 100' }),
})

export const deleteRankSchema = z.object({ rankId })

export const rankPermissionSchema = z.object({
  rankId: z.number().int().positive(),
  permission: z.string().regex(/^[a-z]+\.[a-z]+$/).max(40),
  allowed: z.boolean(),
})

/** Importe escrito a mano (`1.500`, `1500`…) convertido a entero entre `min` y MAX_AMOUNT. */
const moneyString = (min: number, requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .transform((value, ctx) => {
      const parsed = parseMoney(value)
      if (parsed === null) {
        ctx.issues.push({
          code: 'custom',
          message: 'Importe no válido: solo números enteros (puedes usar puntos de millar)',
          input: value,
        })
        return z.NEVER
      }
      return parsed
    })
    .pipe(
      z
        .number()
        .min(min, { error: min > 0 ? 'El importe debe ser mayor que 0' : 'El importe no puede ser negativo' })
        .max(MAX_AMOUNT, { error: 'El importe máximo es $1.000.000.000' }),
    )

const amountField = moneyString(1, 'El importe es obligatorio')

/** Vacío o ausente cuenta como el valor por defecto (los campos opcionales de un formulario). */
const blankTo = (fallback: string) => (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') ? fallback : value

const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? '' : value),
    z
      .string()
      .trim()
      .max(max, { error: `${label} admite como máximo ${max} caracteres` })
      .transform((value) => (value === '' ? null : value))
      .pipe(z.string().min(2, { error: `${label} necesita al menos 2 caracteres` }).nullable()),
  )

const movementReason = (max: number) =>
  z
    .string({ error: 'El motivo es obligatorio' })
    .trim()
    .min(2, { error: 'El motivo necesita al menos 2 caracteres' })
    .max(max, { error: `El motivo admite como máximo ${max} caracteres` })

export const cashMovementSchema = z.object({
  kind: z.enum(['in', 'out'], { error: 'Tipo de movimiento no válido' }),
  amount: amountField,
  reason: movementReason(160),
})

export const reverseMovementSchema = z.object({
  movementId: z.coerce.number({ error: 'Movimiento no válido' }).int().positive(),
  reason: movementReason(100),
})

const positiveId = (message: string) => z.coerce.number({ error: message }).int({ error: message }).positive({ error: message })

export const itemFieldsSchema = z.object({
  name: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(2, { error: 'El nombre necesita al menos 2 caracteres' })
    .max(60, { error: 'El nombre admite como máximo 60 caracteres' }),
  category: optionalText('La categoría', 40),
  minStock: z.preprocess(
    blankTo('0'),
    z.coerce
      .number({ error: 'El mínimo debe ser un número' })
      .int({ error: 'El mínimo debe ser un número entero' })
      .min(0, { error: 'El mínimo no puede ser negativo' })
      .max(MAX_QUANTITY, { error: `El mínimo máximo es ${MAX_QUANTITY}` }),
  ),
  unitCost: z.preprocess(blankTo('0'), moneyString(0, 'El coste es obligatorio')),
})

export const updateItemSchema = itemFieldsSchema.extend({ itemId: positiveId('Item no válido') })

export const archiveItemSchema = z.object({
  itemId: positiveId('Item no válido'),
  archived: z.enum(['true', 'false']).transform((value) => value === 'true'),
})

export const stockMovementSchema = z.object({
  itemId: positiveId('Item no válido'),
  kind: z.enum(['in', 'out'], { error: 'Tipo de movimiento no válido' }),
  quantity: z.coerce
    .number({ error: 'La cantidad debe ser un número' })
    .int({ error: 'La cantidad debe ser un número entero' })
    .min(1, { error: 'La cantidad debe ser mayor que 0' })
    .max(MAX_QUANTITY, { error: `La cantidad máxima es ${MAX_QUANTITY}` }),
  reason: movementReason(160),
})

export const reverseStockSchema = z.object({
  movementId: positiveId('Movimiento no válido'),
  reason: movementReason(100),
})

export const importItemsSchema = z.object({
  csv: z
    .string({ error: 'Pega la tabla de items' })
    .min(1, { error: 'Pega al menos una fila' })
    .max(200_000, { error: 'El texto es demasiado largo (máximo 200.000 caracteres)' }),
})

/** Vacío o ausente = sin valor (null); si hay algo, debe ser un id positivo. */
const optionalId = (message: string) =>
  z.preprocess(
    (value) => (value === null || value === undefined || value === '' ? null : value),
    z.union([z.null(), positiveId(message)]),
  )

/** Lista de ingredientes que llega como JSON en un campo oculto del formulario. */
const ingredientsField = z
  .string({ error: 'Añade al menos un ingrediente' })
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown
    } catch {
      ctx.issues.push({ code: 'custom', message: 'Los ingredientes no son válidos', input: value })
      return z.NEVER
    }
  })
  .pipe(
    z
      .array(
        z.object({
          itemId: z.number({ error: 'Elige un item en cada ingrediente' }).int().positive({ error: 'Elige un item en cada ingrediente' }),
          quantity: z
            .number({ error: 'La cantidad debe ser un número' })
            .int({ error: 'La cantidad debe ser un número entero' })
            .min(1, { error: 'La cantidad de cada ingrediente debe ser mayor que 0' })
            .max(MAX_QUANTITY, { error: `La cantidad máxima es ${MAX_QUANTITY}` }),
        }),
      )
      .min(1, { error: 'Añade al menos un ingrediente' })
      .max(30, { error: 'Máximo 30 ingredientes por receta' })
      .refine((list) => new Set(list.map((line) => line.itemId)).size === list.length, {
        error: 'Hay un ingrediente repetido',
      }),
  )

export const recipeSchema = z.object({
  recipeId: optionalId('Receta no válida'),
  name: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(2, { error: 'El nombre necesita al menos 2 caracteres' })
    .max(60, { error: 'El nombre admite como máximo 60 caracteres' }),
  notes: optionalText('Las notas', 300),
  salePrice: z.preprocess(blankTo('0'), moneyString(0, 'El precio es obligatorio')),
  outputQty: z.preprocess(
    blankTo('1'),
    z.coerce
      .number({ error: 'Las unidades por tanda deben ser un número' })
      .int({ error: 'Las unidades por tanda deben ser un número entero' })
      .min(1, { error: 'Cada tanda produce al menos 1 unidad' })
      .max(1000, { error: 'Máximo 1.000 unidades por tanda' }),
  ),
  outputItemId: optionalId('Item de salida no válido'),
  ingredients: ingredientsField,
})

export const craftSchema = z.object({
  recipeId: positiveId('Receta no válida'),
  batches: z.coerce
    .number({ error: 'Las tandas deben ser un número' })
    .int({ error: 'Las tandas deben ser un número entero' })
    .min(1, { error: 'Haz al menos 1 tanda' })
    .max(10_000, { error: 'Máximo 10.000 tandas de una vez' }),
})

export const recipeIdSchema = z.object({ recipeId: positiveId('Receta no válida') })

export const archiveRecipeSchema = z.object({
  recipeId: positiveId('Receta no válida'),
  archived: z.enum(['true', 'false']).transform((value) => value === 'true'),
})

export const itemPhotoIdSchema = z.object({ itemId: positiveId('Item no válido') })

export const urgentRequestSchema = z.object({
  title: z
    .string({ error: 'El título es obligatorio' })
    .trim()
    .min(3, { error: 'El título necesita al menos 3 caracteres' })
    .max(80, { error: 'El título admite como máximo 80 caracteres' }),
  body: z.preprocess(
    (value) => (value === null || value === undefined ? '' : value),
    z
      .string()
      .trim()
      .max(500, { error: 'El detalle admite como máximo 500 caracteres' })
      .transform((value) => (value === '' ? null : value)),
  ),
  priority: z.enum(['high', 'critical'], { error: 'Elige una prioridad' }),
  itemId: optionalId('Item no válido'),
  recipients: z
    .array(z.uuid({ error: 'Destinatario no válido' }), { error: 'Elige al menos un destinatario' })
    .min(1, { error: 'Elige al menos un destinatario' })
    .max(50, { error: 'Máximo 50 destinatarios' }),
})

export const closeUrgentSchema = z.object({
  requestId: positiveId('Pedido no válido'),
  status: z.enum(['covered', 'cancelled'], { error: 'Estado no válido' }),
})

export const fieldErrors = (error: z.ZodError): Record<string, string[] | undefined> =>
  z.flattenError(error).fieldErrors
