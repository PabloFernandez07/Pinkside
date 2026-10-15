import { describe, expect, it } from 'vitest'
import {
  approveMemberSchema,
  archiveItemSchema,
  archiveRecipeSchema,
  craftSchema,
  recipeIdSchema,
  recipeSchema,
  blockMemberSchema,
  cashBalanceSchema,
  importItemsSchema,
  itemFieldsSchema,
  reverseStockSchema,
  stockMovementSchema,
  updateItemSchema,
  createRankSchema,
  reverseMovementSchema,
  deleteRankSchema,
  onboardingSchema,
  preferencesSchema,
  profileFieldsSchema,
  rankPermissionSchema,
  updateRankSchema,
  closeUrgentSchema,
  urgentRequestSchema,
  addAllowedIdSchema,
  removeAllowedIdSchema,
  saveIconSchema,
  saveMarkerSchema,
  saveAreaSchema,
  deleteMapItemSchema,
} from '@/lib/validation'

const valid = { stateId: '48213', firstName: 'Carlos', lastName: 'Vega Ruiz', phone: '555-0142' }

describe('onboardingSchema', () => {
  it('acepta una ficha válida y convierte el StateID a número', () => {
    const result = onboardingSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.stateId).toBe(48213)
  })

  it('recorta espacios en nombre y apellidos', () => {
    const result = onboardingSchema.safeParse({ ...valid, firstName: '  Carlos  ', lastName: ' Vega ' })
    expect(result.success && result.data.firstName).toBe('Carlos')
    expect(result.success && result.data.lastName).toBe('Vega')
  })

  it.each(['', '0', '-5', 'abc', '12.5', '3000000000'])('rechaza el StateID %j', (stateId) => {
    expect(onboardingSchema.safeParse({ ...valid, stateId }).success).toBe(false)
  })

  it('rechaza un StateID ausente (null de FormData)', () => {
    expect(onboardingSchema.safeParse({ ...valid, stateId: null }).success).toBe(false)
  })

  it.each(['', '   '])('rechaza nombre vacío %j', (firstName) => {
    expect(onboardingSchema.safeParse({ ...valid, firstName }).success).toBe(false)
  })

  it('rechaza nombres demasiado largos', () => {
    expect(onboardingSchema.safeParse({ ...valid, firstName: 'a'.repeat(41) }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, lastName: 'a'.repeat(61) }).success).toBe(false)
  })

  it.each(['555-0142', '555 0142', '0123456'])('acepta el teléfono %j', (phone) => {
    expect(onboardingSchema.safeParse({ ...valid, phone }).success).toBe(true)
  })

  it.each(['', '12', 'abc-1234', '555_0142', '<script>', '1'.repeat(21)])('rechaza el teléfono %j', (phone) => {
    expect(onboardingSchema.safeParse({ ...valid, phone }).success).toBe(false)
  })

  it.each(['1e3', '0x10', '1.5', '-4', ' ', ''])('rechaza el StateID %j', (stateId) => {
    expect(onboardingSchema.safeParse({ ...valid, stateId }).success).toBe(false)
  })

  it('devuelve mensajes en español por campo', () => {
    const result = onboardingSchema.safeParse({ ...valid, stateId: 'x', firstName: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message)
      expect(messages).toContain('El StateID debe ser un número')
      expect(messages).toContain('El nombre es obligatorio')
    }
  })
})

describe('profileFieldsSchema', () => {
  it('no exige StateID', () => {
    expect(profileFieldsSchema.safeParse({ firstName: 'A', lastName: 'B', phone: '555-0142' }).success).toBe(true)
  })
})

describe('preferencesSchema', () => {
  it('acepta temas y acentos del catálogo', () => {
    expect(preferencesSchema.safeParse({ theme: 'dark', accent: 'pink' }).success).toBe(true)
  })

  it.each([
    { theme: 'neon', accent: 'pink' },
    { theme: 'dark', accent: 'red' },
    { theme: null, accent: null },
  ])('rechaza %j', (input) => {
    expect(preferencesSchema.safeParse(input).success).toBe(false)
  })
})

