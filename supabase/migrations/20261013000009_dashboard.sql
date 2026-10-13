-- Pinkside · Fase 6 · Datos del resumen.
-- Ambos objetos respetan el RLS de quien consulta: cada rango solo ve lo que sus permisos le dejan ver.

-- Entradas, salidas y saldo al cierre de cada uno de los últimos N días (hora de Madrid).
-- Las entradas y salidas excluyen lo anulado y las propias anulaciones; el saldo cuenta todo.
create function public.cash_daily(p_days integer default 14)
returns table (day date, income bigint, expense bigint, balance bigint)
language sql stable set search_path = '' as $$
  with params as (
    select least(greatest(coalesce(p_days, 14), 1), 90) as n,
           (now() at time zone 'Europe/Madrid')::date as today
  ),
  days as (
    select generate_series(p.today - (p.n - 1), p.today, interval '1 day')::date as day from params p
  ),
  mov as (
    select m.id, m.amount, m.reverses_id, (m.created_at at time zone 'Europe/Madrid')::date as day
    from public.cash_movements m
  ),
  valid as (
    select * from mov m
    where m.reverses_id is null
      and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
  )
  select d.day,
         coalesce((select sum(v.amount) from valid v where v.day = d.day and v.amount > 0), 0)::bigint,
         coalesce((select -sum(v.amount) from valid v where v.day = d.day and v.amount < 0), 0)::bigint,
         coalesce((select sum(m.amount) from mov m where m.day <= d.day), 0)::bigint
  from days d
  order by d.day
$$;
revoke execute on function public.cash_daily(integer) from public, anon;
grant execute on function public.cash_daily(integer) to authenticated;

-- Actividad reciente unificada (caja + inventario). Sin permiso para ver una tabla, no salen sus eventos.
create view public.activity_feed with (security_invoker = true) as
select 'cash'::text as kind, c.id, c.created_at, c.author_name, c.reason as detail,
       c.amount, null::text as item_name, (c.reverses_id is not null) as is_reversal
from public.cash_movements c
union all
select 'stock'::text, s.id, s.created_at, s.author_name, s.reason,
       s.delta::bigint, i.name, (s.reverses_id is not null)
from public.stock_movements s
join public.items i on i.id = s.item_id;
revoke all on public.activity_feed from anon, authenticated;
grant select on public.activity_feed to authenticated;
