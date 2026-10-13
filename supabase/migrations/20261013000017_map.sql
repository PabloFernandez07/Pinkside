-- Pinkside · Mapa de GTA V: iconos con nota y zonas dibujadas.
-- Las posiciones se guardan como proporción del mapa (0 a 1, con el origen arriba a la izquierda), así que no
-- dependen del zoom ni de la resolución de las teselas. Todos los miembros ven el mapa; editarlo exige `map.edit`.

insert into public.permissions (key, label, description)
values ('map.edit', 'Editar el mapa', 'Añadir, mover y borrar iconos y zonas del mapa');
insert into public.rank_permissions (rank_id, permission)
select id, 'map.edit' from public.ranks where level >= 50;

create table public.map_markers (
  id integer generated always as identity primary key,
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  emoji text not null check (char_length(emoji) between 1 and 16),
  title text not null check (char_length(title) between 1 and 60),
  note text check (note is null or char_length(note) between 1 and 500),
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index map_markers_author_id_idx on public.map_markers (author_id);
create trigger map_markers_set_updated_at before update on public.map_markers
  for each row execute function public.set_updated_at();

create table public.map_areas (
  id integer generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  note text check (note is null or char_length(note) between 1 and 500),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  -- [[x, y], ...] con 3 a 60 vértices; la función que escribe valida cada uno.
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 3 and 60),
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index map_areas_author_id_idx on public.map_areas (author_id);
create trigger map_areas_set_updated_at before update on public.map_areas
  for each row execute function public.set_updated_at();

alter table public.map_markers enable row level security;
alter table public.map_areas enable row level security;
create policy map_markers_select on public.map_markers for select to authenticated
  using ((select public.is_active_member()));
create policy map_areas_select on public.map_areas for select to authenticated
  using ((select public.is_active_member()));
revoke all on public.map_markers, public.map_areas from anon, authenticated;
grant select on public.map_markers, public.map_areas to authenticated;

-- Crea (p_id nulo) o actualiza un icono. Devuelve su id.
create function public.save_map_marker(
  p_id integer, p_x double precision, p_y double precision, p_emoji text, p_title text, p_note text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id integer;
  v_author text;
begin
  if not public.has_perm('map.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_id is null then
    if (select count(*) from public.map_markers) >= 500 then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
    select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
    into v_author from public.profiles where id = v_uid;
    insert into public.map_markers (x, y, emoji, title, note, author_id, author_name)
    values (p_x, p_y, btrim(coalesce(p_emoji, '')), btrim(coalesce(p_title, '')),
            nullif(btrim(coalesce(p_note, '')), ''), v_uid, v_author)
    returning id into v_id;
  else
    update public.map_markers
    set x = p_x, y = p_y, emoji = btrim(coalesce(p_emoji, '')), title = btrim(coalesce(p_title, '')),
        note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'El icono no existe' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

create function public.delete_map_marker(p_id integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('map.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.map_markers where id = p_id;
  if not found then
    raise exception 'El icono no existe' using errcode = 'P0002';
  end if;
end $$;

-- Crea (p_id nulo) o actualiza una zona. Al actualizar, p_points nulo conserva los vértices actuales.
create function public.save_map_area(
  p_id integer, p_name text, p_note text, p_color text, p_points jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id integer;
  v_author text;
begin
  if not public.has_perm('map.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_points is not null then
    if jsonb_typeof(p_points) is distinct from 'array' or jsonb_array_length(p_points) not between 3 and 60
       or exists (
         select 1 from jsonb_array_elements(p_points) e
         where jsonb_typeof(e) is distinct from 'array' or jsonb_array_length(e) <> 2
            or jsonb_typeof(e -> 0) is distinct from 'number' or jsonb_typeof(e -> 1) is distinct from 'number'
            or (e ->> 0)::double precision not between 0 and 1 or (e ->> 1)::double precision not between 0 and 1
       ) then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
  end if;
  if p_id is null then
    if p_points is null or (select count(*) from public.map_areas) >= 200 then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
    select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
    into v_author from public.profiles where id = v_uid;
    insert into public.map_areas (name, note, color, points, author_id, author_name)
    values (btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_note, '')), ''), lower(coalesce(p_color, '')),
            p_points, v_uid, v_author)
    returning id into v_id;
  else
    update public.map_areas
    set name = btrim(coalesce(p_name, '')), note = nullif(btrim(coalesce(p_note, '')), ''),
        color = lower(coalesce(p_color, '')), points = coalesce(p_points, points)
    where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'La zona no existe' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
exception
  when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

create function public.delete_map_area(p_id integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('map.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.map_areas where id = p_id;
  if not found then
    raise exception 'La zona no existe' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function
  public.save_map_marker(integer, double precision, double precision, text, text, text),
  public.delete_map_marker(integer),
  public.save_map_area(integer, text, text, text, jsonb),
  public.delete_map_area(integer)
from public, anon;
grant execute on function
  public.save_map_marker(integer, double precision, double precision, text, text, text),
  public.delete_map_marker(integer),
  public.save_map_area(integer, text, text, text, jsonb),
  public.delete_map_area(integer)
to authenticated;
