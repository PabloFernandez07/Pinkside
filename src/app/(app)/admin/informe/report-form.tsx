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
}

/** Un cuadro de texto por sección, un punto por línea. «Copiar» deja el informe listo para pegar en Discord. */
export function ReportForm({ week, initial }: ReportFormProps) {
  const { state, pending, onSubmit } = useManualForm(saveWeeklyReport)
  const formRef = useRef<HTMLFormElement>(null)
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null)

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
