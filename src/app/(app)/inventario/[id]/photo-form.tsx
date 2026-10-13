'use client'

import { startTransition, useActionState, useState, type ChangeEvent } from 'react'
import { removeItemPhoto, setItemPhoto } from '@/app/actions/item-photo'
import { FormMessage } from '@/components/field'
import { ItemThumb } from '@/components/item-thumb'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { ITEM_IMAGE_SIZE } from '@/lib/images'

/** Recorta al centro (cuadrado) y reduce a 128 px en el navegador: la subida pesa unos pocos KB. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = ITEM_IMAGE_SIZE
  canvas.height = ITEM_IMAGE_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE)
  bitmap.close()
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/webp', 0.85),
  )
}

interface PhotoFormProps {
  itemId: number
  itemName: string
  imagePath: string | null
}

/** Foto del item: se elige un archivo, se reduce solo y se guarda al momento. */
export function PhotoForm({ itemId, itemName, imagePath }: PhotoFormProps) {
  const [state, run, pending] = useActionState(setItemPhoto, undefined)
  const remove = useManualForm(removeItemPhoto)
  const [localError, setLocalError] = useState<string | null>(null)

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setLocalError(null)
    try {
      const blob = await shrink(file)
      const data = new FormData()
      data.set('itemId', String(itemId))
      data.set('photo', new File([blob], 'foto', { type: blob.type }))
      startTransition(() => run(data))
    } catch {
      setLocalError('No se pudo leer esa imagen. Prueba con otra (JPG, PNG o WebP).')
    }
  }

  return (
    <div className="photo-edit">
      <ItemThumb name={itemName} path={imagePath} size="lg" />
      <div className="field">
        <label htmlFor="f-photo">Foto del item</label>
        <input id="f-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} disabled={pending} />
        <small className="muted">Se recorta en cuadrado y se reduce sola; con una foto pequeña basta.</small>
      </div>
      {imagePath && (
        <form onSubmit={remove.onSubmit} noValidate>
          <input type="hidden" name="itemId" value={itemId} />
          <SubmitButton pending={remove.pending} pendingLabel="Quitando…" className="btn sm ghost">
            Quitar foto
          </SubmitButton>
        </form>
      )}
      <div className="wide" role="status">
        {localError ? <p className="notice bad">{localError}</p> : <FormMessage state={state ?? remove.state} />}
      </div>
    </div>
  )
}
