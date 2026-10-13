'use client'

import { useState } from 'react'
import { completeOnboarding } from '@/app/actions/onboarding'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'

export function OnboardingForm() {
  const { state, pending, onSubmit } = useManualForm(completeOnboarding)
  const [values, setValues] = useState({ stateId: '', firstName: '', lastName: '', phone: '' })
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <Field
        name="stateId"
        label="StateID"
        inputMode="numeric"
        autoComplete="off"
        hint="El número de tu personaje en el servidor"
        error={state?.errors?.stateId}
        required
        {...bind('stateId')}
      />
      <Field name="phone" label="Teléfono" inputMode="tel" autoComplete="off" error={state?.errors?.phone} required {...bind('phone')} />
      <Field name="firstName" label="Nombre" autoComplete="off" error={state?.errors?.firstName} required {...bind('firstName')} />
      <Field name="lastName" label="Apellidos" autoComplete="off" error={state?.errors?.lastName} required {...bind('lastName')} />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Guardando…" className="btn block">
          Enviar ficha
        </SubmitButton>
      </div>
    </form>
  )
}
