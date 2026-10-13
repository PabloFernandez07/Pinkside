'use client'

import {
  createItem,
  importItems,
  registerStock,
  reverseStock,
  setItemArchived,
  updateItem,
} from '@/app/actions/inventory'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'

export function NewItemForm() {
  const { state, pending, onSubmit } = useManualForm(createItem, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <Field name="name" label="Nombre" autoComplete="off" maxLength={60} error={state?.errors?.name} required />
      <Field name="category" label="Categoría (opcional)" autoComplete="off" maxLength={40} error={state?.errors?.category} />
      <Field
        name="minStock"
        label="Stock mínimo"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        hint="Avisa cuando baje de aquí"
        error={state?.errors?.minStock}
      />
      <Field
        name="unitCost"
        label="Coste por unidad"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        error={state?.errors?.unitCost}
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Creando…" className="btn block">
          Crear item
        </SubmitButton>
      </div>
    </form>
  )
}

interface EditItemFormProps {
  itemId: number
  name: string
  category: string | null
  minStock: number
  unitCost: number
}

export function EditItemForm({ itemId, name, category, minStock, unitCost }: EditItemFormProps) {
  const { state, pending, onSubmit } = useManualForm(updateItem)
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <Field name="name" label="Nombre" defaultValue={name} autoComplete="off" maxLength={60} error={state?.errors?.name} required />
      <Field
        name="category"
        label="Categoría"
        defaultValue={category ?? ''}
        autoComplete="off"
        maxLength={40}
        error={state?.errors?.category}
      />
      <Field
        name="minStock"
        label="Stock mínimo"
        defaultValue={minStock}
        inputMode="numeric"
        autoComplete="off"
        error={state?.errors?.minStock}
      />
      <Field
        name="unitCost"
        label="Coste por unidad"
        defaultValue={unitCost}
        inputMode="numeric"
        autoComplete="off"
        error={state?.errors?.unitCost}
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Guardar cambios
        </SubmitButton>
      </div>
    </form>
  )
}

export function ArchiveForm({ itemId, archived }: { itemId: number; archived: boolean }) {
  const { state, pending, onSubmit } = useManualForm(setItemArchived)
  return (
    <form onSubmit={onSubmit} className="inline-form">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="archived" value={String(!archived)} />
      <SubmitButton pending={pending} pendingLabel="…" className="btn ghost">
        {archived ? 'Restaurar item' : 'Archivar item'}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}

interface MoveStockFormProps {
  itemId: number
  itemName: string
  /** En la tabla se muestra plegado; en la ficha del item, abierto. */
  compact?: boolean
}

export function MoveStockForm({ itemId, itemName, compact = false }: MoveStockFormProps) {
  const { state, pending, onSubmit } = useManualForm(registerStock, { resetOnSuccess: true })
  const form = (
    <form onSubmit={onSubmit} className="move-form" noValidate>
      <input type="hidden" name="itemId" value={itemId} />
      <select name="kind" defaultValue="out" aria-label={`Tipo de movimiento de ${itemName}`}>
        <option value="in">Entrada (suma)</option>
        <option value="out">Salida (resta)</option>
      </select>
      <input
        name="quantity"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Cantidad"
        aria-label={`Cantidad de ${itemName}`}
        aria-invalid={state?.errors?.quantity ? true : undefined}
      />
      <input
        name="reason"
        autoComplete="off"
        maxLength={160}
        placeholder="Motivo"
        aria-label={`Motivo del movimiento de ${itemName}`}
        aria-invalid={state?.errors?.reason ? true : undefined}
      />
      <SubmitButton pending={pending} pendingLabel="Registrando…" className="btn sm">
        Registrar
      </SubmitButton>
      {(state?.errors?.quantity || state?.errors?.reason) && (
        <span className="err" role="alert">
          {state?.errors?.quantity?.[0] ?? state?.errors?.reason?.[0]}
        </span>
      )}
      <FormMessage state={state} />
    </form>
  )
  if (!compact) return form
  return (
    <details className="move">
      <summary>Mover</summary>
      {form}
    </details>
  )
}

/** Anular un movimiento de stock: pide un motivo y crea el movimiento contrario. */
export function ReverseStockForm({ movementId }: { movementId: number }) {
  const { state, pending, onSubmit } = useManualForm(reverseStock)
  return (
    <details className="reverse">
      <summary>Anular</summary>
      <form onSubmit={onSubmit} className="reverse-form" noValidate>
        <input type="hidden" name="movementId" value={movementId} />
        <input
          name="reason"
          aria-label={`Motivo para anular el movimiento ${movementId}`}
          placeholder="Motivo de la anulación"
          maxLength={100}
          autoComplete="off"
          required
        />
        <SubmitButton pending={pending} pendingLabel="Anulando…" className="btn sm">
          Confirmar
        </SubmitButton>
        {state?.errors?.reason && <span className="err">{state.errors.reason[0]}</span>}
        <FormMessage state={state} />
      </form>
    </details>
  )
}

export function ImportForm() {
  const { state, pending, onSubmit } = useManualForm(importItems, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <div className="field wide">
        <label htmlFor="f-csv">Pega la tabla (nombre; categoría; mínimo; coste)</label>
        <textarea
          id="f-csv"
          name="csv"
          rows={6}
          spellCheck={false}
          placeholder={'Acero;Materiales;40;120\nPólvora;Materiales;30;310'}
          aria-invalid={state?.errors?.csv ? true : undefined}
          aria-describedby="f-csv-hint"
        />
        <small id="f-csv-hint" className="muted">
          Puedes copiarla desde Excel o Google Sheets. Categoría, mínimo y coste son opcionales, y la fila de títulos se
          ignora. Si una fila falla no se importa ninguna.
        </small>
        {state?.errors?.csv && (
          <ul className="err import-errors" role="alert">
            {state.errors.csv.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Importando…">
          Importar items
        </SubmitButton>
      </div>
    </form>
  )
}
