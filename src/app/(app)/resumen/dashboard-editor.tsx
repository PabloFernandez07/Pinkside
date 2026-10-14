'use client'

import { useState, useTransition } from 'react'
import { saveDashboardLayout } from '@/app/actions/dashboard'
import {
  DASHBOARD_CARDS,
  DEFAULT_LAYOUT,
  cardsInSlot,
  moveCard,
  parseLayout,
  serializeLayout,
  toggleCard,
  type CardId,
  type DashboardLayout,
  type Slot,
} from '@/lib/dashboard-layout'

const SLOTS: [Slot, string][] = [
  ['top', 'Parte superior'],
  ['left', 'Columna izquierda'],
  ['right', 'Columna derecha'],
]

const labelOf = (id: CardId) => DASHBOARD_CARDS.find((card) => card.id === id)?.label ?? id

interface DashboardEditorProps {
  /** Disposición guardada, tal como está en la cookie. */
  initial: string
  /** Tarjetas que este miembro puede ver (según sus permisos). */
  available: CardId[]
}

/** Elige qué tarjetas ve el miembro en su Resumen y en qué orden. Guarda al instante. */
export function DashboardEditor({ initial, available }: DashboardEditorProps) {
  const [layout, setLayout] = useState<DashboardLayout>(() => parseLayout(initial))
  const [pending, startTransition] = useTransition()
  const ids = new Set(available)

  const apply = (next: DashboardLayout) => {
    setLayout(next)
    startTransition(async () => void (await saveDashboardLayout(serializeLayout(next))))
  }

  return (
    <details className="customize">
      <summary className="btn sm ghost">Personalizar</summary>
      <div className="customize-body" aria-busy={pending}>
        {SLOTS.map(([slot, title]) => {
          const cards = cardsInSlot(layout, slot, ids)
          if (cards.length === 0) return null
          return (
            <fieldset key={slot}>
              <legend>{title}</legend>
              <ul>
                {cards.map((id, index) => (
                  <li key={id}>
                    <label>
                      <input type="checkbox" checked={!layout.hidden.includes(id)} onChange={() => apply(toggleCard(layout, id))} />
                      <span>{labelOf(id)}</span>
                    </label>
                    <span className="move-btns">
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={index === 0}
                        aria-label={`Subir ${labelOf(id)}`}
                        onClick={() => apply(moveCard(layout, id, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={index === cards.length - 1}
                        aria-label={`Bajar ${labelOf(id)}`}
                        onClick={() => apply(moveCard(layout, id, 1))}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </fieldset>
          )
        })}
        <button type="button" className="btn sm ghost" onClick={() => apply(DEFAULT_LAYOUT)}>
          Restablecer
        </button>
      </div>
    </details>
  )
}
