-- Pinkside · Fase 2 · Rangos y permisos editables desde la interfaz.
-- Reglas: solo se editan rangos inferiores al propio (el Líder, nivel 100, edita todos);
-- no se concede un permiso que uno no tiene; el Líder nunca pierde members.manage ni roles.manage.

create function public.set_rank_permission(p_rank smallint, p_permission text, p_allowed boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor smallint := public.my_rank_level();
  v_target smallint;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select level into v_target from public.ranks where id = p_rank;
  if v_target is null then
    raise exception 'El rango no existe' using errcode = 'P0002';
  end if;
  if v_actor < 100 and v_target >= v_actor then
    raise exception 'Solo puedes editar rangos inferiores al tuyo' using errcode = '42501';
  end if;
  if not exists (select 1 from public.permissions where key = p_permission) then
    raise exception 'Permiso desconocido' using errcode = 'P0002';
  end if;

  if p_allowed then
    if v_actor < 100 and not public.has_perm(p_permission) then
      raise exception 'No puedes conceder un permiso que no tienes' using errcode = '42501';
    end if;
    insert into public.rank_permissions (rank_id, permission) values (p_rank, p_permission)
    on conflict do nothing;
  else
    if v_target = 100 and p_permission in ('members.manage', 'roles.manage') then
      raise exception 'El Líder no puede perder este permiso' using errcode = 'P0003';
    end if;
    delete from public.rank_permissions where rank_id = p_rank and permission = p_permission;
  end if;
end $$;

create function public.create_rank(p_name text, p_level smallint) returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  v_actor smallint := public.my_rank_level();
  v_name text := btrim(coalesce(p_name, ''));
  v_id smallint;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 30 or p_level is null or p_level not between 1 and 99 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  if v_actor < 100 and p_level >= v_actor then
    raise exception 'Solo puedes crear rangos inferiores al tuyo' using errcode = '42501';
  end if;
  insert into public.ranks (name, level) values (v_name, p_level) returning id into v_id;
  return v_id;
end $$;

create function public.update_rank(p_rank smallint, p_name text, p_level smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor smallint := public.my_rank_level();
  v_target smallint;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select level into v_target from public.ranks where id = p_rank;
  if v_target is null then
    raise exception 'El rango no existe' using errcode = 'P0002';
  end if;
  if v_actor < 100 and v_target >= v_actor then
    raise exception 'Solo puedes editar rangos inferiores al tuyo' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 30 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  if v_target = 100 then
    if p_level is distinct from 100 then
      raise exception 'El nivel del Líder no se puede cambiar' using errcode = 'P0003';
    end if;
  else
    if p_level is null or p_level not between 1 and 99 then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
    if v_actor < 100 and p_level >= v_actor then
      raise exception 'Solo puedes usar niveles inferiores al tuyo' using errcode = '42501';
    end if;
  end if;

  update public.ranks set name = v_name, level = p_level where id = p_rank;
end $$;

create function public.delete_rank(p_rank smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor smallint := public.my_rank_level();
  v_target smallint;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select level into v_target from public.ranks where id = p_rank;
  if v_target is null then
    raise exception 'El rango no existe' using errcode = 'P0002';
  end if;
  if v_target = 100 then
    raise exception 'El rango Líder no se puede borrar' using errcode = 'P0003';
  end if;
  if v_actor < 100 and v_target >= v_actor then
    raise exception 'Solo puedes borrar rangos inferiores al tuyo' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where rank_id = p_rank) then
    raise exception 'Hay miembros con este rango' using errcode = '23503';
  end if;
  delete from public.ranks where id = p_rank;
end $$;

-- Solo usuarios autenticados pueden ejecutarlas (Supabase concede por defecto a anon).
revoke execute on function
  public.set_rank_permission(smallint, text, boolean),
  public.create_rank(text, smallint),
  public.update_rank(smallint, text, smallint),
  public.delete_rank(smallint)
from public, anon;
grant execute on function
  public.set_rank_permission(smallint, text, boolean),
  public.create_rank(text, smallint),
  public.update_rank(smallint, text, smallint),
  public.delete_rank(smallint)
to authenticated;
