'use client'

import { useState } from 'react'
import { createUrgentRequest } from '@/app/actions/urgent'
import { Field, FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { buildDm, type UrgentPriority } from '@/lib/urgent'

export interface RecipientOption {
  id: string
  name: string
  /** El miembro permite avisos por MD (si no, el pedido le sale en la web pero no recibe MD). */
  dmUrgent: boolean
}

interface UrgentFormProps {
  recipients: RecipientOption[]
  items: { id: number; name: string }[]
  authorName: string
  initialTitle?: string
  initialItemId?: number | null
}

export function UrgentForm({ recipients, items, authorName, initialTitle = '', initialItemId = null }: UrgentFormProps) {
  const { state, pending, onSubmit } = useManualForm(createUrgentRequest)
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<UrgentPriority>('critical')
  const [itemId, setItemId] = useState(initialItemId === null ? '' : String(initialItemId))
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(recipients.map((r) => r.id)))

  // Tras crear el pedido se vacía el texto (se conservan prioridad y destinatarios) y el aviso de éxito sigue visible.
  const [handled, setHandled] = useState(state)
  if (state?.ok && state !== handled) {
    setHandled(state)
    setTitle('')
    setBody('')
    setItemId('')
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const itemName = items.find((item) => String(item.id) === itemId)?.name ?? null
  const preview = buildDm({ priority, title: title || 'Título del pedido', body: body || null, authorName, itemName })

  return (
    <form onSubmit={onSubmit} className="form" noValidate>
      <Field
        name="title"
        label="¿Qué hace falta?"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={80}
        autoComplete="off"
        placeholder="Falta acero para el crafteo de hoy"
        error={state?.errors?.title}
        required
      />
      <div className="field">
        <label htmlFor="f-priority">Prioridad</label>
        <select id="f-priority" name="priority" value={priority} onChange={(e) => setPriority(e.target.value as UrgentPriority)}>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
        </select>
      </div>
      <div className="field wide">
        <label htmlFor="f-body">Detalle (opcional)</label>
        <textarea
          id="f-body"
          name="body"
          rows={2}
          maxLength={500}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={state?.errors?.body ? true : undefined}
        />
        {state?.errors?.body && <span className="err">{state.errors.body[0]}</span>}
      </div>
      <div className="field wide">
        <label htmlFor="f-itemId">Item relacionado (opcional)</label>
        <select id="f-itemId" name="itemId" value={itemId} onChange={(event) => setItemId(event.target.value)}>
          <option value="">Ninguno</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="wide recipients">
        <legend>
          Avisar a ({selected.size} de {recipients.length})
        </legend>
        <div className="actions">
          <button type="button" className="btn sm ghost" onClick={() => setSelected(new Set(recipients.map((r) => r.id)))}>
            Todos
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setSelected(new Set())}>
            Ninguno
          </button>
        </div>
        <ul>
          {recipients.map((recipient) => (
            <li key={recipient.id}>
              <label>
                <input
                  type="checkbox"
                  name="recipients"
                  value={recipient.id}
                  checked={selected.has(recipient.id)}
                  onChange={() => toggle(recipient.id)}
                />
                {recipient.name}
                {!recipient.dmUrgent && <span className="muted small"> · sin MD</span>}
              </label>
            </li>
          ))}
        </ul>
        {state?.errors?.recipients && <span className="err">{state.errors.recipients[0]}</span>}
      </fieldset>

      <div className="wide">
        <p className="hint">Vista previa del MD de Discord</p>
        <p className="dm-heading">{preview.heading.replaceAll('**', '')}</p>
        <div className="dm-embed">
          <b>{preview.title}</b>
          {preview.description && <p>{preview.description}</p>}
          {preview.fields.map((field) => (
            <p key={field.name}>
              <b>{field.name}</b>
              <br />
              {field.value}
            </p>
          ))}
          <small>{preview.footer}</small>
        </div>
      </div>
      <div className="wide">
        <FormMessage state={state} />
      </div>
      <div className="wide">
        <SubmitButton pending={pending} pendingLabel="Creando…" className="btn block">
          {selected.size > 0 ? `Crear y avisar a ${selected.size} ${selected.size === 1 ? 'persona' : 'personas'}` : 'Crear pedido urgente'}
        </SubmitButton>
      </div>
    </form>
  )
}
