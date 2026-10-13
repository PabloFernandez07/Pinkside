'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useState, useTransition } from 'react'
import { deleteArea, deleteMarker, saveArea, saveMarker, type MapActionResult } from '@/app/actions/map'
import {
  DEFAULT_AREA_COLOR,
  DEFAULT_EMOJI,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_STYLES,
  WORLD,
  fromLatLng,
  tileUrl,
  toLatLng,
  type Point,
  type TileStyle,
} from '@/lib/map'
import { AreaForm, MarkerForm } from './map-forms'
import { MapLegend } from './map-legend'
import type { AreaData, AreaDraft, MapViewProps, MarkerData, MarkerDraft, Selection } from './map-types'

type Mode = 'idle' | 'placing' | 'drawing'

const WORLD_BOUNDS = L.latLngBounds([-WORLD, 0], [0, WORLD])
const MAX_VIEW_ZOOM = MAX_ZOOM + 2 // Más allá del zoom 5 no hay teselas nuevas: se amplía la última.
const MAX_AREA_POINTS = 60

interface MapApi {
  select(selection: NonNullable<Selection>): void
  moveMarker(id: number, at: L.LatLng): void
  clickMap(at: L.LatLng): void
  dragDraft(at: L.LatLng): void
}

const noop = () => {}

const latLngs = (points: readonly Point[]): [number, number][] => points.map(([x, y]) => toLatLng(x, y))

/** Icono redondo con el emoji. El emoji se inserta como texto (nunca como HTML). */
function pinIcon(emoji: string, state: 'normal' | 'selected' | 'draft'): L.DivIcon {
  const pin = document.createElement('div')
  pin.className = `map-pin ${state}`
  const glyph = document.createElement('span')
  glyph.textContent = emoji
  pin.append(glyph)
  return L.divIcon({ html: pin, className: 'map-pin-wrap', iconSize: [38, 38], iconAnchor: [19, 19] })
}

const firstError = (result: Extract<MapActionResult, { ok: false }>): string =>
  result.message ?? Object.values(result.errors ?? {}).flat().find(Boolean) ?? 'No se pudo guardar.'

