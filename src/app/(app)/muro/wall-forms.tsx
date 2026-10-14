'use client'

import { useState, useTransition } from 'react'
import { deleteWallPost, postWall, setWallPinned, toggleReaction } from '@/app/actions/community'
import { FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { WALL_EMOJIS } from '@/lib/community'

export function WallForm() {
  const { state, pending, onSubmit } = useManualForm(postWall, { resetOnSuccess: true })
  const error = state?.errors?.body?.[0]
  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <div className="field wide">
        <label htmlFor="wall-body">Nuevo aviso</label>
        <textarea
          id="wall-body"
          name="body"
          rows={3}
          maxLength={500}
          placeholder="Reunión el sábado, nuevo punto de venta…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'wall-body-err' : undefined}
        />
        {error && (
          <span id="wall-body-err" className="err">
            {error}
          </span>
        )}
      </div>
      <label className="row wide">
        <span>
          <b>Fijar arriba</b>
          <small>Se queda el primero del muro y sale en el resumen</small>
        </span>
        <input type="checkbox" name="pinned" className="sw" />
      </label>
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Publicando…">
          Publicar
        </SubmitButton>
      </div>
    </form>
  )
}

interface PostControlsProps {
  id: number
  pinned: boolean
  canModerate: boolean
  canDelete: boolean
}

export function PostControls({ id, pinned, canModerate, canDelete }: PostControlsProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (action: () => ReturnType<typeof deleteWallPost>) =>
    startTransition(async () => {
      setError(null)
      const result = await action()
      if (!result?.ok) setError(result?.message ?? 'No se pudo completar la acción.')
    })

  return (
    <span className="post-controls">
      {canModerate && (
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => run(() => setWallPinned({ id, pinned: !pinned }))}>
          {pinned ? 'Desfijar' : 'Fijar'}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="btn sm ghost danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm('¿Borrar este aviso?')) run(() => deleteWallPost({ id }))
          }}
        >
          Borrar
        </button>
      )}
      {error && (
        <span role="alert" className="err small">
          {error}
        </span>
      )}
    </span>
  )
}

interface ReactionBarProps {
  postId: number
  counts: Record<string, number>
  mine: string[]
}

export function ReactionBar({ postId, counts, mine }: ReactionBarProps) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="reactions" role="group" aria-label="Reacciones">
      {WALL_EMOJIS.map((emoji) => {
        const active = mine.includes(emoji)
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction${active ? ' on' : ''}`}
            aria-pressed={active}
            disabled={pending}
            onClick={() => startTransition(async () => void (await toggleReaction({ postId, emoji })))}
          >
            <span aria-hidden="true">{emoji}</span>
            {counts[emoji] ? <span className="mono small">{counts[emoji]}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
