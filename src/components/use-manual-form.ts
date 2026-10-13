'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'
import type { FormState } from '@/lib/validation'

type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>

interface ManualFormOptions {
  /** Vacía el formulario cuando la acción termina bien (p. ej. tras registrar un movimiento). */
  resetOnSuccess?: boolean
}

/**
 * Envía el formulario a una Server Action SIN el reinicio automático de React 19.
 * Con `<form action>` React vacía el formulario al terminar y los controles controlados
 * (radios, interruptores, textos) vuelven a su valor inicial aunque el estado diga otra cosa.
 * Aquí el formulario solo se vacía si lo pides y la acción ha ido bien.
 */
export function useManualForm(action: FormAction, { resetOnSuccess = false }: ManualFormOptions = {}) {
  const [state, run, pending] = useActionState(action, undefined)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset()
  }, [state, resetOnSuccess])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    formRef.current = event.currentTarget
    const data = new FormData(event.currentTarget)
    startTransition(() => run(data))
  }

  return { state, pending, onSubmit }
}
