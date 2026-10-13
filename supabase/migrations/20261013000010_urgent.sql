-- Pinkside · Fase 7 · Pedidos urgentes.
-- Un pedido urgente avisa a los miembros elegidos por MD de Discord. Aquí solo vive el dato y la cola de avisos:
-- el envío real lo hará un proceso aparte (Edge Function con el token del bot) que lee `urgent_notifications`
-- pendientes y las marca como enviadas o fallidas. Sin bot configurado, los avisos simplemente quedan en cola.

create table public.urgent_requests (
  id integer generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 80),
  body text check (body is null or char_length(body) between 1 and 500),
  priority text not null check (priority in ('high', 'critical')),
  item_id integer references public.items (id),
  status text not null default 'open' check (status in ('open', 'covered', 'cancelled')),
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_name text,
  check ((status = 'open') = (closed_at is null))
);
create index urgent_requests_status_idx on public.urgent_requests (status, created_at desc);
create index urgent_requests_item_id_idx on public.urgent_requests (item_id);
create index urgent_requests_author_id_idx on public.urgent_requests (author_id, created_at desc);

create table public.urgent_notifications (
  id integer generated always as identity primary key,
  request_id integer not null references public.urgent_requests (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- pending: en cola · sent: entregado · failed: el envío falló (ver error) · skipped: el miembro desactivó los MD
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (request_id, recipient_id)
);
create index urgent_notifications_recipient_idx on public.urgent_notifications (recipient_id);
create index urgent_notifications_pending_idx on public.urgent_notifications (id) where status = 'pending';

alter table public.urgent_requests enable row level security;
alter table public.urgent_notifications enable row level security;
-- Todo miembro activo ve los pedidos (son avisos para la banda); los avisos enviados solo los ve quien puede
-- enviarlos o el propio destinatario.
create policy urgent_requests_select on public.urgent_requests for select to authenticated
  using ((select public.is_active_member()));
create policy urgent_notifications_select on public.urgent_notifications for select to authenticated
  using (
    (select public.is_active_member())
    and (recipient_id = (select auth.uid()) or (select public.has_perm('urgent.send')))
  );
revoke all on public.urgent_requests, public.urgent_notifications from anon, authenticated;
grant select on public.urgent_requests, public.urgent_notifications to authenticated;

-- Crea el pedido y encola un aviso por destinatario. Los miembros con los MD desactivados quedan como "skipped".
-- Límite anti-spam: 5 pedidos por autor cada 10 minutos (errcode PK003).
create function public.create_urgent_request(
  p_title text, p_body text, p_priority text, p_item_id integer, p_recipients uuid[]
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_author text;
  v_id integer;
  v_valid integer;
  v_wanted uuid[];
begin
  if not public.has_perm('urgent.send') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select array_agg(distinct r) into v_wanted from unnest(coalesce(p_recipients, '{}')) as r where r is not null;
  if v_wanted is null or cardinality(v_wanted) not between 1 and 50 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select count(*) into v_valid from public.profiles where id = any (v_wanted) and status = 'active';
  if v_valid <> cardinality(v_wanted) then
    raise exception 'Un destinatario no es un miembro activo' using errcode = '22023';
  end if;
  if (select count(*) from public.urgent_requests
      where author_id = v_uid and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Demasiados pedidos seguidos' using errcode = 'PK003';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  insert into public.urgent_requests (title, body, priority, item_id, author_id, author_name)
  values (btrim(coalesce(p_title, '')), nullif(btrim(coalesce(p_body, '')), ''), p_priority, p_item_id, v_uid, v_author)
  returning id into v_id;

  insert into public.urgent_notifications (request_id, recipient_id, status)
  select v_id, pr.id, case when pr.dm_urgent then 'pending' else 'skipped' end
  from public.profiles pr where pr.id = any (v_wanted);
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
  when foreign_key_violation then
    raise exception 'El item no existe' using errcode = 'P0002';
end $$;

-- Cierra un pedido abierto: "covered" (ya está cubierto) o "cancelled".
create function public.close_urgent_request(p_id integer, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_closer text;
begin
  if not public.has_perm('urgent.send') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_status is distinct from 'covered' and p_status is distinct from 'cancelled' then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_closer from public.profiles where id = (select auth.uid());

  update public.urgent_requests
  set status = p_status, closed_at = now(), closed_by_name = v_closer
  where id = p_id and status = 'open';
  if not found then
    if exists (select 1 from public.urgent_requests where id = p_id) then
      raise exception 'El pedido ya estaba cerrado' using errcode = 'P0003';
    end if;
    raise exception 'El pedido no existe' using errcode = 'P0002';
  end if;
  -- Un pedido cerrado ya no debe avisar a nadie más.
  update public.urgent_notifications set status = 'skipped', error = 'pedido cerrado antes del envío'
  where request_id = p_id and status = 'pending';
end $$;

revoke execute on function public.create_urgent_request(text, text, text, integer, uuid[]),
  public.close_urgent_request(integer, text) from public, anon;
grant execute on function public.create_urgent_request(text, text, text, integer, uuid[]),
  public.close_urgent_request(integer, text) to authenticated;
