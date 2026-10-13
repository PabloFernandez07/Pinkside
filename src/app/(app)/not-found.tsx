import Link from 'next/link'

export default function AppNotFound() {
  return (
    <div className="page">
      <section className="card state-card">
        <h1>No encontramos eso</h1>
        <p className="muted">Puede que se haya archivado o que el enlace ya no sea válido.</p>
        <div className="actions">
          <Link href="/resumen" className="btn">
            Volver al resumen
          </Link>
        </div>
      </section>
    </div>
  )
}
