-- Pinkside · Lista de IDs de Discord autorizados a entrar.
-- Solo quien está en la lista puede registrarse con Discord. La gestionan quienes tienen `members.allow`
-- (por defecto, rangos de nivel 80 o más: Líder y Lugarteniente).

insert into public.permissions (key, label, description)
values ('members.allow', 'Autorizar accesos', 'Añadir y quitar los IDs de Discord que pueden entrar en la web');
insert into public.rank_permissions (rank_id, permission)
select id, 'members.allow' from public.ranks where level >= 80;

create table public.allowed_discord_ids (
  discord_id text primary key check (discord_id ~ '^[0-9]{17,20}$'),
  label text check (label is null or char_length(label) between 1 and 60),
  added_by uuid references public.profiles (id) on delete set null,
  added_by_name text not null,
  created_at timestamptz not null default now()
);
create index allowed_discord_ids_added_by_idx on public.allowed_discord_ids (added_by);

alter table public.allowed_discord_ids enable row level security;
create policy allowed_discord_ids_select on public.allowed_discord_ids for select to authenticated
  using ((select public.has_perm('members.allow')));
revoke all on public.allowed_discord_ids from anon, authenticated;
grant select on public.allowed_discord_ids to authenticated;

-- Quien ya es miembro y los administradores iniciales siguen pudiendo entrar.
insert into public.allowed_discord_ids (discord_id, label, added_by_name)
select p.discord_id,
       coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.discord_username),
       'Sistema'
from public.profiles p
where p.discord_id ~ '^[0-9]{17,20}$'
on conflict do nothing;
insert into public.allowed_discord_ids (discord_id, label, added_by_name)
select btrim(v), 'Administrador inicial', 'Sistema'
from public.app_settings s, jsonb_array_elements_text(s.value) v
where s.key = 'bootstrap_admin_discord_ids' and btrim(v) ~ '^[0-9]{17,20}$'
on conflict do nothing;

-- El registro con Discord solo se completa si el ID está autorizado (o es un administrador inicial).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_discord text := coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub');
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'discord' then
    raise exception 'Solo se admite el registro con Discord';
  end if;
  if v_discord is null then
    raise exception 'Falta la identidad de Discord en el registro';
  end if;
  if not exists (select 1 from public.allowed_discord_ids where discord_id = v_discord)
     and not exists (
       select 1 from public.app_settings
       where key = 'bootstrap_admin_discord_ids' and value ? v_discord
     ) then
    raise exception 'Tu cuenta de Discord no está autorizada';
  end if;
  insert into public.profiles (id, discord_id, discord_username, avatar_url)
  values (
    new.id,
    v_discord,
    regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
      '#0+$', ''
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create function public.add_allowed_discord_id(p_discord_id text, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id text := btrim(coalesce(p_discord_id, ''));
  v_name text;
begin
  if not public.has_perm('members.allow') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if v_id !~ '^[0-9]{17,20}$' or (select count(*) from public.allowed_discord_ids) >= 500 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_name from public.profiles where id = v_uid;
  insert into public.allowed_discord_ids (discord_id, label, added_by, added_by_name)
  values (v_id, nullif(btrim(coalesce(p_label, '')), ''), v_uid, v_name);
exception
  when unique_violation then
    raise exception 'Ese ID ya está en la lista' using errcode = '23505';
  when check_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

-- Quita un ID de la lista. Si ya tenía cuenta, queda bloqueada (no se puede quitar a uno mismo ni a un rango superior).
create function public.remove_allowed_discord_id(p_discord_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor smallint := public.my_rank_level();
  v_target uuid;
  v_target_level smallint;
begin
  if not public.has_perm('members.allow') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select pr.id, coalesce(r.level, 0) into v_target, v_target_level
  from public.profiles pr left join public.ranks r on r.id = pr.rank_id
  where pr.discord_id = p_discord_id;
  if v_target is not null then
    if v_target = v_uid then
      raise exception 'No puedes quitarte a ti mismo' using errcode = '42501';
    end if;
    if v_target_level >= v_actor and v_actor < 100 then
      raise exception 'Acción no permitida' using errcode = '42501';
    end if;
  end if;
  delete from public.allowed_discord_ids where discord_id = p_discord_id;
  if not found then
    raise exception 'Ese ID no está en la lista' using errcode = 'P0002';
  end if;
  update public.profiles set status = 'blocked'
  where discord_id = p_discord_id and status in ('onboarding', 'pending', 'active');
end $$;

revoke execute on function public.add_allowed_discord_id(text, text), public.remove_allowed_discord_id(text)
  from public, anon;
grant execute on function public.add_allowed_discord_id(text, text), public.remove_allowed_discord_id(text)
  to authenticated;