describe('esquemas de rangos', () => {
  it('createRankSchema acepta nombre y nivel 1-99 y recorta espacios', () => {
    const result = createRankSchema.safeParse({ name: '  Capo  ', level: '90' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ name: 'Capo', level: 90 })
  })

  it.each(['0', '100', '-3', 'x', '', '5.5'])('createRankSchema rechaza el nivel %j', (level) => {
    expect(createRankSchema.safeParse({ name: 'Capo', level }).success).toBe(false)
  })

  it.each(['', ' ', 'a', 'x'.repeat(31)])('createRankSchema rechaza el nombre %j', (name) => {
    expect(createRankSchema.safeParse({ name, level: '50' }).success).toBe(false)
  })

  it('createRankSchema explica por qué no admite el 100', () => {
    const result = createRankSchema.safeParse({ name: 'Jefe', level: '100' })
    expect(!result.success && result.error.issues[0].message).toContain('100')
  })

  it('updateRankSchema admite el nivel 100 (el formulario del Líder lo envía)', () => {
    expect(updateRankSchema.safeParse({ rankId: '1', name: 'Líder', level: '100' }).success).toBe(true)
    expect(updateRankSchema.safeParse({ rankId: '1', name: 'Líder', level: '101' }).success).toBe(false)
    expect(updateRankSchema.safeParse({ rankId: '0', name: 'Líder', level: '100' }).success).toBe(false)
  })

  it('deleteRankSchema exige un id positivo', () => {
    expect(deleteRankSchema.safeParse({ rankId: '3' }).success).toBe(true)
    expect(deleteRankSchema.safeParse({ rankId: '-1' }).success).toBe(false)
    expect(deleteRankSchema.safeParse({ rankId: null }).success).toBe(false)
  })

  it('rankPermissionSchema valida la forma del permiso y los tipos', () => {
    expect(rankPermissionSchema.safeParse({ rankId: 2, permission: 'cash.view', allowed: true }).success).toBe(true)
    expect(rankPermissionSchema.safeParse({ rankId: 2, permission: 'cash.view', allowed: 'true' }).success).toBe(false)
    expect(rankPermissionSchema.safeParse({ rankId: 2.5, permission: 'cash.view', allowed: true }).success).toBe(false)
    for (const permission of ['', 'CASH.VIEW', "cash.view'; drop table x;--", 'cash', 'a.b.c']) {
      expect(rankPermissionSchema.safeParse({ rankId: 2, permission, allowed: true }).success).toBe(false)
    }
  })
})

describe('cashBalanceSchema', () => {
  it('convierte el saldo a número entero', () => {
    const result = cashBalanceSchema.safeParse({ balance: '35.000' })
    expect(result.success && result.data.balance).toBe(35000)
  })

  it('acepta 0 y el máximo', () => {
    expect(cashBalanceSchema.safeParse({ balance: '0' }).success).toBe(true)
    expect(cashBalanceSchema.safeParse({ balance: '1.000.000.000' }).success).toBe(true)
  })

  it.each(['', '-5', '1.5', 'abc', '12,50', '1.000.000.001', null])('rechaza el saldo %j', (balance) => {
    expect(cashBalanceSchema.safeParse({ balance }).success).toBe(false)
  })

  it('explica el error en español', () => {
    const result = cashBalanceSchema.safeParse({ balance: '12,50' })
    expect(!result.success && result.error.issues[0].message).toContain('Importe no válido')
  })
})

