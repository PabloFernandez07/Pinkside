-- Pinkside · Fase 1 · Base: perfiles, rangos, permisos, RLS y funciones de aprobación.

create type public.member_status as enum ('onboarding', 'pending', 'active', 'blocked');

create table public.ranks (
  id smallint generated always as identity primary key,
  name text not null unique check (char_length(name) between 2 and 30),
  level smallint not null unique check (level between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  label text not null,
  description text not null default ''
);

create table public.rank_permissions (
  rank_id smallint not null references public.ranks (id) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (rank_id, permission)
);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  discord_username text,
  avatar_url text,
  state_id integer unique check (state_id > 0),
  first_name text check (first_name is null or char_length(first_name) between 1 and 40),
  last_name text check (last_name is null or char_length(last_name) between 1 and 60),
  phone text check (phone is null or char_length(phone) between 3 and 20),
  rank_id smallint references public.ranks (id),
  status public.member_status not null default 'onboarding',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  accent text not null default 'emerald' check (accent in ('emerald', 'pink', 'indigo', 'amber', 'cyan')),
  dm_urgent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_rank_id_idx on public.profiles (rank_id);
create index profiles_status_idx on public.profiles (status);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helpers de autorización (security definer para evitar recursión de RLS).
create function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active'
  )
$$;

create function public.has_perm(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles pr
    join public.rank_permissions rp on rp.rank_id = pr.rank_id
    where pr.id = (select auth.uid())
      and pr.status = 'active'
      and rp.permission = p_permission
  )
$$;

create function public.my_rank_level() returns smallint
language sql stable security definer set search_path = '' as $$
  select r.level
  from public.profiles pr
  join public.ranks r on r.id = pr.rank_id
  where pr.id = (select auth.uid()) and pr.status = 'active'
$$;

