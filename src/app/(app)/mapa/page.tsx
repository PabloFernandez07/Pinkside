import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { canSeeMap, requireMember } from '@/lib/access'
import { parsePoints } from '@/lib/map'
import { createClient } from '@/lib/supabase/server'
import { MapLoader } from './map-loader'
import type { AreaData, IconData, MarkerData } from './map-types'

export const metadata: Metadata = { title: 'Mapa' }

export default async function MapaPage() {
  const access = await requireMember('active')
  if (!canSeeMap(access)) redirect('/resumen')
  const { profile, permissions } = access
  const supabase = await createClient()

  const [iconsRes, markersRes, areasRes] = await Promise.all([
    supabase.from('map_icons').select('id, emoji, title, note, author_name').order('id'),
    supabase.from('map_markers').select('id, icon_id, x, y, author_name').order('id'),
    supabase.from('map_areas').select('id, name, note, color, points, author_name').order('id'),
  ])
  if (iconsRes.error || markersRes.error || areasRes.error) throw new Error('No se pudo cargar el mapa')

  const icons: IconData[] = iconsRes.data.map((row) => ({
    id: row.id,
    emoji: row.emoji,
    title: row.title,
    note: row.note,
    authorName: row.author_name,
  }))
  const markers: MarkerData[] = markersRes.data.map((row) => ({
    id: row.id,
    iconId: row.icon_id,
    x: row.x,
    y: row.y,
    authorName: row.author_name,
  }))
  const areas: AreaData[] = areasRes.data
    .map((row) => ({
      id: row.id,
      name: row.name,
      note: row.note,
      color: row.color,
      points: parsePoints(row.points),
      authorName: row.author_name,
    }))
    .filter((area) => area.points.length >= 3)
  const currentName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.discord_username || 'Miembro'

  return (
    <div className="page">
      <div className="phead">
        <h1>Mapa</h1>
        <p>Iconos y zonas de la banda sobre el mapa de Los Santos</p>
      </div>
      <MapLoader initialIcons={icons} initialMarkers={markers} initialAreas={areas} canEdit={permissions.has('map.edit')} currentName={currentName} />
    </div>
  )
}