describe('reverseMovementSchema', () => {
  it('acepta un id positivo y un motivo', () => {
    const result = reverseMovementSchema.safeParse({ movementId: '12', reason: 'Error de importe' })
    expect(result.success && result.data).toEqual({ movementId: 12, reason: 'Error de importe' })
  })

  it.each([{ movementId: '0' }, { movementId: '-1' }, { movementId: 'x' }, { movementId: null }])(
    'rechaza %j',
    (override) => {
      expect(reverseMovementSchema.safeParse({ reason: 'Error', ...override }).success).toBe(false)
    },
  )

  it('el motivo de anulación admite como máximo 100 caracteres', () => {
    expect(reverseMovementSchema.safeParse({ movementId: '1', reason: 'x'.repeat(100) }).success).toBe(true)
    expect(reverseMovementSchema.safeParse({ movementId: '1', reason: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('itemFieldsSchema', () => {
  const base = { name: 'Acero', category: 'Materiales', minStock: '40', unitCost: '1.200' }

  it('acepta un item completo y convierte los números', () => {
    const result = itemFieldsSchema.safeParse(base)
    expect(result.success && result.data).toEqual({ name: 'Acero', category: 'Materiales', minStock: 40, unitCost: 1200 })
  })

  it('categoría, mínimo y coste vacíos o ausentes toman sus valores por defecto', () => {
    for (const empty of [{ category: '', minStock: '', unitCost: '' }, { category: null, minStock: null, unitCost: null }]) {
      const result = itemFieldsSchema.safeParse({ name: 'Acero', ...empty })
      expect(result.success && result.data).toEqual({ name: 'Acero', category: null, minStock: 0, unitCost: 0 })
    }
  })

  it('el coste puede ser 0 pero no negativo', () => {
    expect(itemFieldsSchema.safeParse({ ...base, unitCost: '0' }).success).toBe(true)
    expect(itemFieldsSchema.safeParse({ ...base, unitCost: '-5' }).success).toBe(false)
  })

  it.each(['', ' ', 'a', 'x'.repeat(61)])('rechaza el nombre %j', (name) => {
    expect(itemFieldsSchema.safeParse({ ...base, name }).success).toBe(false)
  })

  it.each(['x', 'x'.repeat(41)])('rechaza la categoría %j', (category) => {
    expect(itemFieldsSchema.safeParse({ ...base, category }).success).toBe(false)
  })

  it.each(['-1', '1.5', 'mucho', '1000001'])('rechaza el mínimo %j', (minStock) => {
    expect(itemFieldsSchema.safeParse({ ...base, minStock }).success).toBe(false)
  })

  it.each(['12,50', 'caro', '1.000.000.001'])('rechaza el coste %j', (unitCost) => {
    expect(itemFieldsSchema.safeParse({ ...base, unitCost }).success).toBe(false)
  })

  it('updateItemSchema exige un id de item válido', () => {
    expect(updateItemSchema.safeParse({ ...base, itemId: '3' }).success).toBe(true)
    expect(updateItemSchema.safeParse({ ...base, itemId: '0' }).success).toBe(false)
    expect(updateItemSchema.safeParse({ ...base, itemId: null }).success).toBe(false)
  })

  it('archiveItemSchema convierte el texto a booleano', () => {
    expect(archiveItemSchema.safeParse({ itemId: '2', archived: 'true' }).data?.archived).toBe(true)
    expect(archiveItemSchema.safeParse({ itemId: '2', archived: 'false' }).data?.archived).toBe(false)
    expect(archiveItemSchema.safeParse({ itemId: '2', archived: 'si' }).success).toBe(false)
  })
})

describe('esquemas de movimientos de stock', () => {
  const base = { itemId: '3', kind: 'in', quantity: '25', reason: 'Compra semanal' }

  it('acepta una entrada y una salida', () => {
    expect(stockMovementSchema.safeParse(base).data).toEqual({ itemId: 3, kind: 'in', quantity: 25, reason: 'Compra semanal' })
    expect(stockMovementSchema.safeParse({ ...base, kind: 'out' }).data?.kind).toBe('out')
  })

  it.each(['', '0', '-3', '1.5', 'diez', '1000001'])('rechaza la cantidad %j', (quantity) => {
    expect(stockMovementSchema.safeParse({ ...base, quantity }).success).toBe(false)
  })

  it('acepta la cantidad máxima', () => {
    expect(stockMovementSchema.safeParse({ ...base, quantity: '1000000' }).success).toBe(true)
  })

  it.each([{ kind: 'robar' }, { kind: null }, { itemId: '0' }, { itemId: 'x' }, { reason: ' a ' }, { reason: 'x'.repeat(161) }])(
    'rechaza %j',
    (override) => {
      expect(stockMovementSchema.safeParse({ ...base, ...override }).success).toBe(false)
    },
  )

  it('reverseStockSchema valida id y motivo (máx. 100)', () => {
    expect(reverseStockSchema.safeParse({ movementId: '9', reason: 'Error de cantidad' }).success).toBe(true)
    expect(reverseStockSchema.safeParse({ movementId: '0', reason: 'Error' }).success).toBe(false)
    expect(reverseStockSchema.safeParse({ movementId: '9', reason: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('recipeSchema', () => {
  const lines = [
    { itemId: 1, quantity: 4 },
    { itemId: 2, quantity: 2 },
  ]
  const base = {
    recipeId: '',
    name: 'Cargador 9 mm',
    notes: '',
    salePrice: '1.800',
    outputQty: '5',
    outputItemId: '4',
    ingredients: JSON.stringify(lines),
  }

  it('acepta una receta completa y convierte los tipos', () => {
    const result = recipeSchema.safeParse(base)
    expect(result.success && result.data).toMatchObject({
      recipeId: null,
      name: 'Cargador 9 mm',
      notes: null,
      salePrice: 1800,
      outputQty: 5,
      outputItemId: 4,
      ingredients: lines,
      // Sin los campos nuevos (formulario antiguo): Workbench y el item elegido se usa como existente.
      craftLocation: 'workbench',
      outputMode: 'existing',
    })
  })

  it('el modo «crear item» ignora el item elegido y acepta lugar de fabricación', () => {
    const result = recipeSchema.safeParse({ ...base, outputMode: 'new', craftLocation: 'hand', newItemMinStock: '5' })
    expect(result.success && result.data).toMatchObject({ outputMode: 'new', outputItemId: null, craftLocation: 'hand', newItemMinStock: 5 })
    expect(recipeSchema.safeParse({ ...base, craftLocation: 'garaje' }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...base, outputMode: 'existing', outputItemId: '' }).success).toBe(false)
  })

  it('al editar acepta el id de la receta', () => {
    expect(recipeSchema.safeParse({ ...base, recipeId: '12' }).data?.recipeId).toBe(12)
    expect(recipeSchema.safeParse({ ...base, recipeId: '0' }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...base, recipeId: 'x' }).success).toBe(false)
  })

  it('precio, unidades y item de salida son opcionales con valores por defecto', () => {
    const result = recipeSchema.safeParse({ ...base, salePrice: '', outputQty: '', outputItemId: '' })
    expect(result.success && result.data).toMatchObject({ salePrice: 0, outputQty: 1, outputItemId: null })
    const absent = recipeSchema.safeParse({ ...base, salePrice: null, outputQty: null, outputItemId: null, notes: null })
    expect(absent.success && absent.data).toMatchObject({ salePrice: 0, outputQty: 1, outputItemId: null, notes: null })
  })

  it.each(['', ' ', 'a', 'x'.repeat(61)])('rechaza el nombre %j', (name) => {
    expect(recipeSchema.safeParse({ ...base, name }).success).toBe(false)
  })

  it.each(['-1', '12,50', 'caro', '1.000.000.001'])('rechaza el precio %j', (salePrice) => {
    expect(recipeSchema.safeParse({ ...base, salePrice }).success).toBe(false)
  })

  it.each(['0', '1001', '2.5', 'x'])('rechaza las unidades por tanda %j', (outputQty) => {
    expect(recipeSchema.safeParse({ ...base, outputQty }).success).toBe(false)
  })

  it('rechaza notas demasiado largas o de 1 carácter', () => {
    expect(recipeSchema.safeParse({ ...base, notes: 'x'.repeat(301) }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...base, notes: 'x' }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...base, notes: 'Receta de la banda' }).success).toBe(true)
  })

  it.each([
    ['sin ingredientes', '[]'],
    ['JSON roto', '[{"itemId":'],
    ['no es una lista', '{"itemId":1,"quantity":1}'],
    ['cantidad 0', '[{"itemId":1,"quantity":0}]'],
    ['cantidad decimal', '[{"itemId":1,"quantity":1.5}]'],
    ['cantidad enorme', '[{"itemId":1,"quantity":1000001}]'],
    ['cantidad no numérica (null)', '[{"itemId":1,"quantity":null}]'],
    ['item sin elegir', '[{"itemId":0,"quantity":1}]'],
    ['item como texto', '[{"itemId":"1","quantity":1}]'],
    ['ingrediente repetido', '[{"itemId":1,"quantity":1},{"itemId":1,"quantity":2}]'],
  ])('rechaza los ingredientes: %s', (_caso, ingredients) => {
    expect(recipeSchema.safeParse({ ...base, ingredients }).success).toBe(false)
  })

  it('rechaza más de 30 ingredientes y acepta justo 30', () => {
    const many = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ itemId: i + 1, quantity: 1 })))
    expect(recipeSchema.safeParse({ ...base, ingredients: many(31) }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...base, ingredients: many(30) }).success).toBe(true)
  })

  it('rechaza ingredientes ausentes (null de FormData)', () => {
    expect(recipeSchema.safeParse({ ...base, ingredients: null }).success).toBe(false)
  })

  it('explica el error de ingredientes en español', () => {
    const result = recipeSchema.safeParse({ ...base, ingredients: '[]' })
    expect(!result.success && result.error.issues[0].message).toContain('ingrediente')
  })
})

describe('esquemas de fabricar y gestionar recetas', () => {
  it('craftSchema valida receta y tandas (1 a 10.000)', () => {
    expect(craftSchema.safeParse({ recipeId: '3', batches: '10' }).data).toEqual({ recipeId: 3, batches: 10 })
    expect(craftSchema.safeParse({ recipeId: '3', batches: '10000' }).success).toBe(true)
    for (const batches of ['0', '10001', '-1', '1.5', 'x', '']) {
      expect(craftSchema.safeParse({ recipeId: '3', batches }).success).toBe(false)
    }
    expect(craftSchema.safeParse({ recipeId: '0', batches: '1' }).success).toBe(false)
  })

  it('recipeIdSchema y archiveRecipeSchema', () => {
    expect(recipeIdSchema.safeParse({ recipeId: '5' }).success).toBe(true)
    expect(recipeIdSchema.safeParse({ recipeId: null }).success).toBe(false)
    expect(archiveRecipeSchema.safeParse({ recipeId: '5', archived: 'true' }).data?.archived).toBe(true)
    expect(archiveRecipeSchema.safeParse({ recipeId: '5', archived: 'no' }).success).toBe(false)
  })
})

describe('importItemsSchema', () => {
  it('acepta texto y rechaza vacío, ausente o enorme', () => {
    expect(importItemsSchema.safeParse({ csv: 'Acero;Materiales;40;120' }).success).toBe(true)
    expect(importItemsSchema.safeParse({ csv: '' }).success).toBe(false)
    expect(importItemsSchema.safeParse({ csv: null }).success).toBe(false)
    expect(importItemsSchema.safeParse({ csv: 'x'.repeat(200_001) }).success).toBe(false)
    expect(importItemsSchema.safeParse({ csv: 'x'.repeat(200_000) }).success).toBe(true)
  })
})

describe('esquemas de pedidos urgentes', () => {
  const member = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
  const base = { title: 'Falta acero', body: '', priority: 'critical', itemId: '', recipients: [member] }

  it('acepta un pedido mínimo y normaliza detalle e item vacíos a null', () => {
    const result = urgentRequestSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.body).toBeNull()
      expect(result.data.itemId).toBeNull()
    }
  })

  it('acepta detalle e item y recorta espacios', () => {
    const result = urgentRequestSchema.safeParse({ ...base, title: '  Falta acero ', body: ' ya ', itemId: '7' })
    expect(result.success && [result.data.title, result.data.body, result.data.itemId]).toEqual(['Falta acero', 'ya', 7])
  })

  it('el campo ausente (null de FormData) cuenta como vacío en detalle', () => {
    expect(urgentRequestSchema.safeParse({ ...base, body: null }).success).toBe(true)
  })

  it.each([
    ['título corto', { title: 'ab' }],
    ['título largo', { title: 'x'.repeat(81) }],
    ['título ausente', { title: null }],
    ['detalle largo', { body: 'x'.repeat(501) }],
    ['prioridad inválida', { priority: 'low' }],
    ['sin destinatarios', { recipients: [] }],
    ['destinatario no UUID', { recipients: ['abc'] }],
    ['demasiados destinatarios', { recipients: Array.from({ length: 51 }, () => member) }],
    ['item inválido', { itemId: '-3' }],
  ])('rechaza %s', (_name, override) => {
    expect(urgentRequestSchema.safeParse({ ...base, ...override }).success).toBe(false)
  })

  it('closeUrgentSchema solo admite cubierto o cancelado', () => {
    expect(closeUrgentSchema.safeParse({ requestId: '4', status: 'covered' }).success).toBe(true)
    expect(closeUrgentSchema.safeParse({ requestId: '4', status: 'cancelled' }).success).toBe(true)
    expect(closeUrgentSchema.safeParse({ requestId: '4', status: 'open' }).success).toBe(false)
    expect(closeUrgentSchema.safeParse({ requestId: '0', status: 'covered' }).success).toBe(false)
  })
})

describe('esquemas de miembros', () => {
  const memberId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

  it('approveMemberSchema valida UUID y rango positivo', () => {
    expect(approveMemberSchema.safeParse({ memberId, rankId: '3' }).success).toBe(true)
    expect(approveMemberSchema.safeParse({ memberId: 'no-uuid', rankId: '3' }).success).toBe(false)
    expect(approveMemberSchema.safeParse({ memberId, rankId: '0' }).success).toBe(false)
  })

  it('blockMemberSchema convierte el texto a booleano', () => {
    const blocked = blockMemberSchema.safeParse({ memberId, blocked: 'true' })
    const open = blockMemberSchema.safeParse({ memberId, blocked: 'false' })
    expect(blocked.success && blocked.data.blocked).toBe(true)
    expect(open.success && open.data.blocked).toBe(false)
    expect(blockMemberSchema.safeParse({ memberId, blocked: 'yes' }).success).toBe(false)
  })
})

describe('esquemas de la lista de acceso', () => {
  it('acepta un ID de Discord de 17 a 20 dígitos y normaliza la nota', () => {
    const result = addAllowedIdSchema.safeParse({ discordId: ' 720656305043275926 ', label: '  Milo  ' })
    expect(result.success && result.data).toEqual({ discordId: '720656305043275926', label: 'Milo' })
    expect(addAllowedIdSchema.safeParse({ discordId: '12345678901234567', label: '' }).data?.label).toBeNull()
    expect(addAllowedIdSchema.safeParse({ discordId: '12345678901234567', label: null }).data?.label).toBeNull()
  })

  it.each(['', 'abc', '1234567890123456', '123456789012345678901', '7206563050432759x6', '720.656305043275926', '@usuario'])(
    'rechaza el ID %j',
    (discordId) => {
      expect(addAllowedIdSchema.safeParse({ discordId, label: null }).success).toBe(false)
      expect(removeAllowedIdSchema.safeParse({ discordId }).success).toBe(false)
    },
  )

  it('la nota no puede pasar de 60 caracteres', () => {
    expect(addAllowedIdSchema.safeParse({ discordId: '12345678901234567', label: 'x'.repeat(61) }).success).toBe(false)
  })
})

describe('esquemas del mapa', () => {
  const icon = { iconId: '', emoji: ' 🔫 ', title: '  NPC armas ', note: '  Vende de noche ' }

  it('acepta un icono y normaliza los campos', () => {
    const result = saveIconSchema.safeParse(icon)
    expect(result.success && result.data).toEqual({ iconId: null, emoji: '🔫', title: 'NPC armas', note: 'Vende de noche' })
  })

  it('al editar acepta el id y una nota vacía o ausente pasa a null', () => {
    expect(saveIconSchema.safeParse({ ...icon, iconId: '7' }).data?.iconId).toBe(7)
    expect(saveIconSchema.safeParse({ ...icon, note: '' }).data?.note).toBeNull()
    expect(saveIconSchema.safeParse({ ...icon, note: null }).data?.note).toBeNull()
  })

  it.each([
    ['sin emoji', { emoji: '' }],
    ['texto en vez de emoji', { emoji: 'hola' }],
    ['dos emojis', { emoji: '🔫🔫' }],
    ['sin título', { title: '   ' }],
    ['título largo', { title: 'x'.repeat(61) }],
    ['nota larga', { note: 'x'.repeat(501) }],
    ['id inválido', { iconId: '0' }],
  ])('rechaza un icono %s', (_name, override) => {
    expect(saveIconSchema.safeParse({ ...icon, ...override }).success).toBe(false)
  })

  const marker = { markerId: '', iconId: '3', x: '0.25', y: 0.5 }

  it('acepta una marca de un icono', () => {
    const result = saveMarkerSchema.safeParse(marker)
    expect(result.success && result.data).toEqual({ markerId: null, iconId: 3, x: 0.25, y: 0.5 })
  })

  it('al mover una marca acepta su id', () => {
    expect(saveMarkerSchema.safeParse({ ...marker, markerId: '9' }).data?.markerId).toBe(9)
  })

  it.each([
    ['fuera del mapa (x)', { x: 1.2 }],
    ['fuera del mapa (y)', { y: -0.1 }],
    ['posición no numérica', { x: 'a' }],
    ['sin icono', { iconId: '' }],
    ['icono inválido', { iconId: '0' }],
    ['marca inválida', { markerId: '0' }],
  ])('rechaza una marca %s', (_name, override) => {
    expect(saveMarkerSchema.safeParse({ ...marker, ...override }).success).toBe(false)
  })

  const area = {
    areaId: null,
    name: ' Zona norte ',
    note: '',
    color: '#FF3D8B',
    points: JSON.stringify([[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]]),
  }

  it('acepta una zona, pasa el color a minúsculas y lee los puntos', () => {
    const result = saveAreaSchema.safeParse(area)
    expect(result.success && result.data).toEqual({
      areaId: null,
      name: 'Zona norte',
      note: null,
      color: '#ff3d8b',
      points: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]],
    })
  })

  it('al editar, sin puntos conserva la forma (points = null)', () => {
    expect(saveAreaSchema.safeParse({ ...area, areaId: '3', points: null }).data).toMatchObject({ areaId: 3, points: null })
    expect(saveAreaSchema.safeParse({ ...area, points: '' }).data?.points).toBeNull()
  })

  it.each([
    ['dos puntos', { points: JSON.stringify([[0.1, 0.1], [0.3, 0.1]]) }],
    ['punto fuera del mapa', { points: JSON.stringify([[0.1, 0.1], [0.3, 2], [0.2, 0.3]]) }],
    ['punto no numérico', { points: JSON.stringify([[0.1, 'a'], [0.3, 0.2], [0.2, 0.3]]) }],
    ['más de 60 puntos', { points: JSON.stringify(Array.from({ length: 61 }, () => [0.5, 0.5])) }],
    ['JSON roto', { points: '[[0.1,' }],
    ['no es una lista', { points: '{"a":1}' }],
    ['color malo', { color: 'rojo' }],
    ['color corto', { color: '#fff' }],
    ['sin nombre', { name: '' }],
  ])('rechaza una zona con %s', (_name, override) => {
    expect(saveAreaSchema.safeParse({ ...area, ...override }).success).toBe(false)
  })

  it('deleteMapItemSchema pide un id positivo', () => {
    expect(deleteMapItemSchema.safeParse({ id: '5' }).success).toBe(true)
    expect(deleteMapItemSchema.safeParse({ id: '0' }).success).toBe(false)
    expect(deleteMapItemSchema.safeParse({ id: 'x' }).success).toBe(false)
  })
})
