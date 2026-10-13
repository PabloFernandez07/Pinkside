export default function Loading() {
  return (
    <div className="page" aria-busy="true">
      <div className="phead">
        <div className="skeleton sk-title" />
      </div>
      <div className="kpis">
        <div className="skeleton sk-kpi" />
        <div className="skeleton sk-kpi" />
        <div className="skeleton sk-kpi" />
      </div>
      <div className="grid g-two">
        <div className="skeleton sk-card" />
        <div className="skeleton sk-card" />
      </div>
      <p className="sr-only" role="status">
        Cargando…
      </p>
    </div>
  )
}
