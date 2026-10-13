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
  return <MapView {...props} />
}
