-- Discord eliminó los discriminadores: las cuentas nuevas llegan como "usuario#0".
-- Quitamos solo un "#" seguido únicamente de ceros al final (un "#1234" antiguo real se respeta).

-- 1) Perfiles ya creados.
update public.profiles
set discord_username = regexp_replace(discord_username, '#0+$', '')
where discord_username ~ '#0+$';

-- 2) Perfiles nuevos: mismo trigger de siempre, guardando el nombre limpio.
--    create or replace conserva los permisos de ejecución ya revocados.
create or replace function public.handle_new_user() returns trigger
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
    regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
      '#0+$', ''
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;
