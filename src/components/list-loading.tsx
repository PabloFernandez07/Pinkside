/** Esqueleto de las pantallas de lista (título + tarjeta grande): se pinta al instante mientras llegan los datos. */
export function ListLoading() {
  return (
    <div className="page" aria-busy="true">
      <div className="phead">
        <div className="skeleton sk-title" />
      </div>
      <div className="skeleton sk-card" />
      <p className="sr-only" role="status">
        Cargando…
      </p>
    </div>
  )
}
