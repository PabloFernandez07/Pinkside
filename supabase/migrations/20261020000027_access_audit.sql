-- Pinkside · Auditoría de accesos: quién ha intentado entrar, tenga cuenta o no.
-- Solo la ven los IDs de Discord de app_settings.audit_discord_ids.
--
-- Un rechazo con excepción en el registro deshace también cualquier apunte, así que el filtro ya no rechaza:
-- el ID no autorizado recibe una cuenta con estado `denied`, sin rango ni permisos (igual que un perfil en
-- `onboarding`: solo ve su propia fila), y la web le cierra la sesión al instante.

alter type public.member_status add value 'denied';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_discord text := coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub');
  v_allowed boolean;
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'discord' then
    raise exception 'Solo se admite el registro con Discord';
  end if;
  if v_discord is null then
    raise exception 'Falta la identidad de Discord en el registro';
  end if;
  v_allowed := exists (select 1 from public.allowed_discord_ids where discord_id = v_discord)
    or exists (
      select 1 from public.app_settings
      where key = 'bootstrap_admin_discord_ids' and value ? v_discord
    );
  insert into public.profiles (id, discord_id, discord_username, avatar_url, status)
  values (
    new.id,
    v_discord,
    regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
      '#0+$', ''
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    case when v_allowed then 'onboarding'::public.member_status else 'denied'::public.member_status end
  );
  return new;
end $$;

-- Al autorizar un ID que ya había intentado entrar, su cuenta pasa a primer acceso.
create or replace function public.add_allowed_discord_id(p_discord_id text, p_label text) returns void
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
  update public.profiles set status = 'onboarding' where discord_id = v_id and status = 'denied';
exception
  when unique_violation then
    raise exception 'Ese ID ya está en la lista' using errcode = '23505';
  when check_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

insert into public.app_settings (key, value) values ('audit_discord_ids', '["720656305043275926"]'::jsonb);

create function public.is_auditor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles pr
    join public.app_settings s on s.key = 'audit_discord_ids'
    where pr.id = (select auth.uid()) and pr.status = 'active' and s.value ? pr.discord_id
  )
$$;

create table public.access_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('login', 'denied', 'blocked')),
  user_id uuid references auth.users (id) on delete set null,
  discord_id text not null,
  discord_username text,
  member_name text,
  ip text check (char_length(ip) <= 64),
  user_agent text check (char_length(user_agent) <= 300)
);
create index access_log_created_at_idx on public.access_log (created_at desc);
create index access_log_user_id_idx on public.access_log (user_id);

alter table public.access_log enable row level security;
create policy access_log_select on public.access_log for select to authenticated
  using ((select public.is_auditor()));
revoke all on public.access_log from anon, authenticated;
grant select on public.access_log to authenticated;

-- La web la llama al volver de Discord. La identidad sale de la sesión, nunca de los parámetros; solo IP y
-- navegador vienen de fuera (con tope de longitud). Un mismo usuario y evento no se repite en 30 s.
create function public.log_access(p_ip text, p_user_agent text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_event text;
begin
  if v_uid is null then return; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return; end if;
  v_event := case v_profile.status
    when 'denied' then 'denied' when 'blocked' then 'blocked' else 'login' end;
  if exists (
    select 1 from public.access_log
    where user_id = v_uid and event = v_event and created_at > now() - interval '30 seconds'
  ) then return; end if;
  insert into public.access_log (event, user_id, discord_id, discord_username, member_name, ip, user_agent)
  values (
    v_event, v_uid, v_profile.discord_id, v_profile.discord_username,
    nullif(btrim(concat_ws(' ', v_profile.first_name, v_profile.last_name)), ''),
    left(p_ip, 64), left(p_user_agent, 300)
  );
  delete from public.access_log where created_at < now() - interval '1 year';
end $$;

revoke execute on function public.is_auditor(), public.log_access(text, text) from public, anon;
grant execute on function public.is_auditor(), public.log_access(text, text) to authenticated;
