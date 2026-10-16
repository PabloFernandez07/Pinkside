-- Pinkside · Rendimiento: menos trabajo por lectura, mismos resultados.

-- cash_daily: una sola pasada agrupando por día, en vez de subconsultas por cada día del gráfico.
-- Mismo contrato: entradas/salidas excluyen lo anulado y las anulaciones; el saldo cuenta todo.
create or replace function public.cash_daily(p_days integer default 14)
returns table (day date, income bigint, expense bigint, balance bigint)
language sql stable set search_path = '' as $$
  with params as (
    select least(greatest(coalesce(p_days, 14), 1), 90) as n,
           (now() at time zone 'Europe/Madrid')::date as today
  ),
  days as (
    select generate_series(p.today - (p.n - 1), p.today, interval '1 day')::date as day from params p
  ),
  per_day as (
    select (m.created_at at time zone 'Europe/Madrid')::date as day,
           sum(m.amount) as total,
           sum(m.amount) filter (
             where m.reverses_id is null and m.amount > 0
               and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
           ) as inc,
           -sum(m.amount) filter (
             where m.reverses_id is null and m.amount < 0
               and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
           ) as exp
    from public.cash_movements m
    group by 1
  )
  select d.day,
         coalesce(pd.inc, 0)::bigint,
         coalesce(pd.exp, 0)::bigint,
         coalesce((select sum(x.total) from per_day x where x.day <= d.day), 0)::bigint
  from days d
  left join per_day pd on pd.day = d.day
  order by d.day
$$;

-- band_stats: parámetro opcional para calcular solo un miembro (el resumen solo necesita el suyo).
-- Sin parámetro devuelve a todos, igual que antes.
drop function public.band_stats();
create function public.band_stats(p_member uuid default null)
returns table (
  member_id uuid, member_name text, avatar_url text, motto text, rank_name text, rank_level smallint,
  joined_at timestamptz, cash_moves bigint, stock_moves bigint, crafts bigint, urgents bigint, points_30d bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_active_member() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
  with c as (
    select m.member_id, count(*) as n, count(*) filter (where m.created_at >= now() - interval '30 days') as n30
    from public.cash_movements m
    where m.reverses_id is null
      and (p_member is null or m.member_id = p_member)
      and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
    group by m.member_id
  ), s as (
    select m.member_id, count(*) as n, count(*) filter (where m.created_at >= now() - interval '30 days') as n30,
           count(*) filter (where m.reason like 'Crafteo: %' and m.delta > 0) as crafts
    from public.stock_movements m
    where m.reverses_id is null
      and (p_member is null or m.member_id = p_member)
      and not exists (select 1 from public.stock_movements r where r.reverses_id = m.id)
    group by m.member_id
  ), u as (
    select q.author_id, count(*) as n, count(*) filter (where q.created_at >= now() - interval '30 days') as n30
    from public.urgent_requests q
    where q.author_id is not null
      and (p_member is null or q.author_id = p_member)
    group by q.author_id
  )
  select p.id,
         coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.discord_username, 'Miembro'),
         p.avatar_url, p.motto, r.name, r.level, p.created_at,
         coalesce(c.n, 0)::bigint, coalesce(s.n, 0)::bigint, coalesce(s.crafts, 0)::bigint, coalesce(u.n, 0)::bigint,
         (coalesce(c.n30, 0) + coalesce(s.n30, 0) + 2 * coalesce(u.n30, 0))::bigint
  from public.profiles p
  left join public.ranks r on r.id = p.rank_id
  left join c on c.member_id = p.id
  left join s on s.member_id = p.id
  left join u on u.author_id = p.id
  where p.status = 'active'
    and (p_member is null or p.id = p_member)
  order by 12 desc, 2;
end $$;
revoke execute on function public.band_stats(uuid) from public, anon;
grant execute on function public.band_stats(uuid) to authenticated;

-- Índices de claves foráneas que faltaban (aceleran los borrados en cascada).
create index if not exists wall_posts_author_id_idx on public.wall_posts (author_id);
create index if not exists rank_permissions_permission_idx on public.rank_permissions (permission);
