'use client'

import { useState, useTransition } from 'react'
import { setSectionDisabled } from '@/app/actions/sections'
import type { SectionId } from '@/lib/sections'

interface SectionToggleProps {
  section: SectionId
  label: string
  description: string
  /** La sección está visible (activada) ahora mismo. */
  enabled: boolean
}

/** Interruptor que guarda al instante y se deshace solo si el servidor lo rechaza. */
export function SectionToggle({ section, label, description, enabled }: SectionToggleProps) {
  const [value, setValue] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (pending) return
    const next = event.target.checked
    setValue(next)
    setError(null)
    startTransition(async () => {
      const result = await setSectionDisabled({ section, disabled: !next })
      if (!result?.ok) {
        setValue(!next)
        setError(result?.message ?? 'No se pudo guardar el cambio.')
      }
    })
  }

  return (
    <div>
      <label className="row">
        <span>
          <b>{label}</b>
          <small className="muted">{description}</small>
        </span>
        <input type="checkbox" checked={value} onChange={onChange} aria-busy={pending} aria-label={`Mostrar ${label} en el menú`} />
      </label>
      {error && (
        <p role="alert" className="err small">
          {error}
        </p>
      )}
    </div>
  )
}
