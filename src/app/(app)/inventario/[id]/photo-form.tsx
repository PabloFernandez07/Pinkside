'use client'

import { removeItemPhoto, setItemPhoto } from '@/app/actions/item-photo'
import { FormMessage } from '@/components/field'
import { ItemThumb } from '@/components/item-thumb'
import { PhotoPicker } from '@/components/photo-picker'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'

interface PhotoFormProps {
  itemId: number
  itemName: string
  imagePath: string | null
}

/** Foto del item: se adjunta un archivo o se pega una URL y se guarda con el botón. */
export function PhotoForm({ itemId, itemName, imagePath }: PhotoFormProps) {
  const save = useManualForm(setItemPhoto, { resetOnSuccess: true })
  const remove = useManualForm(removeItemPhoto)

  return (
    <div className="photo-edit">
      <ItemThumb name={itemName} path={imagePath} size="lg" />
      <form onSubmit={save.onSubmit} className="photo-edit-form" noValidate>
        <input type="hidden" name="itemId" value={itemId} />
        <PhotoPicker label="Foto del item" />
        <SubmitButton pending={save.pending} pendingLabel="Guardando…" className="btn sm">
          Guardar foto
        </SubmitButton>
      </form>
      {imagePath && (
        <form onSubmit={remove.onSubmit} noValidate>
          <input type="hidden" name="itemId" value={itemId} />
          <SubmitButton pending={remove.pending} pendingLabel="Quitando…" className="btn sm ghost">
            Quitar foto
          </SubmitButton>
        </form>
      )}
      <div className="wide" role="status">
        <FormMessage state={save.state ?? remove.state} />
      </div>
    </div>
  )
}
