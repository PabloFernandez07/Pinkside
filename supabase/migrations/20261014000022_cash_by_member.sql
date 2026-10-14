-- Pinkside · Dinero por miembro.
-- Permiso `cash.members` (por defecto rangos de nivel 80 o más: Líder y Lugarteniente; editable en Rangos) y una
-- función que resume, por miembro, lo aportado (entradas), lo retirado (salidas) y el balance. Como en
-- `cash_summary`, no cuenta lo anulado ni las anulaciones. Solo se ve con `cash.members` y `cash.view`.

insert into public.permissions (key, label, description)
values ('cash.members', 'Ver dinero por miembro', 'Consultar cuánto ha aportado y retirado cada miembro de la caja');
insert into public.rank_permissions (rank_id, permission)
select id, 'cash.members' from public.ranks where level >= 80;

create function public.cash_by_member()
returns table (member_id uuid, member_name text, deposited bigint, withdrawn bigint, net bigint, movements bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (public.has_perm('cash.view') and public.has_perm('cash.members')) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  with valid as (
    select m.member_id, m.id, m.amount
    from public.cash_movements m
    where m.reverses_id is null
      and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
  )
  select p.id,
         coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.discord_username, 'Miembro'),
         coalesce(sum(v.amount) filter (where v.amount > 0), 0)::bigint,
         coalesce(-sum(v.amount) filter (where v.amount < 0), 0)::bigint,
         coalesce(sum(v.amount), 0)::bigint,
         count(v.id)::bigint
  from public.profiles p
  join valid v on v.member_id = p.id
  group by p.id, p.first_name, p.last_name, p.discord_username
  order by 5 desc, 2;
end $$;

revoke execute on function public.cash_by_member() from public, anon;
grant execute on function public.cash_by_member() to authenticated;