-- Crea el perfil al registrarse con Discord.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_discord text := coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub');
begin
  if v_discord is null then
    raise exception 'Falta la identidad de Discord en el registro';
  end if;
  insert into public.profiles (id, discord_id, discord_username, avatar_url)
  values (
    new.id,
    v_discord,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Primer acceso: guarda los datos y deja al miembro pendiente de aprobación
-- (o activo como Líder si su Discord está en la lista de administradores iniciales).
create function public.complete_onboarding(
  p_state_id integer, p_first_name text, p_last_name text, p_phone text
) returns public.member_status
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_boot jsonb;
  v_rank smallint;
  v_status public.member_status := 'pending';
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.status <> 'onboarding' then
    raise exception 'El primer acceso ya está completado' using errcode = 'P0001';
  end if;
  if p_state_id is null or p_state_id <= 0
     or char_length(btrim(coalesce(p_first_name, ''))) not between 1 and 40
     or char_length(btrim(coalesce(p_last_name, ''))) not between 1 and 60
     or char_length(btrim(coalesce(p_phone, ''))) not between 3 and 20 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  select value into v_boot from public.app_settings where key = 'bootstrap_admin_discord_ids';
  if v_boot is not null and v_boot ? v_profile.discord_id then
    select id into v_rank from public.ranks where level = 100;
    v_status := 'active';
  end if;

  update public.profiles
  set state_id = p_state_id,
      first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      phone = btrim(p_phone),
      status = v_status,
      rank_id = v_rank
  where id = v_uid;
  return v_status;
end $$;

-- Gestión de miembros: siempre comprobada en base de datos.
create function public.approve_member(p_member uuid, p_rank smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor smallint := public.my_rank_level(); v_new smallint;
begin
  if not public.has_perm('members.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select level into v_new from public.ranks where id = p_rank;
  if v_new is null or v_new > v_actor then
    raise exception 'Rango no permitido' using errcode = '42501';
  end if;
  update public.profiles set status = 'active', rank_id = p_rank
  where id = p_member and status = 'pending';
  if not found then
    raise exception 'El miembro no está pendiente' using errcode = 'P0002';
  end if;
end $$;

create function public.set_member_rank(p_member uuid, p_rank smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor smallint := public.my_rank_level(); v_target smallint; v_new smallint;
begin
  if not public.has_perm('members.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_member = (select auth.uid()) then
    raise exception 'No puedes cambiar tu propio rango' using errcode = '42501';
  end if;
  select r.level into v_target from public.profiles pr
    join public.ranks r on r.id = pr.rank_id where pr.id = p_member and pr.status = 'active';
  select level into v_new from public.ranks where id = p_rank;
  if v_target is null or v_new is null or v_new > v_actor or (v_target >= v_actor and v_actor < 100) then
    raise exception 'Cambio de rango no permitido' using errcode = '42501';
  end if;
  update public.profiles set rank_id = p_rank where id = p_member;
end $$;

create function public.set_member_blocked(p_member uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor smallint := public.my_rank_level(); v_target smallint;
begin
  if not public.has_perm('members.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_member = (select auth.uid()) then
    raise exception 'No puedes bloquearte a ti mismo' using errcode = '42501';
  end if;
  select coalesce(r.level, 0) into v_target from public.profiles pr
    left join public.ranks r on r.id = pr.rank_id where pr.id = p_member;
  if v_target is null or (v_target >= v_actor and v_actor < 100) then
    raise exception 'Acción no permitida' using errcode = '42501';
  end if;
  update public.profiles
  set status = case when p_blocked then 'blocked'::public.member_status else 'active'::public.member_status end
  where id = p_member and status in ('active', 'blocked');
end $$;

-- Permisos de ejecución: solo usuarios autenticados.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_active_member(), public.has_perm(text), public.my_rank_level(),
  public.complete_onboarding(integer, text, text, text),
  public.approve_member(uuid, smallint),
  public.set_member_rank(uuid, smallint),
  public.set_member_blocked(uuid, boolean)
to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.ranks enable row level security;
alter table public.permissions enable row level security;
alter table public.rank_permissions enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      (select public.is_active_member())
      and (status = 'active' or (select public.has_perm('members.manage')))
    )
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy ranks_select on public.ranks for select to authenticated
  using ((select public.is_active_member()));
create policy permissions_select on public.permissions for select to authenticated
  using ((select public.is_active_member()));
create policy rank_permissions_select on public.rank_permissions for select to authenticated
  using ((select public.is_active_member()));

-- Privilegios por columna: el usuario solo edita sus preferencias y datos de contacto.
revoke all on public.profiles, public.ranks, public.permissions, public.rank_permissions, public.app_settings
  from anon, authenticated;
grant select on public.profiles, public.ranks, public.permissions, public.rank_permissions to authenticated;
grant update (first_name, last_name, phone, theme, accent, dm_urgent) on public.profiles to authenticated;

-- Datos iniciales
insert into public.ranks (name, level) values
  ('Líder', 100), ('Lugarteniente', 80), ('Miembro', 50), ('Recluta', 10);

insert into public.permissions (key, label, description) values
  ('cash.view', 'Ver caja', 'Consultar el saldo y los movimientos'),
  ('cash.write', 'Registrar movimientos', 'Añadir entradas y salidas a la caja'),
  ('cash.withdraw', 'Retirar dinero', 'Registrar salidas de dinero'),
  ('inventory.edit', 'Editar inventario', 'Crear items y mover stock'),
  ('recipes.edit', 'Editar recetas', 'Crear y modificar recetas'),
  ('urgent.send', 'Enviar avisos urgentes', 'Crear pedidos urgentes con aviso por Discord'),
  ('members.manage', 'Gestionar miembros', 'Aprobar, bloquear y cambiar rangos'),
  ('roles.manage', 'Gestionar rangos', 'Editar los permisos de cada rango');

insert into public.rank_permissions (rank_id, permission)
select r.id, p.key
from public.ranks r
join public.permissions p on (
  (r.level = 100)
  or (r.level = 80 and p.key in ('cash.view','cash.write','cash.withdraw','inventory.edit','recipes.edit','urgent.send'))
  or (r.level = 50 and p.key in ('cash.view','cash.write','inventory.edit','urgent.send'))
  or (r.level = 10 and p.key in ('cash.view'))
);

insert into public.app_settings (key, value) values ('bootstrap_admin_discord_ids', '[]'::jsonb);
