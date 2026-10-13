'use client'

import { useState, useTransition } from 'react'
import { setMapAccess } from '@/app/actions/map-access'

interface MapAccessToggleProps {
  memberId: string
  name: string
  allowed: boolean
  /** Quien puede dar el acceso (Líder y Lugarteniente) siempre ve el mapa: no se puede apagar. */
  locked: boolean
}

/** Interruptor que guarda al instante y se deshace solo si el servidor lo rechaza. */
export function MapAccessToggle({ memberId, name, allowed, locked }: MapAccessToggleProps) {
  const [value, setValue] = useState(allowed || locked)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (pending) return
    const next = event.target.checked
    setValue(next)
    setError(null)
    startTransition(async () => {
      const result = await setMapAccess({ memberId, allowed: next })
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
        checked={value}
        onChange={onChange}
        disabled={locked}
        aria-busy={pending}
        aria-label={`${name} ve el mapa`}
        title={locked ? 'Su rango ve siempre el mapa' : undefined}
      />
      {error && (
        <span role="alert" className="err small">
          {error}
        </span>
      )}
    </span>
  )
}
