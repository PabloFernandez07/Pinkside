'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ITEM_IMAGE_SIZE } from '@/lib/images'

/** Recorta al centro (cuadrado) y reduce a 128 px en el navegador: lo que se sube pesa unos pocos KB. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = ITEM_IMAGE_SIZE
  canvas.height = ITEM_IMAGE_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, ITEM_IMAGE_SIZE, ITEM_IMAGE_SIZE)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('blob'))), 'image/webp', 0.85),
  )
  return new File([blob], 'foto', { type: blob.type })
}

interface PhotoPickerProps {
  label?: string
  error?: string[]
  /** Nombre del campo de archivo (el de URL es `${name}Url`). */
  name?: string
}

/**
 * Foto por archivo adjunto o por dirección web. Solo se envía uno de los dos campos (el que está visible).
 * Al adjuntar, la imagen se reduce en el navegador y se sustituye en el propio `<input>` antes de enviar.
 */
export function PhotoPicker({ label = 'Foto (opcional)', error, name = 'photo' }: PhotoPickerProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [preview, setPreview] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Si el formulario se vacía tras guardar, también se vacía la vista previa.
  useEffect(() => {
    const form = root.current?.closest('form')
    const clear = () => {
      setPreview(null)
      setMode('file')
    }
    form?.addEventListener('reset', clear)
    return () => form?.removeEventListener('reset', clear)
  }, [])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return setPreview(null)
    let ready = file
    try {
      ready = await shrink(file)
      const transfer = new DataTransfer()
      transfer.items.add(ready)
      input.files = transfer.files
    } catch {
      // Formato que el navegador no sabe leer (p. ej. HEIC): se envía tal cual y decide el servidor.
    }
    setPreview(URL.createObjectURL(ready))
  }

  const id = `f-${name}`
  return (
    <div className="field wide photo-picker" ref={root}>
      <span className="label-like" id={`${id}-label`}>
        {label}
      </span>
      <div className="photo-picker-row" role="group" aria-labelledby={`${id}-label`}>
        {preview && <Image src={preview} alt="Vista previa de la foto" width={40} height={40} unoptimized className="thumb md" />}
        <div className="seg">
          <button type="button" className={`seg-btn${mode === 'file' ? ' on' : ''}`} aria-pressed={mode === 'file'} onClick={() => setMode('file')}>
            Adjuntar
          </button>
          <button type="button" className={`seg-btn${mode === 'url' ? ' on' : ''}`} aria-pressed={mode === 'url'} onClick={() => setMode('url')}>
            Desde una URL
          </button>
        </div>
        {mode === 'file' ? (
          <input id={id} type="file" name={name} accept="image/jpeg,image/png,image/webp" onChange={onPick} aria-describedby={error ? `${id}-err` : undefined} />
        ) : (
          <input
            id={id}
            type="text"
            inputMode="url"
            name={`${name}Url`}
            autoComplete="off"
            placeholder="https://…/imagen.png"
            maxLength={500}
            aria-describedby={error ? `${id}-err` : undefined}
            aria-invalid={error ? true : undefined}
          />
        )}
      </div>
      <small className="muted">Se recorta en cuadrado y se reduce sola; con una foto pequeña basta.</small>
      {error && (
        <span id={`${id}-err`} className="err">
          {error[0]}
        </span>
      )}
    </div>
  )
}
