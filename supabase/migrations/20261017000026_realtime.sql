-- Realtime: avisa a las sesiones abiertas cuando cambia la caja o el mapa.
-- El aviso solo dispara una recarga; los datos se siguen leyendo con las consultas normales (y su RLS).
alter publication supabase_realtime add table
  public.cash_movements, public.map_icons, public.map_markers, public.map_areas;
