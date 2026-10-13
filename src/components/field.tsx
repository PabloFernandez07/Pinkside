import type { InputHTMLAttributes } from 'react'
import type { FormState } from '@/lib/validation'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string
  label: string
  error?: string[]
  hint?: string
}

/** Campo de formulario con etiqueta, ayuda y error accesibles. */
export function Field({ name, label, error, hint, ...inputProps }: FieldProps) {
  const id = `f-${name}`
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ')
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
      {error && (
        <span id={`${id}-err`} className="err">
          {error[0]}
        </span>
      )}
    </div>
  )
}

/** Mensaje de resultado de un formulario (éxito o error general). */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null
  return (
    <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'notice ok' : 'notice bad'}>
      {state.message}
    </p>
  )
}
