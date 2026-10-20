-- Pinkside · Registro rápido de acciones de la banda (robos, droga, boosting…). Cualquier miembro activo apunta con un
-- toque lo que hace; el informe semanal se alimenta de estos conteos. El catálogo de acciones vive en la web
-- (`kind` es solo un identificador): añadir una acción nueva no necesita migración.

create table public.band_actions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  member_id uuid references public.profiles (id) on delete set null,
  member_name text not null,
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  qty smallint not null default 1 check (qty between 1 and 99),
  note text check (note is null or char_length(note) between 1 and 120)
);
create index band_actions_created_idx on public.band_actions (created_at desc);
alter table public.band_actions enable row level security;
create policy band_actions_select on public.band_actions for select to authenticated
  using ((select public.is_active_member()));
revoke all on public.band_actions from anon, authenticated;
grant select on public.band_actions to authenticated;

create function public.log_band_action(p_kind text, p_qty integer, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_active_member() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_kind is null or p_kind !~ '^[a-z_]{1,40}$' or p_qty is null or p_qty not between 1 and 99
     or (v_note is not null and char_length(v_note) > 120) then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
    into v_name from public.profiles where id = auth.uid();
  insert into public.band_actions (member_id, member_name, kind, qty, note)
  values (auth.uid(), coalesce(v_name, 'Miembro'), p_kind, p_qty, v_note);
  delete from public.band_actions where created_at < now() - interval '400 days';
end $$;
revoke execute on function public.log_band_action(text, integer, text) from public, anon;
grant execute on function public.log_band_action(text, integer, text) to authenticated;

-- Cada uno borra lo suyo (por si se equivoca); quien gestiona rangos puede borrar cualquiera.
create function public.delete_band_action(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_member() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.band_actions
  where id = p_id and (member_id = auth.uid() or public.has_perm('roles.manage'));
  if not found then
    raise exception 'No existe o no es tuyo' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.delete_band_action(bigint) from public, anon;
grant execute on function public.delete_band_action(bigint) to authenticated;

-- Conteos de una semana (lunes a domingo, hora de Madrid) para rellenar el informe.
create function public.band_action_counts(p_week date)
returns table (kind text, total bigint, members bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  select a.kind, sum(a.qty)::bigint, count(distinct a.member_id)::bigint
  from public.band_actions a
  where a.created_at >= (p_week::timestamp at time zone 'Europe/Madrid')
    and a.created_at < ((p_week + 7)::timestamp at time zone 'Europe/Madrid')
  group by a.kind;
end $$;
revoke execute on function public.band_action_counts(date) from public, anon;
grant execute on function public.band_action_counts(date) to authenticated;
