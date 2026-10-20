'use client'

import { useState, useTransition } from 'react'
import { deleteBandAction } from '@/app/actions/band-actions'

/** Borra una acción del registro. Si el servidor la rechaza, muestra el motivo. */
export function DeleteAction({ id }: { id: number }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onClick = () =>
    startTransition(async () => {
      const result = await deleteBandAction(id)
      setError(result?.ok ? null : (result?.message ?? 'No se pudo borrar.'))
    })

  return (
    <>
      <button type="button" className="btn ghost sm" onClick={onClick} disabled={pending} aria-label="Borrar esta acción">
        Borrar
      </button>
      {error && (
        <span role="alert" className="err small">
          {error}
        </span>
      )}
    </>
  )
}
