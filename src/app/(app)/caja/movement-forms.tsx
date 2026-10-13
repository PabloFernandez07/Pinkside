'use client'

import { registerMovement, reverseMovement } from '@/app/actions/cash'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'

interface MovementFormProps {
  /** Puede registrar entradas (cash.write). */
  canIn: boolean
  /** Puede registrar salidas (cash.withdraw). */
  canOut: boolean
}

export function MovementForm({ canIn, canOut }: MovementFormProps) {
  const { state, pending, onSubmit } = useManualForm(registerMovement, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <div className="field wide">
        <label htmlFor="f-kind">Tipo</label>
        <select id="f-kind" name="kind" defaultValue={canIn ? 'in' : 'out'}>
          {canIn && <option value="in">Entrada (dinero que entra)</option>}
          {canOut && <option value="out">Salida (dinero que sale)</option>}
        </select>
      </div>
      <Field
        name="amount"
        label="Importe"
        inputMode="numeric"
        autoComplete="off"
        placeholder="1.500"
        error={state?.errors?.amount}
        required
      />
      <Field
        name="reason"
        label="Motivo"
        autoComplete="off"
        maxLength={160}
        placeholder="Venta, compra, reparto…"
        error={state?.errors?.reason}
        required
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Registrando…" className="btn block">
          Registrar movimiento
        </SubmitButton>
      </div>
    </form>
  )
}

/** Anular un movimiento: pide un motivo y crea el movimiento contrario. No borra nada. */
export function ReverseForm({ movementId }: { movementId: number }) {
  const { state, pending, onSubmit } = useManualForm(reverseMovement)
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
