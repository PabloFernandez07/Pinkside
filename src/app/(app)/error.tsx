'use client'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <section className="card state-card" role="alert">
        <h1>Algo ha fallado</h1>
        <p className="muted">No hemos podido cargar esta pantalla. Tus datos están a salvo; inténtalo de nuevo.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={reset}>
            Reintentar
          </button>
        </div>
      </section>
    </div>
  )
}
