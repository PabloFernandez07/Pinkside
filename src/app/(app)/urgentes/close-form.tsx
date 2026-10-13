'use client'

import { closeUrgentRequest } from '@/app/actions/urgent'
import { FormMessage } from '@/components/field'
import { useManualForm } from '@/components/use-manual-form'

/** Marca un pedido abierto como cubierto o lo cancela (dos formularios mínimos con el mismo envío). */
export function CloseForm({ requestId }: { requestId: number }) {
  const { state, pending, onSubmit } = useManualForm(closeUrgentRequest)
  return (
    <div className="close-forms">
      {(
        [
          ['covered', 'Cubierto', 'btn sm'],
          ['cancelled', 'Descartar', 'btn sm ghost'],
        ] as const
      ).map(([status, label, className]) => (
        <form key={status} onSubmit={onSubmit} noValidate>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="status" value={status} />
          <button className={className} type="submit" disabled={pending}>
            {label}
          </button>
        </form>
      ))}
      <FormMessage state={state} />
    </div>
  )
}
