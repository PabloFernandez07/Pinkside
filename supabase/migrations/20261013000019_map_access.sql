-- Pinkside · Quién ve el mapa: acceso individual por miembro.
-- Quien tenga `members.allow` (Líder y Lugarteniente) lo ve siempre y decide quién más. Los miembros que ya
-- existían conservan el acceso; las cuentas nuevas lo tienen apagado hasta que se les dé.

alter table public.profiles add column map_access boolean not null default false;
update public.profiles set map_access = true;

create function public.can_view_map() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.status = 'active'
      and (pr.map_access or exists (
        select 1 from public.rank_permissions rp
        where rp.rank_id = pr.rank_id and rp.permission = 'members.allow'
      ))
  )
$$;

drop policy map_icons_select on public.map_icons;
drop policy map_markers_select on public.map_markers;
drop policy map_areas_select on public.map_areas;
create policy map_icons_select on public.map_icons for select to authenticated using ((select public.can_view_map()));
create policy map_markers_select on public.map_markers for select to authenticated using ((select public.can_view_map()));
create policy map_areas_select on public.map_areas for select to authenticated using ((select public.can_view_map()));

create function public.set_member_map_access(p_member uuid, p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('members.allow') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update public.profiles set map_access = coalesce(p_value, false) where id = p_member and status = 'active';
  if not found then
    raise exception 'El miembro no existe' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.can_view_map(), public.set_member_map_access(uuid, boolean) from public, anon;
grant execute on function public.can_view_map(), public.set_member_map_access(uuid, boolean) to authenticated;
