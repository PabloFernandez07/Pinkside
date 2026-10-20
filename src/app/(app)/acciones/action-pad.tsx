'use client'

import { useState, useTransition } from 'react'
import { logBandAction } from '@/app/actions/band-actions'
import { BAND_ACTIONS, MAX_ACTION_NOTE, MAX_ACTION_QTY } from '@/lib/band-actions'
import { REPORT_SECTIONS } from '@/lib/report'

/** Botonera: un toque apunta la acción con la cantidad y la nota de arriba. */
export function ActionPad() {
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const log = (kind: string, label: string) => {
    if (pending) return
    const amount = Number(qty)
    startTransition(async () => {
      const result = await logBandAction({ kind, qty: amount, note })
      if (result?.ok) {
        setMessage({ ok: true, text: `Apuntado: ${label}${amount > 1 ? ` ×${amount}` : ''}` })
        setNote('')
        setQty('1')
      } else {
        setMessage({ ok: false, text: result?.message ?? 'No se pudo apuntar la acción.' })
      }
    })
  }

  return (
    <div className="pad">
      <div className="pad-opts">
        <div className="field">
          <label htmlFor="pad-qty">Veces</label>
          <input
            id="pad-qty"
            value={qty}
            onChange={(event) => setQty(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="field grow">
          <label htmlFor="pad-note">Nota (opcional)</label>
          <input
            id="pad-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_ACTION_NOTE}
            autoComplete="off"
            placeholder="Con quién, dónde, cuánto…"
          />
        </div>
      </div>
      <p className="pad-msg small" role={message?.ok === false ? 'alert' : 'status'}>
        {message && <span className={message.ok ? 'ok' : 'err'}>{message.text}</span>}
      </p>
      {REPORT_SECTIONS.map(({ id, emoji, title }) => {
        const actions = BAND_ACTIONS.filter((action) => action.section === id)
        if (actions.length === 0) return null
        return (
          <section key={id} className="pad-group">
            <h3>
              {emoji} {title}
            </h3>
            <div className="pad-buttons">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="btn ghost"
                  disabled={pending || Number(qty) < 1 || Number(qty) > MAX_ACTION_QTY}
                  onClick={() => log(action.id, action.label)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
