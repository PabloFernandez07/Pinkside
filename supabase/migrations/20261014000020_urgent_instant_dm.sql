-- Pinkside · MD de Discord inmediato al crear un pedido urgente.
-- Al encolar avisos pendientes, un trigger llama (pg_net, asíncrono) a la Edge Function `send-urgent-dms`.
-- El secreto compartido se guarda en Supabase Vault con el nombre `urgent_worker_secret` (lo crea el dueño del
-- proyecto en el editor SQL: select vault.create_secret('<valor>', 'urgent_worker_secret');). Sin secreto no
-- hace nada y los avisos se quedan en cola. Un fallo aquí nunca debe impedir crear el pedido.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_urgent_dms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if not exists (select 1 from new_rows where status = 'pending') then
    return null;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'urgent_worker_secret';
  if v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := 'https://fihluofkuzmhwiymocqf.supabase.co/functions/v1/send-urgent-dms',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    body := '{}'::jsonb
  );
  return null;
exception when others then
  return null;
end $$;

revoke all on function public.notify_urgent_dms() from public, anon, authenticated;

-- Una sola llamada por pedido (las filas de todos los destinatarios se insertan en una sentencia).
create trigger urgent_notifications_dm
  after insert on public.urgent_notifications
  referencing new table as new_rows
  for each statement execute function public.notify_urgent_dms();
