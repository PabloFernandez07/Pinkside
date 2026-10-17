'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  deleteArea,
  deleteIcon,
  deleteMarker,
  saveArea,
  saveIcon,
  saveMarker,
  type MapActionResult,
} from '@/app/actions/map'
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
import { AreaForm, IconForm } from './map-forms'
import { MapLegend } from './map-legend'
import type { AreaData, AreaDraft, IconData, IconDraft, MapViewProps, MarkerData, Selection } from './map-types'

type Mode = 'idle' | 'placing' | 'drawing'

interface MapApi {
  select(selection: NonNullable<Selection>): void
  moveMarker(id: number, at: L.LatLng): void
  clickMap(at: L.LatLng): void
}

const noop = () => {}

const WORLD_BOUNDS = L.latLngBounds([-WORLD, 0], [0, WORLD])
const MAX_VIEW_ZOOM = MAX_ZOOM + 2 // Más allá del zoom 5 no hay teselas nuevas: se amplía la última.
const MAX_AREA_POINTS = 60

const latLngs = (points: readonly Point[]): [number, number][] => points.map(([x, y]) => toLatLng(x, y))

/** Icono redondo con el emoji. El emoji se inserta como texto (nunca como HTML). */
function pinIcon(emoji: string, selected: boolean): L.DivIcon {
  const pin = document.createElement('div')
  pin.className = `map-pin ${selected ? 'selected' : 'normal'}`
  const glyph = document.createElement('span')
  glyph.textContent = emoji
  pin.append(glyph)
  return L.divIcon({ html: pin, className: 'map-pin-wrap', iconSize: [38, 38], iconAnchor: [19, 19] })
}