export default function MapView({ initialMarkers, initialAreas, canEdit, currentName }: MapViewProps) {
  const [markers, setMarkers] = useState<MarkerData[]>(initialMarkers)
  const [areas, setAreas] = useState<AreaData[]>(initialAreas)
  const [style, setStyle] = useState<TileStyle>('satelite')
  const [mode, setMode] = useState<Mode>('idle')
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [markerDraft, setMarkerDraft] = useState<MarkerDraft | null>(null)
  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [confirming, setConfirming] = useState(false)
  const [query, setQuery] = useState('')
  const [showMarkers, setShowMarkers] = useState(true)
  const [showAreas, setShowAreas] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerGroup = useRef<L.LayerGroup | null>(null)
  const areaGroup = useRef<L.LayerGroup | null>(null)
  const draftGroup = useRef<L.LayerGroup | null>(null)
  // Los manejadores de Leaflet se registran una sola vez: siempre llaman a la versión más reciente de estas funciones.
  const api = useRef<MapApi>({ select: noop, moveMarker: noop, clickMap: noop, dragDraft: noop })

  const selectedMarker = selection?.type === 'marker' ? markers.find((m) => m.id === selection.id) : undefined
  const selectedArea = selection?.type === 'area' ? areas.find((a) => a.id === selection.id) : undefined
  const editing = markerDraft !== null || areaDraft !== null
  const markerDraftId = markerDraft?.id ?? null
  const draftX = markerDraft?.x ?? null
  const draftY = markerDraft?.y ?? null
  const draftEmoji = markerDraft?.emoji ?? null

  // --- Mapa, teselas y capas ---
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const map = L.map(element, {
      crs: L.CRS.Simple,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_VIEW_ZOOM,
      maxBounds: WORLD_BOUNDS.pad(0.15),
      maxBoundsViscosity: 1,
      zoomSnap: 0.5,
      attributionControl: false,
    })
    map.fitBounds(WORLD_BOUNDS)
    map.on('click', (event: L.LeafletMouseEvent) => api.current.clickMap(event.latlng))
    markerGroup.current = L.layerGroup().addTo(map)
    areaGroup.current = L.layerGroup().addTo(map)
    draftGroup.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerGroup.current = areaGroup.current = draftGroup.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = L.tileLayer(tileUrl(style), {
      tileSize: 256,
      minZoom: MIN_ZOOM,
      maxNativeZoom: MAX_ZOOM,
      maxZoom: MAX_VIEW_ZOOM,
      noWrap: true,
      bounds: WORLD_BOUNDS,
    }).addTo(map)
    layer.bringToBack()
    return () => {
      layer.remove()
    }
  }, [style])

  useEffect(() => {
    const group = markerGroup.current
    if (!group) return
    group.clearLayers()
    if (!showMarkers) return
    for (const marker of markers) {
      if (marker.id === markerDraftId) continue // mientras se edita, lo representa el icono del borrador
      const isSelected = selection?.type === 'marker' && selection.id === marker.id
      L.marker(toLatLng(marker.x, marker.y), {
        icon: pinIcon(marker.emoji, isSelected ? 'selected' : 'normal'),
        draggable: canEdit && mode === 'idle',
        interactive: mode === 'idle',
        title: marker.title,
        riseOnHover: true,
      })
        .on('click', () => api.current.select({ type: 'marker', id: marker.id }))
        .on('dragend', (event) => api.current.moveMarker(marker.id, (event.target as L.Marker).getLatLng()))
        .addTo(group)
    }
  }, [markers, showMarkers, selection, canEdit, mode, markerDraftId])

  useEffect(() => {
    const group = areaGroup.current
    if (!group) return
    group.clearLayers()
    if (!showAreas) return
    for (const area of areas) {
      const isSelected = selection?.type === 'area' && selection.id === area.id
      L.polygon(latLngs(area.points), {
        color: area.color,
        weight: isSelected ? 4 : 2,
        fillColor: area.color,
        fillOpacity: isSelected ? 0.4 : 0.22,
        interactive: mode === 'idle',
      })
        .bindTooltip(area.name, { sticky: true })
        .on('click', () => api.current.select({ type: 'area', id: area.id }))
        .addTo(group)
    }
  }, [areas, showAreas, selection, mode])

  // Borrador: puntos que se están marcando, zona recién dibujada e icono que se está colocando o editando.
  useEffect(() => {
    const group = draftGroup.current
    if (!group) return
    group.clearLayers()
    const points = mode === 'drawing' ? draftPoints : (areaDraft?.points ?? [])
    const color = areaDraft?.color ?? DEFAULT_AREA_COLOR
    if (points.length >= 3) {
      L.polygon(latLngs(points), { color, weight: 3, dashArray: '6 6', fillColor: color, fillOpacity: 0.25, interactive: false }).addTo(group)
    } else if (points.length === 2) {
      L.polyline(latLngs(points), { color, weight: 3, dashArray: '6 6', interactive: false }).addTo(group)
    }
    if (mode === 'drawing') {
      for (const [x, y] of points) {
        L.circleMarker(toLatLng(x, y), { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, interactive: false }).addTo(group)
      }
    }
    if (draftX !== null && draftY !== null && draftEmoji !== null) {
      L.marker(toLatLng(draftX, draftY), { icon: pinIcon(draftEmoji || DEFAULT_EMOJI, 'draft'), draggable: true })
        .on('dragend', (event) => api.current.dragDraft((event.target as L.Marker).getLatLng()))
        .addTo(group)
    }
  }, [mode, draftPoints, areaDraft, draftX, draftY, draftEmoji])

  useEffect(() => {
    containerRef.current?.classList.toggle('map-crosshair', mode !== 'idle')
  }, [mode])

  useEffect(() => {
    if (mode === 'idle') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode('idle')
        setDraftPoints([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  // --- Acciones del usuario ---
  const flyTo = (target: NonNullable<Selection>) => {
    const map = mapRef.current
    if (!map) return
    if (target.type === 'marker') {
      const marker = markers.find((m) => m.id === target.id)
      if (marker) map.flyTo(toLatLng(marker.x, marker.y), Math.max(map.getZoom(), 4))
    } else {
      const area = areas.find((a) => a.id === target.id)
      if (area) map.flyToBounds(L.latLngBounds(latLngs(area.points)), { maxZoom: 5, padding: [40, 40] })
    }
  }

  /** `fly`: desde la leyenda se vuela hasta el elemento; al pulsarlo en el mapa no se mueve la vista. */
  const select = (target: NonNullable<Selection>, fly: boolean) => {
    setSelection(target)
    setConfirming(false)
    setError(null)
    setMarkerDraft(null)
    setAreaDraft(null)
    if (fly) flyTo(target)
  }

  const moveMarker = (id: number, at: L.LatLng) => {
    const marker = markers.find((m) => m.id === id)
    if (!marker) return
    const { x, y } = fromLatLng(at.lat, at.lng)
    const previous = markers
    setMarkers((current) => current.map((m) => (m.id === id ? { ...m, x, y } : m)))
    startTransition(async () => {
      const result = await saveMarker({ markerId: id, x, y, emoji: marker.emoji, title: marker.title, note: marker.note })
      if (!result.ok) {
        setMarkers(previous) // se deshace el movimiento si el servidor lo rechaza
        setError(firstError(result))
      }
    })
  }

  const clickMap = (at: L.LatLng) => {
    const { x, y } = fromLatLng(at.lat, at.lng)
    if (mode === 'placing') {
      setMarkerDraft({ id: null, x, y, emoji: DEFAULT_EMOJI, title: '', note: '' })
      setMode('idle')
      setSelection(null)
    } else if (mode === 'drawing') {
      setDraftPoints((points) => (points.length >= MAX_AREA_POINTS ? points : [...points, [x, y]]))
    } else {
      setSelection(null)
      setConfirming(false)
    }
  }

  const dragDraft = (at: L.LatLng) => {
    const { x, y } = fromLatLng(at.lat, at.lng)
    setMarkerDraft((draft) => (draft ? { ...draft, x, y } : draft))
  }

  useEffect(() => {
    api.current = { select: (target) => select(target, false), moveMarker, clickMap, dragDraft }
  })

  const startPlacing = () => {
    setMode('placing')
    setMarkerDraft(null)
    setAreaDraft(null)
    setSelection(null)
    setError(null)
  }

  const startDrawing = () => {
    setMode('drawing')
    setDraftPoints([])
    setMarkerDraft(null)
    setAreaDraft(null)
    setSelection(null)
    setError(null)
  }

  const finishDrawing = () => {
    if (draftPoints.length < 3) return
    setAreaDraft({ id: null, points: draftPoints, name: '', note: '', color: DEFAULT_AREA_COLOR })
    setDraftPoints([])
    setMode('idle')
  }

  const cancelAll = () => {
    setMode('idle')
    setDraftPoints([])
    setMarkerDraft(null)
    setAreaDraft(null)
    setError(null)
  }

  const submitMarker = () => {
    if (!markerDraft) return
    const draft = markerDraft
    setError(null)
    startTransition(async () => {
      const result = await saveMarker({ markerId: draft.id, x: draft.x, y: draft.y, emoji: draft.emoji, title: draft.title, note: draft.note })
      if (!result.ok) return setError(firstError(result))
      const previous = markers.find((m) => m.id === result.id)
      const saved: MarkerData = {
        id: result.id,
        x: draft.x,
        y: draft.y,
        emoji: draft.emoji.trim(),
        title: draft.title.trim(),
        note: draft.note.trim() || null,
        authorName: previous?.authorName ?? currentName,
      }
      setMarkers((current) => (previous ? current.map((m) => (m.id === saved.id ? saved : m)) : [...current, saved]))
      setMarkerDraft(null)
      setSelection({ type: 'marker', id: saved.id })
    })
  }

  const submitArea = () => {
    if (!areaDraft) return
    const draft = areaDraft
    setError(null)
    startTransition(async () => {
      const result = await saveArea({
        areaId: draft.id,
        name: draft.name,
        note: draft.note,
        color: draft.color,
        points: draft.id === null ? JSON.stringify(draft.points) : null,
      })
      if (!result.ok) return setError(firstError(result))
      const previous = areas.find((a) => a.id === result.id)
      const saved: AreaData = {
        id: result.id,
        name: draft.name.trim(),
        note: draft.note.trim() || null,
        color: draft.color,
        points: previous?.points ?? draft.points,
        authorName: previous?.authorName ?? currentName,
      }
      setAreas((current) => (previous ? current.map((a) => (a.id === saved.id ? saved : a)) : [...current, saved]))
      setAreaDraft(null)
      setSelection({ type: 'area', id: saved.id })
    })
  }

  const remove = (target: NonNullable<Selection>) => {
    setError(null)
    startTransition(async () => {
      const result = await (target.type === 'marker' ? deleteMarker({ id: target.id }) : deleteArea({ id: target.id }))
      if (!result.ok) return setError(firstError(result))
      if (target.type === 'marker') setMarkers((current) => current.filter((m) => m.id !== target.id))
      else setAreas((current) => current.filter((a) => a.id !== target.id))
      setMarkerDraft(null)
      setAreaDraft(null)
      setSelection(null)
      setConfirming(false)
    })
  }

  const startEditing = () => {
    if (selectedMarker) {
      setMarkerDraft({
        id: selectedMarker.id,
        x: selectedMarker.x,
        y: selectedMarker.y,
        emoji: selectedMarker.emoji,
        title: selectedMarker.title,
        note: selectedMarker.note ?? '',
      })
    } else if (selectedArea) {
      setAreaDraft({
        id: selectedArea.id,
        points: selectedArea.points,
        name: selectedArea.name,
        note: selectedArea.note ?? '',
        color: selectedArea.color,
      })
    }
  }

  const hint =
    mode === 'placing'
      ? 'Haz clic en el mapa para colocar el icono (Esc para cancelar)'
      : mode === 'drawing'
        ? `Haz clic para marcar los vértices de la zona: ${draftPoints.length} (mínimo 3). Esc para cancelar`
        : null

  return (
    <div className="grid g-map">
      <section className="card map-card">
        <header>
          <h2>Mapa de Los Santos</h2>
          <div className="seg" role="group" aria-label="Estilo del mapa">
            {TILE_STYLES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`seg-btn${style === option.id ? ' on' : ''}`}
                aria-pressed={style === option.id}
                onClick={() => setStyle(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>
        <div className="map-box" data-style={style}>
          <div ref={containerRef} className="map-canvas" role="application" aria-label="Mapa de GTA V" />
          {hint && (
            <p className="map-hint" role="status">
              {hint}
            </p>
          )}
        </div>
      </section>

      <aside className="card map-side" aria-label="Leyenda y herramientas del mapa">
        <div className="scroll scroll-top">
          {canEdit && (
            <div className="map-tools">
              <button type="button" className="btn sm" onClick={startPlacing} disabled={mode === 'placing' || editing}>
                ＋ Añadir icono
              </button>
              <button type="button" className="btn sm ghost" onClick={startDrawing} disabled={mode === 'drawing' || editing}>
                ⬠ Dibujar zona
              </button>
            </div>
          )}

          {mode === 'drawing' && (
            <div className="map-form">
              <h3>Dibujando una zona</h3>
              <p className="muted small">Marca los vértices en el mapa, en orden. Necesitas al menos 3 puntos.</p>
              <div className="actions">
                <button type="button" className="btn sm" onClick={finishDrawing} disabled={draftPoints.length < 3}>
                  Terminar zona
                </button>
                <button type="button" className="btn sm ghost" onClick={() => setDraftPoints((points) => points.slice(0, -1))} disabled={draftPoints.length === 0}>
                  Deshacer punto
                </button>
                <button type="button" className="btn sm ghost" onClick={cancelAll}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {markerDraft && (
            <MarkerForm
              draft={markerDraft}
              error={error}
              pending={pending}
              onChange={setMarkerDraft}
              onSave={submitMarker}
              onCancel={cancelAll}
              onDelete={markerDraft.id === null ? undefined : () => remove({ type: 'marker', id: markerDraft.id as number })}
            />
          )}
          {areaDraft && (
            <AreaForm
              draft={areaDraft}
              error={error}
              pending={pending}
              onChange={setAreaDraft}
              onSave={submitArea}
              onCancel={cancelAll}
              onDelete={areaDraft.id === null ? undefined : () => remove({ type: 'area', id: areaDraft.id as number })}
            />
          )}

          {!editing && (selectedMarker || selectedArea) && (
            <div className="map-detail">
              <h3>{selectedMarker ? `${selectedMarker.emoji} ${selectedMarker.title}` : selectedArea?.name}</h3>
              {(selectedMarker?.note ?? selectedArea?.note) && <p className="map-note">{selectedMarker?.note ?? selectedArea?.note}</p>}
              <p className="muted small">Añadido por {selectedMarker?.authorName ?? selectedArea?.authorName}</p>
              {canEdit && !confirming && (
                <div className="actions">
                  <button type="button" className="btn sm ghost" onClick={startEditing}>
                    Editar
                  </button>
                  <button type="button" className="btn sm ghost danger" onClick={() => setConfirming(true)}>
                    Borrar
                  </button>
                </div>
              )}
              {canEdit && confirming && selection && (
                <div className="actions" role="alert">
                  <span className="small">¿Borrar de verdad?</span>
                  <button type="button" className="btn sm ghost danger" onClick={() => remove(selection)} aria-disabled={pending}>
                    Sí, borrar
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => setConfirming(false)}>
                    No
                  </button>
                </div>
              )}
            </div>
          )}

          {error && !editing && (
            <p role="alert" className="err">
              {error}
            </p>
          )}

          <MapLegend
            markers={markers}
            areas={areas}
            query={query}
            onQuery={setQuery}
            selection={selection}
            onSelect={(target) => select(target, true)}
            showMarkers={showMarkers}
            showAreas={showAreas}
            onShowMarkers={setShowMarkers}
            onShowAreas={setShowAreas}
          />
          {!canEdit && <p className="muted small">Tu rango solo permite ver el mapa.</p>}
        </div>
      </aside>
    </div>
  )
}
