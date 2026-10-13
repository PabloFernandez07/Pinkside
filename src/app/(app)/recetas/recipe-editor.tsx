'use client'

import { useState } from 'react'
import { deleteRecipe, saveRecipe, setRecipeArchived } from '@/app/actions/recipes'
import { Field, FormMessage } from '@/components/field'
import { ItemThumb } from '@/components/item-thumb'
import { PhotoPicker } from '@/components/photo-picker'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { formatMoney, parseMoney } from '@/lib/money'
import type { CraftLocation } from '@/lib/recipes'

export interface EditorItem {
  id: number
  name: string
  unitCost: number
  archived: boolean
  imagePath: string | null
}

export interface EditorInitial {
  recipeId: number
  name: string
  notes: string | null
  salePrice: number
  outputQty: number
  outputItemId: number | null
  craftLocation: CraftLocation
  ingredients: { itemId: number; quantity: number }[]
}

type OutputMode = 'new' | 'existing' | 'none'

interface Row {
  key: number
  itemId: string
  quantity: string
}

const MAX_INGREDIENTS = 30

export function RecipeEditor({ items, initial }: { items: EditorItem[]; initial?: EditorInitial }) {
  const { state, pending, onSubmit } = useManualForm(saveRecipe)
  const [rows, setRows] = useState<Row[]>(
    initial?.ingredients.map((line, index) => ({ key: index, itemId: String(line.itemId), quantity: String(line.quantity) })) ?? [
      { key: 0, itemId: '', quantity: '1' },
    ],
  )
  // Receta nueva: lo normal es crear su item; al editar se respeta lo que ya tenía.
  const [mode, setMode] = useState<OutputMode>(initial ? (initial.outputItemId === null ? 'none' : 'existing') : 'new')
  const [nextKey, setNextKey] = useState(rows.length)
  const [price, setPrice] = useState(initial ? String(initial.salePrice) : '')
  const [outputQty, setOutputQty] = useState(String(initial?.outputQty ?? 1))

  const itemById = new Map(items.map((item) => [item.id, item]))
  const lines = rows
    .filter((row) => row.itemId !== '')
    .map((row) => ({ itemId: Number(row.itemId), quantity: Number(row.quantity) }))

  // Vista previa con los costes actuales del inventario.
  const costPerBatch = lines.reduce(
    (total, line) => total + (Number.isFinite(line.quantity) ? line.quantity : 0) * (itemById.get(line.itemId)?.unitCost ?? 0),
    0,
  )
  const unitsPerBatch = Math.max(1, Number.parseInt(outputQty, 10) || 1)
  const salePrice = price.trim() === '' ? 0 : (parseMoney(price) ?? 0)
  const profitPerBatch = salePrice * unitsPerBatch - costPerBatch

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key))
  const add = () => {
    setRows((current) => [...current, { key: nextKey, itemId: '', quantity: '1' }])
    setNextKey((key) => key + 1)
  }

  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      {initial && <input type="hidden" name="recipeId" value={initial.recipeId} />}
      <input type="hidden" name="ingredients" value={JSON.stringify(lines)} />

      <Field name="name" label="Nombre de la receta" defaultValue={initial?.name} autoComplete="off" maxLength={60} error={state?.errors?.name} required />
      <Field
        name="salePrice"
        label="Precio de venta por unidad"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        error={state?.errors?.salePrice}
      />
      <Field
        name="outputQty"
        label="Unidades por tanda"
        value={outputQty}
        onChange={(event) => setOutputQty(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        hint="Lo que produce cada crafteo"
        error={state?.errors?.outputQty}
      />
      <div className="field">
        <label htmlFor="f-craftLocation">Dónde se fabrica</label>
        <select id="f-craftLocation" name="craftLocation" defaultValue={initial?.craftLocation ?? 'workbench'}>
          <option value="workbench">En la Workbench</option>
          <option value="hand">A mano (no hace falta Workbench)</option>
        </select>
        {state?.errors?.craftLocation && <span className="err">{state.errors.craftLocation[0]}</span>}
      </div>
      <div className="field">
        <label htmlFor="f-outputMode">Item que se produce</label>
        <select id="f-outputMode" name="outputMode" value={mode} onChange={(event) => setMode(event.target.value as OutputMode)}>
          <option value="new">Crear un item nuevo con esta receta</option>
          <option value="existing">Usar un item que ya existe</option>
          <option value="none">Ninguno (solo descuenta ingredientes)</option>
        </select>
        <small className="muted">Al fabricar, el producto se suma a su stock</small>
        {state?.errors?.outputMode && <span className="err">{state.errors.outputMode[0]}</span>}
      </div>

      {mode === 'new' && (
        <fieldset className="wide output-box">
          <legend>El item nuevo</legend>
          <p className="muted small">
            Se crea con el mismo nombre que la receta. Su coste por unidad depende de los ingredientes:{' '}
            <b className="mono">{formatMoney(Math.round(costPerBatch / unitsPerBatch))}</b> ahora mismo.
          </p>
          <div className="form">
            <Field
              name="newItemCategory"
              label="Categoría (opcional)"
              autoComplete="off"
              maxLength={40}
              error={state?.errors?.newItemCategory}
            />
            <Field
              name="newItemMinStock"
              label="Stock mínimo"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              hint="Avisa cuando baje de aquí"
              error={state?.errors?.newItemMinStock}
            />
            <PhotoPicker error={state?.errors?.photo} />
          </div>
        </fieldset>
      )}
      {mode === 'existing' && (
        <div className="field wide">
          <label htmlFor="f-outputItemId">Item existente</label>
          <select id="f-outputItemId" name="outputItemId" defaultValue={initial?.outputItemId ?? ''}>
            <option value="">Elige un item…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.archived ? ' (archivado)' : ''}
              </option>
            ))}
          </select>
          <small className="muted">Su coste por unidad se actualiza con el de los ingredientes al guardar.</small>
          {state?.errors?.outputItemId && <span className="err">{state.errors.outputItemId[0]}</span>}
        </div>
      )}
      <div className="field wide">
        <label htmlFor="f-notes">Notas (opcional)</label>
        <textarea id="f-notes" name="notes" rows={2} maxLength={300} defaultValue={initial?.notes ?? ''} aria-invalid={state?.errors?.notes ? true : undefined} />
        {state?.errors?.notes && <span className="err">{state.errors.notes[0]}</span>}
      </div>

      <fieldset className="wide ingredients">
        <legend>Ingredientes por tanda</legend>
        {items.length === 0 && (
          <p className="muted small">Todavía no hay items en el inventario. Crea primero los materiales en Inventario.</p>
        )}
        {rows.map((row, index) => (
          <div key={row.key} className="ing-row">
            <ItemThumb
              name={itemById.get(Number(row.itemId))?.name ?? '?'}
              path={itemById.get(Number(row.itemId))?.imagePath}
              size="sm"
            />
            <select
              value={row.itemId}
              onChange={(event) => update(row.key, { itemId: event.target.value })}
              aria-label={`Item del ingrediente ${index + 1}`}
            >
              <option value="">Elige un item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.archived ? ' (archivado)' : ''}
                </option>
              ))}
            </select>
            <input
              value={row.quantity}
              onChange={(event) => update(row.key, { quantity: event.target.value })}
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Cantidad del ingrediente ${index + 1}`}
            />
            <button type="button" className="btn sm ghost" onClick={() => remove(row.key)} aria-label={`Quitar el ingrediente ${index + 1}`}>
              Quitar
            </button>
          </div>
        ))}
        <div className="ing-actions">
          <button type="button" className="btn sm ghost" onClick={add} disabled={rows.length >= MAX_INGREDIENTS}>
            + Añadir ingrediente
          </button>
          <span className="muted small">
            Coste por tanda: <b className="mono">{formatMoney(costPerBatch)}</b> · Beneficio por tanda:{' '}
            <b className="mono">{profitPerBatch < 0 ? `−${formatMoney(Math.abs(profitPerBatch))}` : formatMoney(profitPerBatch)}</b>
          </span>
        </div>
        {state?.errors?.ingredients && (
          <span className="err" role="alert">
            {state.errors.ingredients[0]}
          </span>
        )}
      </fieldset>

      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          {initial ? 'Guardar cambios' : 'Crear receta'}
        </SubmitButton>
      </div>
    </form>
  )
}

/** Archivar (reversible) y borrar (con confirmación). */
export function RecipeDangerZone({ recipeId, name, archived }: { recipeId: number; name: string; archived: boolean }) {
  const archive = useManualForm(setRecipeArchived)
  const del = useManualForm(deleteRecipe)
  return (
    <div className="danger-zone">
      <form onSubmit={archive.onSubmit} className="inline-form">
        <input type="hidden" name="recipeId" value={recipeId} />
        <input type="hidden" name="archived" value={String(!archived)} />
        <SubmitButton pending={archive.pending} pendingLabel="…" className="btn ghost">
          {archived ? 'Restaurar receta' : 'Archivar receta'}
        </SubmitButton>
        <FormMessage state={archive.state} />
      </form>
      <details className="reverse">
        <summary>Borrar receta…</summary>
        <form onSubmit={del.onSubmit} className="reverse-form" noValidate>
          <input type="hidden" name="recipeId" value={recipeId} />
          <small className="muted">
            Se borra «{name}» para siempre. Lo fabricado antes no se toca. Si dudas, archívala.
          </small>
          <SubmitButton pending={del.pending} pendingLabel="Borrando…" className="btn sm ghost danger">
            Sí, borrar
          </SubmitButton>
          <FormMessage state={del.state} />
        </form>
      </details>
    </div>
  )
}
