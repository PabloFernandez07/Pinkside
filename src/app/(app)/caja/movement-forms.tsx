'use client'

import { useState } from 'react'
import { reverseMovement, setBalance } from '@/app/actions/cash'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { formatMoney, formatSignedMoney, parseMoney } from '@/lib/money'

/**
 * Cuenta del miembro: se escribe el saldo total (no lo que se añade) y se muestra la diferencia que se va a registrar.
 * La página lo monta con `key={current}` para que se reinicie al cambiar el saldo.
 */
export function BalanceForm({ current }: { current: number }) {
  const { state, pending, onSubmit } = useManualForm(setBalance)
  const [value, setValue] = useState(String(current))
  const next = parseMoney(value)
  const delta = next === null ? null : next - current
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <Field
        name="balance"
        label="Saldo total de tu cuenta"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        hint={
          delta === null || delta === 0
            ? `Ahora tienes ${formatMoney(current)}. Escribe lo que tienes en total.`
            : `Se registrará ${formatSignedMoney(delta)} (de ${formatMoney(current)} a ${formatMoney(next ?? 0)}).`
        }
        error={state?.errors?.balance}
        required
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Guardando…" className="btn block">
          Actualizar mi cuenta
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
