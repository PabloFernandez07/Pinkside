'use client'

import { useState } from 'react'
import { updatePreferences, updateProfile } from '@/app/actions/profile'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { ACCENTS, THEMES, type AccentId, type ThemeId } from '@/lib/accents'

interface ProfileFormProps {
  defaults: { firstName: string; lastName: string; phone: string; motto: string }
}

export function ProfileForm({ defaults }: ProfileFormProps) {
  const { state, pending, onSubmit } = useManualForm(updateProfile)
  const [values, setValues] = useState(defaults)
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  })

  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <Field name="firstName" label="Nombre" autoComplete="off" error={state?.errors?.firstName} required {...bind('firstName')} />
      <Field name="lastName" label="Apellidos" autoComplete="off" error={state?.errors?.lastName} required {...bind('lastName')} />
      <Field name="phone" label="Teléfono" inputMode="tel" autoComplete="off" error={state?.errors?.phone} required {...bind('phone')} />
      <Field
        name="motto"
        label="Lema (opcional)"
        autoComplete="off"
        maxLength={80}
        hint="Sale en tu perfil público y en el ranking"
        error={state?.errors?.motto}
        {...bind('motto')}
      />
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Guardar datos
        </SubmitButton>
      </div>
    </form>
  )
}

/** Vista previa inmediata del tema; se guarda al enviar el formulario. */
function previewTheme(theme: ThemeId) {
  const root = document.documentElement
  root.dataset.themePref = theme
  root.dataset.theme =
    theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
}

interface PreferencesFormProps {
  theme: ThemeId
  accent: AccentId
  dmUrgent: boolean
}

export function PreferencesForm(initial: PreferencesFormProps) {
  const { state, pending, onSubmit } = useManualForm(updatePreferences)
  const [theme, setTheme] = useState(initial.theme)
  const [accent, setAccent] = useState(initial.accent)
  const [dmUrgent, setDmUrgent] = useState(initial.dmUrgent)

  return (
    <form onSubmit={onSubmit} className="form">
      <fieldset className="wide">
        <legend>Tema</legend>
        <div className="seg">
          {THEMES.map((option) => (
            <label key={option.id} className="seg-opt">
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={theme === option.id}
                onChange={() => {
                  setTheme(option.id)
                  previewTheme(option.id)
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="wide">
        <legend>Color de acento</legend>
        <div className="swatches">
          {ACCENTS.map((option) => (
            <label key={option.id} className="swatch-opt">
              <input
                type="radio"
                name="accent"
                value={option.id}
                checked={accent === option.id}
                onChange={() => {
                  setAccent(option.id)
                  document.documentElement.dataset.accent = option.id
                }}
              />
              <span className="swatch" data-accent={option.id} aria-hidden="true" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="row wide">
        <span>
          <b>Avisos urgentes por MD</b>
          <small>Recibir un mensaje privado de Discord cuando haya un pedido urgente</small>
        </span>
        <input
          type="checkbox"
          name="dmUrgent"
          className="sw"
          checked={dmUrgent}
          onChange={(event) => setDmUrgent(event.target.checked)}
        />
      </label>

      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Guardar preferencias
        </SubmitButton>
      </div>
    </form>
  )
}
