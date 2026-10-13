'use client'

import { useState, useTransition } from 'react'
import { setRankPermission } from '@/app/actions/ranks'

interface PermissionToggleProps {
  rankId: number
  permission: string
  /** Texto accesible: "Ver caja para Miembro". */
  label: string
  checked: boolean
  disabled: boolean
  /** Por qué está bloqueado, para lectores de pantalla y para el título. */
  reason?: string
}

/** Casilla que guarda al instante y se deshace sola si el servidor la rechaza. */
export function PermissionToggle({ rankId, permission, label, checked, disabled, reason }: PermissionToggleProps) {
  const [value, setValue] = useState(checked)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (pending) return // sin `disabled` durante el guardado, para no perder el foco; se ignora el cambio
    const next = event.target.checked
    setValue(next)
    setError(null)
    startTransition(async () => {
      const result = await setRankPermission({ rankId, permission, allowed: next })
      if (!result?.ok) {
        setValue(!next)
        setError(result?.message ?? 'No se pudo guardar el cambio.')
      }
    })
  }

  return (
    <span className="toggle-cell">
      <input
        type="checkbox"
        className="chk"
        checked={value}
        disabled={disabled}
        aria-busy={pending}
        onChange={onChange}
        aria-label={label}
        title={disabled ? reason : undefined}
      />
      {error && (
        <span role="alert" className="err small">
          {error}
        </span>
      )}
    </span>
  )
}
