-- Pinkside · Comunidad: lema del perfil, estadísticas de la banda (ranking y logros), muro de la banda y
-- requisitos para ascender de rango.

-- Lema del perfil (lo edita cada miembro en Mi perfil).
alter table public.profiles add column motto text check (motto is null or char_length(motto) between 1 and 80);
grant update (motto) on public.profiles to authenticated;

-- Estadísticas de actividad de cada miembro activo. No incluye dinero (eso sigue siendo `cash_by_member`).
-- Cuenta solo movimientos válidos: ni anulados ni anulaciones. Puntos de 30 días = movimientos de caja + de stock
-- + 2 por cada pedido urgente creado.
create function public.band_stats()
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
      and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
    group by m.member_id
  ), s as (
    select m.member_id, count(*) as n, count(*) filter (where m.created_at >= now() - interval '30 days') as n30,
           count(*) filter (where m.reason like 'Crafteo: %' and m.delta > 0) as crafts
    from public.stock_movements m
    where m.reverses_id is null
      and not exists (select 1 from public.stock_movements r where r.reverses_id = m.id)
    group by m.member_id
  ), u as (
    select q.author_id, count(*) as n, count(*) filter (where q.created_at >= now() - interval '30 days') as n30
    from public.urgent_requests q
    where q.author_id is not null
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
  order by 12 desc, 2;
end $$;
revoke execute on function public.band_stats() from public, anon;
grant execute on function public.band_stats() to authenticated;

-- Requisitos para llegar a un rango. Un requisito por métrica y rango; objetivo 0 lo quita.
create table public.rank_requirements (
  rank_id smallint not null references public.ranks (id) on delete cascade,
  metric text not null check (metric in ('days', 'cash_moves', 'stock_moves', 'crafts', 'urgents')),
  target integer not null check (target between 1 and 100000),
  primary key (rank_id, metric)
);
alter table public.rank_requirements enable row level security;
create policy rank_requirements_select on public.rank_requirements for select to authenticated
  using ((select public.is_active_member()));
revoke all on public.rank_requirements from anon, authenticated;
grant select on public.rank_requirements to authenticated;

create function public.set_rank_requirement(p_rank smallint, p_metric text, p_target integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor smallint := public.my_rank_level();
  v_level smallint;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select level into v_level from public.ranks where id = p_rank;
  if v_level is null then
    raise exception 'El rango no existe' using errcode = 'P0002';
  end if;
  if v_actor < 100 and v_level >= v_actor then
    raise exception 'Solo puedes editar rangos inferiores al tuyo' using errcode = '42501';
  end if;
  if p_metric is null or p_metric not in ('days', 'cash_moves', 'stock_moves', 'crafts', 'urgents')
     or p_target is null or p_target not between 0 and 100000 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  if p_target = 0 then
    delete from public.rank_requirements where rank_id = p_rank and metric = p_metric;
  else
    insert into public.rank_requirements (rank_id, metric, target) values (p_rank, p_metric, p_target)
    on conflict (rank_id, metric) do update set target = excluded.target;
  end if;
end $$;
revoke execute on function public.set_rank_requirement(smallint, text, integer) from public, anon;
grant execute on function public.set_rank_requirement(smallint, text, integer) to authenticated;

-- Muro de la banda: avisos de los rangos con `wall.post` (por defecto nivel 80 o más), con reacciones de todos.
insert into public.permissions (key, label, description)
values ('wall.post', 'Publicar en el muro', 'Escribir, fijar y borrar avisos del muro de la banda');
insert into public.rank_permissions (rank_id, permission)
select id, 'wall.post' from public.ranks where level >= 80;

create table public.wall_posts (
  id bigint generated always as identity primary key,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 100),
  body text not null check (char_length(body) between 2 and 500),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index wall_posts_order_idx on public.wall_posts (pinned desc, id desc);

create table public.wall_reactions (
  post_id bigint not null references public.wall_posts (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '🔥', '😂', '❤️', '👀')),
  primary key (post_id, member_id, emoji)
);
create index wall_reactions_member_idx on public.wall_reactions (member_id);

alter table public.wall_posts enable row level security;
alter table public.wall_reactions enable row level security;
create policy wall_posts_select on public.wall_posts for select to authenticated
  using ((select public.is_active_member()));
create policy wall_reactions_select on public.wall_reactions for select to authenticated
  using ((select public.is_active_member()));
revoke all on public.wall_posts, public.wall_reactions from anon, authenticated;
grant select on public.wall_posts, public.wall_reactions to authenticated;

create function public.post_wall(p_body text, p_pinned boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
  v_id bigint;
begin
  if not public.has_perm('wall.post') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if char_length(v_body) not between 2 and 500 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
    into v_name from public.profiles where id = (select auth.uid());
  insert into public.wall_posts (author_id, author_name, body, pinned)
  values ((select auth.uid()), v_name, v_body, coalesce(p_pinned, false))
  returning id into v_id;
  return v_id;
end $$;

create function public.delete_wall_post(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_member() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.wall_posts
  where id = p_id and (author_id = (select auth.uid()) or public.has_perm('wall.post'));
end $$;

create function public.set_wall_pinned(p_id bigint, p_pinned boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('wall.post') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update public.wall_posts set pinned = coalesce(p_pinned, false) where id = p_id;
end $$;

-- Quita la reacción si ya estaba puesta; si no, la añade.
create function public.toggle_wall_reaction(p_post bigint, p_emoji text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_member() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_emoji is null or p_emoji not in ('👍', '🔥', '😂', '❤️', '👀') then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.wall_posts where id = p_post) then
    raise exception 'El aviso no existe' using errcode = 'P0002';
  end if;
  delete from public.wall_reactions
  where post_id = p_post and member_id = (select auth.uid()) and emoji = p_emoji;
  if not found then
    insert into public.wall_reactions (post_id, member_id, emoji) values (p_post, (select auth.uid()), p_emoji);
  end if;
end $$;

revoke execute on function public.post_wall(text, boolean), public.delete_wall_post(bigint),
  public.set_wall_pinned(bigint, boolean), public.toggle_wall_reaction(bigint, text) from public, anon;
grant execute on function public.post_wall(text, boolean), public.delete_wall_post(bigint),
  public.set_wall_pinned(bigint, boolean), public.toggle_wall_reaction(bigint, text) to authenticated;
