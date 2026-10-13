'use client'

import { matchesSearch } from '@/lib/stock'
import type { AreaData, MarkerData, Selection } from './map-types'

interface MapLegendProps {
  markers: MarkerData[]
  areas: AreaData[]
  query: string
  onQuery: (query: string) => void
  selection: Selection
  onSelect: (selection: NonNullable<Selection>) => void
  showMarkers: boolean
  showAreas: boolean
  onShowMarkers: (value: boolean) => void
  onShowAreas: (value: boolean) => void
}

/** Leyenda del mapa: lista de iconos y zonas con su nota; un clic vuela hasta el elemento. */
export function MapLegend({
  markers,
  areas,
  query,
  onQuery,
  selection,
  onSelect,
  showMarkers,
  showAreas,
  onShowMarkers,
  onShowAreas,
}: MapLegendProps) {
  const visibleMarkers = markers.filter((m) => matchesSearch({ name: `${m.title} ${m.note ?? ''}`, category: null }, query))
  const visibleAreas = areas.filter((a) => matchesSearch({ name: `${a.name} ${a.note ?? ''}`, category: null }, query))
  const isOn = (type: 'marker' | 'area', id: number) => selection?.type === type && selection.id === id

  return (
    <div className="legend">
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Buscar en la leyenda"
        aria-label="Buscar en la leyenda"
      />

      <section aria-labelledby="legend-markers">
        <div className="legend-head">
          <h3 id="legend-markers">Iconos ({visibleMarkers.length})</h3>
          <label className="check small">
            <input type="checkbox" checked={showMarkers} onChange={(event) => onShowMarkers(event.target.checked)} /> Mostrar
          </label>
        </div>
        {visibleMarkers.length === 0 ? (
          <p className="muted small">{markers.length === 0 ? 'Todavía no hay iconos.' : 'Nada coincide.'}</p>
        ) : (
          <ul>
            {visibleMarkers.map((marker) => (
              <li key={marker.id}>
                <button
                  type="button"
                  className={`legend-item${isOn('marker', marker.id) ? ' on' : ''}`}
                  aria-current={isOn('marker', marker.id) ? 'true' : undefined}
                  onClick={() => onSelect({ type: 'marker', id: marker.id })}
                >
                  <span className="legend-emoji" aria-hidden="true">
                    {marker.emoji}
                  </span>
                  <span className="legend-text">
                    <b>{marker.title}</b>
                    {marker.note && <small className="muted">{marker.note}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="legend-areas">
        <div className="legend-head">
          <h3 id="legend-areas">Zonas ({visibleAreas.length})</h3>
          <label className="check small">
            <input type="checkbox" checked={showAreas} onChange={(event) => onShowAreas(event.target.checked)} /> Mostrar
          </label>
        </div>
        {visibleAreas.length === 0 ? (
          <p className="muted small">{areas.length === 0 ? 'Todavía no hay zonas.' : 'Nada coincide.'}</p>
        ) : (
          <ul>
            {visibleAreas.map((area) => (
              <li key={area.id}>
                <button
                  type="button"
                  className={`legend-item${isOn('area', area.id) ? ' on' : ''}`}
                  aria-current={isOn('area', area.id) ? 'true' : undefined}
                  onClick={() => onSelect({ type: 'area', id: area.id })}
                >
                  <span className="legend-swatch" style={{ background: area.color }} aria-hidden="true" />
                  <span className="legend-text">
                    <b>{area.name}</b>
                    {area.note && <small className="muted">{area.note}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