/** Tirador de un vértice (grande) o del punto medio de un lado (pequeño, al pulsarlo crea un vértice). */
const handleIcon = (kind: 'vertex' | 'mid'): L.DivIcon => {
  const size = kind === 'vertex' ? 16 : 11
  return L.divIcon({ className: `map-handle ${kind}`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

const MIN_AREA_POINTS = 3

const firstError = (result: Extract<MapActionResult, { ok: false }>): string =>
  result.message ?? Object.values(result.errors ?? {}).flat().find(Boolean) ?? 'No se pudo guardar.'

export default function MapView({ initialIcons, initialMarkers, initialAreas, canEdit, currentName }: MapViewProps) {
  const [icons, setIcons] = useState<IconData[]>(initialIcons)
  const [markers, setMarkers] = useState<MarkerData[]>(initialMarkers)
  const [areas, setAreas] = useState<AreaData[]>(initialAreas)
  const [style, setStyle] = useState<TileStyle>('satelite')
  const [mode, setMode] = useState<Mode>('idle')
  const [placingIconId, setPlacingIconId] = useState<number | null>(null)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [iconDraft, setIconDraft] = useState<IconDraft | null>(null)
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
  // Recuerda por qué marca de un icono se va al pulsarlo varias veces en la leyenda.
  const cycle = useRef({ iconId: -1, index: -1 })
  // Los manejadores de Leaflet se registran una sola vez: siempre llaman a la versión más reciente de estas funciones.
  const api = useRef<MapApi>({ select: noop, moveMarker: noop, clickMap: noop })

  const iconsById = useMemo(() => new Map(icons.map((icon) => [icon.id, icon])), [icons])
  const selectedIcon = selection?.type === 'icon' ? iconsById.get(selection.id) : undefined
  const selectedMarker = selection?.type === 'marker' ? markers.find((m) => m.id === selection.id) : undefined
  const markerIcon = selectedMarker ? iconsById.get(selectedMarker.iconId) : undefined
  const selectedArea = selection?.type === 'area' ? areas.find((a) => a.id === selection.id) : undefined
  const placingIcon = placingIconId === null ? undefined : iconsById.get(placingIconId)
  const editing = iconDraft !== null || areaDraft !== null
  const detailIcon = selectedIcon ?? markerIcon
  const pinsOfDetailIcon = detailIcon ? markers.filter((m) => m.iconId === detailIcon.id).length : 0
  const editingAreaId = areaDraft?.id ?? null // zona cuya forma se está editando: se dibuja el borrador en su lugar

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
      const icon = iconsById.get(marker.iconId)
      if (!icon) continue
      // Al seleccionar un icono se resaltan todas sus marcas.
      const isSelected =
        (selection?.type === 'marker' && selection.id === marker.id) ||
        (selection?.type === 'icon' && selection.id === marker.iconId)
      L.marker(toLatLng(marker.x, marker.y), {
        icon: pinIcon(icon.emoji, isSelected),
        draggable: canEdit && mode === 'idle',
        interactive: mode === 'idle',
        title: icon.title,
        riseOnHover: true,
      })
        .on('click', () => api.current.select({ type: 'marker', id: marker.id }))
        .on('dragend', (event) => api.current.moveMarker(marker.id, (event.target as L.Marker).getLatLng()))
        .addTo(group)
    }
  }, [markers, iconsById, showMarkers, selection, canEdit, mode])

  useEffect(() => {
    const group = areaGroup.current
    if (!group) return
    group.clearLayers()
    if (!showAreas) return
    for (const area of areas) {
      if (area.id === editingAreaId) continue
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
  }, [areas, showAreas, selection, mode, editingAreaId])

  // Borrador: puntos que se están marcando o zona recién dibujada que aún no se ha guardado.
  useEffect(() => {
    const group = draftGroup.current
    if (!group) return
    group.clearLayers()
    const points = mode === 'drawing' ? draftPoints : (areaDraft?.points ?? [])
    const color = areaDraft?.color ?? DEFAULT_AREA_COLOR
    if (points.length >= 3) {
      const polygon = L.polygon(latLngs(points), { color, weight: 3, dashArray: '6 6', fillColor: color, fillOpacity: 0.25, interactive: false }).addTo(group)
      // Zona existente: vértices arrastrables, doble clic (o clic derecho) para quitar uno y puntos medios para añadir.
      if (mode === 'idle' && areaDraft?.id != null) {
        const live = points.map((p): Point => [p[0], p[1]])
        const setPoints = (next: readonly Point[]) => setAreaDraft((draft) => (draft ? { ...draft, points: [...next] } : draft))
        live.forEach(([x, y], index) => {
          const remove = () => live.length > MIN_AREA_POINTS && setPoints(live.filter((_, i) => i !== index))
          L.marker(toLatLng(x, y), { icon: handleIcon('vertex'), draggable: true, title: 'Arrastra para mover · doble clic para quitar' })
            .on('drag', (event) => {
              const at = (event.target as L.Marker).getLatLng()
              const moved = fromLatLng(at.lat, at.lng)
              live[index] = [moved.x, moved.y]
              polygon.setLatLngs(latLngs(live))
            })
            .on('dragend', () => setPoints(live))
            .on('dblclick', remove)
            .on('contextmenu', remove)
            .addTo(group)
        })
        if (live.length < MAX_AREA_POINTS) {
          live.forEach(([x, y], index) => {
            const [nx, ny] = live[(index + 1) % live.length]
            L.marker(toLatLng((x + nx) / 2, (y + ny) / 2), { icon: handleIcon('mid'), title: 'Pulsa para añadir un punto' })
              .on('click', () => setPoints([...live.slice(0, index + 1), [(x + nx) / 2, (y + ny) / 2], ...live.slice(index + 1)]))
              .addTo(group)
          })
        }
      }
    } else if (points.length === 2) {
      L.polyline(latLngs(points), { color, weight: 3, dashArray: '6 6', interactive: false }).addTo(group)
    }
    if (mode === 'drawing') {
      for (const [x, y] of points) {
        L.circleMarker(toLatLng(x, y), { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, interactive: false }).addTo(group)
      }
    }
  }, [mode, draftPoints, areaDraft])

  useEffect(() => {
    containerRef.current?.classList.toggle('map-crosshair', mode !== 'idle')
  }, [mode])

  useEffect(() => {
    if (mode === 'idle') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode('idle')
        setPlacingIconId(null)
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
    if (target.type === 'area') {
      const area = areas.find((a) => a.id === target.id)
      if (area) map.flyToBounds(L.latLngBounds(latLngs(area.points)), { maxZoom: 5, padding: [40, 40] })
      return
    }
    // Un icono tiene varias marcas: cada pulsación en la leyenda va a la siguiente.
    const pins = target.type === 'icon' ? markers.filter((m) => m.iconId === target.id) : markers.filter((m) => m.id === target.id)
    if (pins.length === 0) return
    const index = target.type === 'icon' && cycle.current.iconId === target.id ? (cycle.current.index + 1) % pins.length : 0
    if (target.type === 'icon') cycle.current = { iconId: target.id, index }
    map.flyTo(toLatLng(pins[index].x, pins[index].y), Math.max(map.getZoom(), 4))
  }

  /** `fly`: desde la leyenda se vuela hasta el elemento; al pulsarlo en el mapa no se mueve la vista. */
  const select = (target: NonNullable<Selection>, fly: boolean) => {
    setSelection(target)
    setConfirming(false)
    setError(null)
    setIconDraft(null)
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
      const result = await saveMarker({ markerId: id, iconId: marker.iconId, x, y })
      if (!result.ok) {
        setMarkers(previous) // se deshace el movimiento si el servidor lo rechaza
        setError(firstError(result))
      }
    })
  }

  /** Coloca otra marca del icono y sigue en modo colocación para poner todas las que hagan falta. */
  const placeMarker = (iconId: number, x: number, y: number) => {
    setError(null)
    startTransition(async () => {
      const result = await saveMarker({ markerId: null, iconId, x, y })
      if (!result.ok) return setError(firstError(result))
      setMarkers((current) => [...current, { id: result.id, iconId, x, y, authorName: currentName }])
    })
  }

  const clickMap = (at: L.LatLng) => {
    const { x, y } = fromLatLng(at.lat, at.lng)
    if (mode === 'placing' && placingIconId !== null) {
      placeMarker(placingIconId, x, y)
    } else if (mode === 'drawing') {
      setDraftPoints((points) => (points.length >= MAX_AREA_POINTS ? points : [...points, [x, y]]))
    } else {
      setSelection(null)
      setConfirming(false)
    }
  }

  useEffect(() => {
    api.current = { select: (target) => select(target, false), moveMarker, clickMap }
  })

  const resetTools = () => {
    setMode('idle')
    setPlacingIconId(null)
    setDraftPoints([])
    setIconDraft(null)
    setAreaDraft(null)
    setError(null)
  }

  const startPlacing = (iconId: number) => {
    resetTools()
    setMode('placing')
    setPlacingIconId(iconId)
    setSelection({ type: 'icon', id: iconId })
    setConfirming(false)
  }

  const startNewIcon = () => {
    resetTools()
    setSelection(null)
    setIconDraft({ id: null, emoji: DEFAULT_EMOJI, title: '', note: '' })
  }

  const startDrawing = () => {
    resetTools()
    setMode('drawing')
    setSelection(null)
  }

  const finishDrawing = () => {
    if (draftPoints.length < 3) return
    setAreaDraft({ id: null, points: draftPoints, name: '', note: '', color: DEFAULT_AREA_COLOR })
    setDraftPoints([])
    setMode('idle')
  }

  const submitIcon = () => {
    if (!iconDraft) return
    const draft = iconDraft
    setError(null)
    startTransition(async () => {
      const result = await saveIcon({ iconId: draft.id, emoji: draft.emoji, title: draft.title, note: draft.note })
      if (!result.ok) return setError(firstError(result))
      const previous = icons.find((i) => i.id === result.id)
      const saved: IconData = {
        id: result.id,
        emoji: draft.emoji.trim(),
        title: draft.title.trim(),
        note: draft.note.trim() || null,
        authorName: previous?.authorName ?? currentName,
      }
      setIcons((current) => (previous ? current.map((i) => (i.id === saved.id ? saved : i)) : [...current, saved]))
      setIconDraft(null)
      // Un icono nuevo se coloca enseguida; uno editado solo se queda seleccionado.
      if (previous) setSelection({ type: 'icon', id: saved.id })
      else startPlacing(saved.id)
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
        points: JSON.stringify(draft.points),
      })
      if (!result.ok) return setError(firstError(result))
      const previous = areas.find((a) => a.id === result.id)
      const saved: AreaData = {
        id: result.id,
        name: draft.name.trim(),
        note: draft.note.trim() || null,
        color: draft.color,
        points: draft.points,
        authorName: previous?.authorName ?? currentName,
      }
      setAreas((current) => (previous ? current.map((a) => (a.id === saved.id ? saved : a)) : [...current, saved]))
      setAreaDraft(null)
      setSelection({ type: 'area', id: saved.id })
    })
  }

  /** Borra lo seleccionado: una marca, un icono (con todas sus marcas) o una zona. */
  const removeSelected = () => {
    if (!selection) return
    const target = selection
    setError(null)
    startTransition(async () => {
      const result = await (target.type === 'marker'
        ? deleteMarker({ id: target.id })
        : target.type === 'icon'
          ? deleteIcon({ id: target.id })
          : deleteArea({ id: target.id }))
      if (!result.ok) return setError(firstError(result))
      if (target.type === 'marker') setMarkers((current) => current.filter((m) => m.id !== target.id))
      else if (target.type === 'icon') {
        setIcons((current) => current.filter((i) => i.id !== target.id))
        setMarkers((current) => current.filter((m) => m.iconId !== target.id))
      } else setAreas((current) => current.filter((a) => a.id !== target.id))
      setSelection(null)
      setConfirming(false)
    })
  }

  const startEditing = () => {
    if (detailIcon) {
      setIconDraft({ id: detailIcon.id, emoji: detailIcon.emoji, title: detailIcon.title, note: detailIcon.note ?? '' })
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
    mode === 'placing' && placingIcon
      ? `Haz clic en el mapa para colocar «${placingIcon.title}». Puedes poner todos los que quieras (Esc para terminar)`
      : mode === 'drawing'
        ? `Haz clic para marcar los vértices de la zona: ${draftPoints.length} (mínimo 3). Esc para cancelar`
        : null

  const detailTitle = detailIcon ? `${detailIcon.emoji} ${detailIcon.title}` : selectedArea?.name
  const detailNote = detailIcon ? detailIcon.note : selectedArea?.note
  const deleteWarning =
    selection?.type === 'icon' && pinsOfDetailIcon > 0
      ? `Se borrará el icono y sus ${pinsOfDetailIcon} ${pinsOfDetailIcon === 1 ? 'marca' : 'marcas'}. ¿Seguro?`
      : '¿Borrar de verdad?'

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
          <div className="map-sticky">
          {canEdit && (
            <div className="map-tools">
              <button type="button" className="btn sm" onClick={startNewIcon} disabled={mode !== 'idle' || editing}>
                ＋ Nuevo icono
              </button>
              <button type="button" className="btn sm ghost" onClick={startDrawing} disabled={mode !== 'idle' || editing}>
                ⬠ Dibujar zona
              </button>
            </div>
          )}

          {mode === 'placing' && placingIcon && (
            <div className="map-form">
              <h3>
                Colocando {placingIcon.emoji} {placingIcon.title}
              </h3>
              <p className="muted small">
                Cada clic en el mapa pone una marca nueva. Ahora hay {markers.filter((m) => m.iconId === placingIcon.id).length}.
              </p>
              <div className="actions">
                <button type="button" className="btn sm" onClick={resetTools}>
                  Terminar
                </button>
              </div>
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
                <button type="button" className="btn sm ghost" onClick={resetTools}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {iconDraft && (
            <IconForm draft={iconDraft} error={error} pending={pending} onChange={setIconDraft} onSave={submitIcon} onCancel={resetTools} />
          )}
          {areaDraft && (
            <AreaForm draft={areaDraft} error={error} pending={pending} onChange={setAreaDraft} onSave={submitArea} onCancel={resetTools} />
          )}

          {!editing && mode === 'idle' && (detailIcon || selectedArea) && (
            <div className="map-detail">
              <h3>{detailTitle}</h3>
              {detailNote && <p className="map-note">{detailNote}</p>}
              {detailIcon && (
                <p className="muted small">
                  {pinsOfDetailIcon} {pinsOfDetailIcon === 1 ? 'marca' : 'marcas'} en el mapa
                  {selectedMarker ? ` · esta la puso ${selectedMarker.authorName}` : ` · creado por ${detailIcon.authorName}`}
                </p>
              )}
              {selectedArea && <p className="muted small">Añadida por {selectedArea.authorName}</p>}
              {canEdit && !confirming && (
                <div className="actions">
                  {detailIcon && (
                    <button type="button" className="btn sm" onClick={() => startPlacing(detailIcon.id)}>
                      Colocar otro
                    </button>
                  )}
                  <button type="button" className="btn sm ghost" onClick={startEditing}>
                    {detailIcon ? 'Editar icono' : 'Editar'}
                  </button>
                  <button type="button" className="btn sm ghost danger" onClick={() => setConfirming(true)}>
                    {selectedMarker ? 'Borrar esta marca' : detailIcon ? 'Borrar icono' : 'Borrar'}
                  </button>
                </div>
              )}
              {canEdit && confirming && (
                <div className="actions" role="alert">
                  <span className="small">{selectedMarker ? '¿Borrar esta marca?' : deleteWarning}</span>
                  <button type="button" className="btn sm ghost danger" onClick={removeSelected} aria-disabled={pending}>
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
          </div>

          <MapLegend
            icons={icons}
            markers={markers}
            areas={areas}
            query={query}
            onQuery={setQuery}
            selection={selection}
            onSelect={(target) => select(target, true)}
            onPlace={canEdit ? startPlacing : undefined}
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
