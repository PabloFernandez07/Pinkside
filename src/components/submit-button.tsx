'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps {
  children: ReactNode
  pendingLabel?: string
  className?: string
  /** Para formularios enviados a mano (useManualForm); si no, se toma de useFormStatus. */
  pending?: boolean
}

export function SubmitButton({ children, pendingLabel, className = 'btn', pending: forced }: SubmitButtonProps) {
  const status = useFormStatus()
  const pending = forced ?? status.pending
  return (
    // aria-disabled en vez de disabled: el botón conserva el foco del teclado mientras se envía (el clic se bloquea).
    <button
      type="submit"
      className={className}
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault()
      }}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
}
