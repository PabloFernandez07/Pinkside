'use client'

import { DEFAULT_EMOJI, EMOJI_PRESETS, MAP_COLORS, isSingleEmoji } from '@/lib/map'
import type { AreaDraft, IconDraft } from './map-types'

interface FormShellProps {
  title: string
  error: string | null
  pending: boolean
  saveLabel: string
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  children: React.ReactNode
}

/** Marco común de los dos formularios: título, errores y botones Guardar / Cancelar / Borrar. */
function FormShell({ title, error, pending, saveLabel, onSave, onCancel, onDelete, children }: FormShellProps) {
  return (
    <form
      className="map-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
      noValidate
    >
      <h3>{title}</h3>
      {children}
      {error && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn sm" aria-disabled={pending}>
          {pending ? 'Guardando…' : saveLabel}
        </button>
        <button type="button" className="btn sm ghost" onClick={onCancel}>
          Cancelar
        </button>
        {onDelete && (
          <button type="button" className="btn sm ghost danger" onClick={onDelete}>
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}

interface IconFormProps {
  draft: IconDraft
  error: string | null
  pending: boolean
  onChange: (draft: IconDraft) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
}

export function IconForm({ draft, error, pending, onChange, onSave, onCancel, onDelete }: IconFormProps) {
  const emojiOk = isSingleEmoji(draft.emoji)
  return (
    <FormShell
      title={draft.id === null ? 'Nuevo icono' : 'Editar icono'}
      error={error}
      pending={pending}
      saveLabel={draft.id === null ? 'Guardar y colocar' : 'Guardar icono'}
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
    >
      <p className="muted small">
        {draft.id === null
          ? 'Al guardarlo podrás colocarlo en el mapa tantas veces como quieras.'
          : 'Los cambios se aplican a todas las marcas de este icono.'}
      </p>
      <div className="field">
        <span className="label-like" id="map-emoji-label">
          Emoji
        </span>
        <div className="emoji-grid" role="group" aria-labelledby="map-emoji-label">
          {EMOJI_PRESETS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`emoji-btn${draft.emoji === emoji ? ' on' : ''}`}
              aria-pressed={draft.emoji === emoji}
              aria-label={`Usar ${emoji}`}
              onClick={() => onChange({ ...draft, emoji })}
            >
              {emoji}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={draft.emoji}
          onChange={(event) => onChange({ ...draft, emoji: event.target.value })}
          aria-label="Emoji personalizado"
          aria-invalid={!emojiOk}
          placeholder={DEFAULT_EMOJI}
          maxLength={16}
          autoComplete="off"
        />
        {!emojiOk && <span className="err">Escribe o elige un solo emoji</span>}
      </div>
      <div className="field">
        <label htmlFor="map-icon-title">Título</label>
        <input
          id="map-icon-title"
          type="text"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          maxLength={60}
          autoComplete="off"
          placeholder="NPC de armas, punto de encuentro…"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="map-icon-note">Nota (opcional)</label>
        <textarea
          id="map-icon-note"
          rows={3}
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          maxLength={500}
        />
      </div>
    </FormShell>
  )
}

interface AreaFormProps {
  draft: AreaDraft
  error: string | null
  pending: boolean
  onChange: (draft: AreaDraft) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
}

export function AreaForm({ draft, error, pending, onChange, onSave, onCancel, onDelete }: AreaFormProps) {
  return (
    <FormShell
      title={draft.id === null ? 'Nueva zona' : 'Editar zona'}
      error={error}
      pending={pending}
      saveLabel="Guardar zona"
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
    >
      {draft.id !== null && (
        <p className="muted small">
          Cambia la forma en el mapa: arrastra los puntos grandes, pulsa un punto pequeño para añadir otro y haz doble clic en un punto para quitarlo.
        </p>
      )}
      <div className="field">
        <label htmlFor="map-area-name">Nombre</label>
        <input
          id="map-area-name"
          type="text"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          maxLength={60}
          autoComplete="off"
          placeholder="Territorio norte, zona de reparto…"
          required
        />
      </div>
      <div className="field">
        <span className="label-like" id="map-color-label">
          Color
        </span>
        <div className="color-grid" role="radiogroup" aria-labelledby="map-color-label">
          {MAP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={draft.color === color}
              aria-label={`Color ${color}`}
              className={`color-btn${draft.color === color ? ' on' : ''}`}
              style={{ background: color }}
              onClick={() => onChange({ ...draft, color })}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="map-area-note">Nota (opcional)</label>
        <textarea
          id="map-area-note"
          rows={3}
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          maxLength={500}
        />
      </div>
    </FormShell>
  )
}
