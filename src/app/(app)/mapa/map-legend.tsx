'use client'

import { matchesSearch } from '@/lib/stock'
import type { AreaData, IconData, MarkerData, Selection } from './map-types'

interface MapLegendProps {
  icons: IconData[]
  markers: MarkerData[]
  areas: AreaData[]
  query: string
  onQuery: (query: string) => void
  selection: Selection
  onSelect: (selection: NonNullable<Selection>) => void
  /** Empieza a colocar marcas de un icono (solo quien puede editar). */
  onPlace?: (iconId: number) => void
  showMarkers: boolean
  showAreas: boolean
  onShowMarkers: (value: boolean) => void
  onShowAreas: (value: boolean) => void
}

/** Leyenda del mapa: cada icono sale una vez (con cuántas marcas tiene); un clic vuela hasta él. */
export function MapLegend({
  icons,
  markers,
  areas,
  query,
  onQuery,
  selection,
  onSelect,
  onPlace,
  showMarkers,
  showAreas,
  onShowMarkers,
  onShowAreas,
}: MapLegendProps) {
  const visibleIcons = icons.filter((i) => matchesSearch({ name: `${i.title} ${i.note ?? ''}`, category: null }, query))
  const visibleAreas = areas.filter((a) => matchesSearch({ name: `${a.name} ${a.note ?? ''}`, category: null }, query))
  const countOf = (iconId: number) => markers.filter((m) => m.iconId === iconId).length
  const isOn = (type: 'icon' | 'area', id: number) => selection?.type === type && selection.id === id
  const selectedMarkerIcon = selection?.type === 'marker' ? markers.find((m) => m.id === selection.id)?.iconId : undefined

  return (
    <div className="legend">
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Buscar en la leyenda"
        aria-label="Buscar en la leyenda"
      />

      <section aria-labelledby="legend-icons">
        <div className="legend-head">
          <h3 id="legend-icons">Iconos ({visibleIcons.length})</h3>
          <label className="check small">
            <input type="checkbox" checked={showMarkers} onChange={(event) => onShowMarkers(event.target.checked)} /> Mostrar
          </label>
        </div>
        {visibleIcons.length === 0 ? (
          <p className="muted small">{icons.length === 0 ? 'Todavía no hay iconos.' : 'Nada coincide.'}</p>
        ) : (
          <ul>
            {visibleIcons.map((icon) => {
              const count = countOf(icon.id)
              const on = isOn('icon', icon.id) || selectedMarkerIcon === icon.id
              return (
                <li key={icon.id} className="legend-row">
                  <button
                    type="button"
                    className={`legend-item${on ? ' on' : ''}`}
                    aria-current={on ? 'true' : undefined}
                    onClick={() => onSelect({ type: 'icon', id: icon.id })}
                  >
                    <span className="legend-emoji" aria-hidden="true">
                      {icon.emoji}
                    </span>
                    <span className="legend-text">
                      <b>{icon.title}</b>
                      {icon.note && <small className="muted">{icon.note}</small>}
                    </span>
                    <span className="legend-count" aria-label={`${count} ${count === 1 ? 'marca' : 'marcas'} en el mapa`}>
                      ×{count}
                    </span>
                  </button>
                  {onPlace && (
                    <button
                      type="button"
                      className="legend-add"
                      aria-label={`Colocar otro «${icon.title}»`}
                      title="Colocar otro en el mapa"
                      onClick={() => onPlace(icon.id)}
                    >
                      ＋
                    </button>
                  )}
                </li>
              )
            })}
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
