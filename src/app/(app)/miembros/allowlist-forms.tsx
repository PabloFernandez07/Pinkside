'use client'

import { addAllowedId, removeAllowedId } from '@/app/actions/allowlist'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'

export function AddAllowedForm() {
  const { state, pending, onSubmit } = useManualForm(addAllowedId, { resetOnSuccess: true })
  return (
    <form onSubmit={onSubmit} className="form allow-form" noValidate>
      <Field
        name="discordId"
        label="ID de Discord"
        inputMode="numeric"
        autoComplete="off"
        placeholder="720656305043275926"
        hint="Discord → Ajustes → Avanzado → Modo desarrollador; luego clic derecho en el usuario → Copiar ID"
        error={state?.errors?.discordId}
        required
      />
      <Field
        name="label"
        label="Nota (opcional)"
        autoComplete="off"
        maxLength={60}
        placeholder="Nombre o apodo, para reconocerlo"
        error={state?.errors?.label}
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Autorizando…" className="btn">
          Autorizar acceso
        </SubmitButton>
      </div>
    </form>
  )
}

/** Quita un ID de la lista (si ya tenía cuenta, queda bloqueada). */
export function RemoveAllowedForm({ discordId, name }: { discordId: string; name: string }) {
  const { state, pending, onSubmit } = useManualForm(removeAllowedId)
  return (
    <details className="reverse">
      <summary aria-label={`Quitar el acceso de ${name}`}>Quitar</summary>
      <form onSubmit={onSubmit} className="reverse-form" noValidate>
        <input type="hidden" name="discordId" value={discordId} />
        <p className="small muted">Dejará de poder entrar y, si ya tenía cuenta, se bloqueará.</p>
        <SubmitButton pending={pending} pendingLabel="Quitando…" className="btn sm danger ghost">
          Confirmar
        </SubmitButton>
        <FormMessage state={state} />
      </form>
    </details>
  )
}
