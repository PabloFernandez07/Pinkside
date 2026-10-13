'use client'

import dynamic from 'next/dynamic'
import type { MapViewProps } from './map-types'

// Leaflet necesita `window`: el mapa solo se carga en el navegador.
const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => (
    <div className="card map-loading" role="status">
      <p className="muted">Cargando el mapa…</p>
    </div>
  ),
})

export function MapLoader(props: MapViewProps) {
  // Los iconos, marcas y zonas llegan del servidor ya listos; el mapa los lleva en su propio estado.
  return <MapView {...props} />
}
