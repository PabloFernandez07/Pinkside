-- Pinkside · Mapa: iconos reutilizables.
-- Un icono (emoji + título + nota) se define una vez y sale en la leyenda; sus marcas en el mapa son tantas como
-- haga falta. Antes cada marca llevaba sus propios datos: cada una existente pasa a ser un icono con una marca.

create table public.map_icons (
  id integer generated always as identity primary key,
  emoji text not null check (char_length(emoji) between 1 and 16),
  title text not null check (char_length(title) between 1 and 60),
  note text check (note is null or char_length(note) between 1 and 500),
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index map_icons_author_id_idx on public.map_icons (author_id);
create trigger map_icons_set_updated_at before update on public.map_icons
  for each row execute function public.set_updated_at();

alter table public.map_icons enable row level security;
create policy map_icons_select on public.map_icons for select to authenticated
  using ((select public.is_active_member()));
revoke all on public.map_icons from anon, authenticated;
grant select on public.map_icons to authenticated;

-- Las marcas apuntan a su icono; al borrar un icono se borran todas sus marcas.
alter table public.map_markers add column icon_id integer references public.map_icons (id) on delete cascade;

do $$
declare
  m record;
  v_icon integer;
begin
  for m in select * from public.map_markers order by id loop
    insert into public.map_icons (emoji, title, note, author_id, author_name, created_at)
    values (m.emoji, m.title, m.note, m.author_id, m.author_name, m.created_at)
    returning id into v_icon;
    update public.map_markers set icon_id = v_icon where id = m.id;
  end loop;
end $$;

alter table public.map_markers alter column icon_id set not null;
create index map_markers_icon_id_idx on public.map_markers (icon_id);
alter table public.map_markers drop column emoji, drop column title, drop column note;

drop function public.save_map_marker(integer, double precision, double precision, text, text, text);

-- Crea (p_id nulo) o edita un icono. Editarlo cambia todas sus marcas a la vez.
create function public.save_map_icon(p_id integer, p_emoji text, p_title text, p_note text) returns integer
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
    if (select count(*) from public.map_icons) >= 100 then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
    select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
    into v_author from public.profiles where id = v_uid;
    insert into public.map_icons (emoji, title, note, author_id, author_name)
    values (btrim(coalesce(p_emoji, '')), btrim(coalesce(p_title, '')), nullif(btrim(coalesce(p_note, '')), ''), v_uid, v_author)
    returning id into v_id;
  else
    update public.map_icons
    set emoji = btrim(coalesce(p_emoji, '')), title = btrim(coalesce(p_title, '')),
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

create function public.delete_map_icon(p_id integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('map.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.map_icons where id = p_id;
  if not found then
    raise exception 'El icono no existe' using errcode = 'P0002';
  end if;
end $$;

-- Coloca (p_id nulo) o mueve una marca de un icono. Devuelve su id.
create function public.save_map_marker(p_id integer, p_icon_id integer, p_x double precision, p_y double precision)
returns integer
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
    insert into public.map_markers (icon_id, x, y, author_id, author_name)
    values (p_icon_id, p_x, p_y, v_uid, v_author)
    returning id into v_id;
  else
    update public.map_markers set icon_id = p_icon_id, x = p_x, y = p_y where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'La marca no existe' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
  when foreign_key_violation then
    raise exception 'El icono no existe' using errcode = 'P0002';
end $$;

revoke execute on function
  public.save_map_icon(integer, text, text, text),
  public.delete_map_icon(integer),
  public.save_map_marker(integer, integer, double precision, double precision)
from public, anon;
grant execute on function
  public.save_map_icon(integer, text, text, text),
  public.delete_map_icon(integer),
  public.save_map_marker(integer, integer, double precision, double precision)
to authenticated;
