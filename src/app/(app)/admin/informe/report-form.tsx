'use client'

import { useRef, useState } from 'react'
import { saveWeeklyReport } from '@/app/actions/report'
import { FormMessage } from '@/components/field'
import { SubmitButton } from '@/components/submit-button'
import { useManualForm } from '@/components/use-manual-form'
import { emptySections, formatReport, linesOf, REPORT_SECTIONS, type ReportSections } from '@/lib/report'

interface ReportFormProps {
  week: string
  initial: ReportSections
  /** Líneas generadas con las acciones apuntadas esa semana. */
  suggestions: ReportSections
}

/** Un cuadro de texto por sección, un punto por línea. «Copiar» deja el informe listo para pegar en Discord. */
export function ReportForm({ week, initial, suggestions }: ReportFormProps) {
  const { state, pending, onSubmit } = useManualForm(saveWeeklyReport)
  const formRef = useRef<HTMLFormElement>(null)
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null)
  const suggested = REPORT_SECTIONS.reduce((sum, { id }) => sum + suggestions[id].length, 0)

  // Añade al final de cada sección las líneas apuntadas que todavía no estén escritas.
  const addSuggestions = () => {
    for (const { id } of REPORT_SECTIONS) {
      const field = formRef.current?.elements.namedItem(id)
      if (!(field instanceof HTMLTextAreaElement)) continue
      const current = linesOf(field.value)
      field.value = [...current, ...suggestions[id].filter((line) => !current.includes(line))].join('\n')
      field.rows = Math.max(3, linesOf(field.value).length + 1)
    }
  }

  const copy = async () => {
    const data = new FormData(formRef.current ?? undefined)
    const sections = emptySections()
    for (const { id } of REPORT_SECTIONS) sections[id] = linesOf(String(data.get(id) ?? ''))
    try {
      await navigator.clipboard.writeText(formatReport(week, sections))
      setCopied('ok')
    } catch {
      setCopied('error')
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="form" noValidate>
      <input type="hidden" name="week" value={week} />
      <div className="wide actions">
        <button type="button" className="btn ghost" onClick={addSuggestions} disabled={suggested === 0}>
          Añadir acciones apuntadas
        </button>
        <small className="muted">
          {suggested === 0
            ? 'Nadie ha apuntado acciones esta semana.'
            : `${suggested} línea${suggested === 1 ? '' : 's'} generada${suggested === 1 ? '' : 's'} desde «Acciones». Revísalas y guarda.`}
        </small>
      </div>
      {REPORT_SECTIONS.map(({ id, emoji, title }) => (
        <div key={id} className="field wide">
          <label htmlFor={`rep-${id}`}>
            {emoji} {title}
          </label>
          <textarea
            id={`rep-${id}`}
            name={id}
            rows={Math.max(3, initial[id].length + 1)}
            defaultValue={initial[id].join('\n')}
            placeholder="Un punto por línea. Déjalo vacío si no hubo nada: la sección no saldrá."
          />
        </div>
      ))}
      <div className="wide">
        <FormMessage state={state} />
        {copied && (
          <p role={copied === 'ok' ? 'status' : 'alert'} className={copied === 'ok' ? 'notice ok' : 'notice bad'}>
            {copied === 'ok' ? 'Copiado: pégalo en el canal de Discord.' : 'No se pudo copiar. Selecciona el texto a mano.'}
          </p>
        )}
      </div>
      <div className="wide actions">
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Guardar
        </SubmitButton>
        <button type="button" className="btn ghost" onClick={copy}>
          Copiar para Discord
        </button>
      </div>
    </form>
  )
}
