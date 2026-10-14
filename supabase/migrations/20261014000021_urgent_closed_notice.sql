-- Pinkside · Aviso por MD cuando un pedido urgente se cubre o se cancela.
-- Cada fila de la cola es ahora un aviso inicial ('new') o un aviso de cierre ('closed'). Al cerrar un pedido se
-- encola un aviso de cierre para cada persona que recibió el inicial (status 'sent'); el trigger de la 0020 lo envía.
-- Quien no llegó a recibir el inicial (en cola, fallido o sin MD) tampoco recibe el cierre.

alter table public.urgent_notifications
  add column kind text not null default 'new' check (kind in ('new', 'closed'));

alter table public.urgent_notifications drop constraint urgent_notifications_request_id_recipient_id_key;
alter table public.urgent_notifications
  add constraint urgent_notifications_request_recipient_kind_key unique (request_id, recipient_id, kind);

create or replace function public.close_urgent_request(p_id integer, p_status text) returns void
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
  -- Un pedido cerrado ya no debe enviar el aviso inicial a nadie más.
  update public.urgent_notifications set status = 'skipped', error = 'pedido cerrado antes del envío'
  where request_id = p_id and kind = 'new' and status = 'pending';
  -- Y quien ya lo recibió se entera de que se ha cerrado (una sola sentencia: un solo disparo del envío).
  insert into public.urgent_notifications (request_id, recipient_id, kind)
  select request_id, recipient_id, 'closed'
  from public.urgent_notifications
  where request_id = p_id and kind = 'new' and status = 'sent';
end $$;
