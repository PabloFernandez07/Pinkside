import Link from 'next/link'
import { METRICS, type MetricKey, type Progress } from '@/lib/community'

export interface WelcomeStep {
  label: string
  done: boolean
  href: string
}

interface PathCardProps {
  /** Pasos de bienvenida (solo para el rango más bajo). */
  steps: WelcomeStep[] | null
  /** Requisitos del siguiente rango con el avance del miembro. */
  next: { rankName: string; ready: boolean; items: (Progress & { metric: MetricKey })[] } | null
}

export function PathCard({ steps, next }: PathCardProps) {
  const doneSteps = steps?.filter((step) => step.done).length ?? 0
  return (
    <section className="card path">
      <header>
        <h2>Tu camino</h2>
        {next && <span className="hint">hacia {next.rankName}</span>}
      </header>
      <div className="scroll path-body">
        {steps && (
          <div>
            <h3>
              Primeros pasos <span className="muted small">{doneSteps} de {steps.length}</span>
            </h3>
            <ul className="steps">
              {steps.map((step) => (
                <li key={step.label} className={step.done ? 'done' : undefined}>
                  <span aria-hidden="true">{step.done ? '✓' : '○'}</span>
                  {step.done ? (
                    <span>
                      {step.label}
                      <span className="sr-only"> (hecho)</span>
                    </span>
                  ) : (
                    <Link href={step.href}>{step.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {next && (
          <div>
            <h3>Para ascender a {next.rankName}</h3>
            <ul className="reqs">
              {next.items.map((item) => (
                <li key={item.metric}>
                  <span>
                    {METRICS[item.metric].label}
                    <span className="mono small muted">
                      {' '}
                      {Math.min(item.current, item.target)} / {item.target}
                    </span>
                  </span>
                  {item.done ? (
                    <span className="chip ok">Hecho</span>
                  ) : (
                    <span className="bar" aria-hidden="true">
                      <i style={{ width: `${item.percent}%` }} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {next.ready && (
              <p className="notice ok">Cumples todos los requisitos. Pídele a un líder tu ascenso a {next.rankName}.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
