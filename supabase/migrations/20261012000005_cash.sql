-- Pinkside · Fase 3 · Caja común.
-- Libro de movimientos de solo-añadir: nadie edita ni borra filas (ni siquiera con acceso directo a la base).
-- Los errores se corrigen con una anulación: un movimiento contrario enlazado al original.

create table public.cash_movements (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.profiles (id),
  author_name text not null check (char_length(author_name) between 1 and 100),
  amount bigint not null check (amount <> 0 and abs(amount) <= 1000000000),
  reason text not null check (char_length(reason) between 2 and 160),
  reverses_id bigint references public.cash_movements (id),
  created_at timestamptz not null default now()
);
create index cash_movements_member_id_idx on public.cash_movements (member_id);
create index cash_movements_created_at_idx on public.cash_movements (created_at desc);
-- Un movimiento solo se puede anular una vez.
create unique index cash_movements_reverses_id_key on public.cash_movements (reverses_id) where reverses_id is not null;

-- Inmutabilidad: bloquea UPDATE, DELETE y TRUNCATE, también para roles con privilegios.
create function public.cash_movements_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Los movimientos de caja no se pueden modificar ni borrar' using errcode = 'P0004';
end $$;
create trigger cash_movements_no_change before update or delete on public.cash_movements
  for each row execute function public.cash_movements_immutable();
create trigger cash_movements_no_truncate before truncate on public.cash_movements
  for each statement execute function public.cash_movements_immutable();
revoke execute on function public.cash_movements_immutable() from public, anon, authenticated;

-- RLS: solo lectura para quien tenga cash.view. Las escrituras pasan por las funciones de abajo.
alter table public.cash_movements enable row level security;
create policy cash_movements_select on public.cash_movements for select to authenticated
  using ((select public.has_perm('cash.view')));
revoke all on public.cash_movements from anon, authenticated;
grant select on public.cash_movements to authenticated;

-- Resumen: el saldo cuenta todo; las cifras de 7 días excluyen los movimientos anulados y sus anulaciones.
create view public.cash_summary with (security_invoker = true) as
with valid as (
  select m.amount, m.created_at
  from public.cash_movements m
  where m.reverses_id is null
    and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
)
select
  (select coalesce(sum(amount), 0) from public.cash_movements)::bigint as balance,
  (select coalesce(sum(amount), 0) from valid
     where amount > 0 and created_at >= now() - interval '7 days')::bigint as income_7d,
  (select coalesce(-sum(amount), 0) from valid
     where amount < 0 and created_at >= now() - interval '7 days')::bigint as expense_7d,
  (select count(*) from public.cash_movements)::bigint as movements;
revoke all on public.cash_summary from anon, authenticated;
grant select on public.cash_summary to authenticated;

-- Las entradas exigen cash.write; las salidas, cash.withdraw.
create function public.register_cash_movement(p_kind text, p_amount bigint, p_reason text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_author text;
  v_id bigint;
begin
  if p_kind not in ('in', 'out') then
    raise exception 'Tipo de movimiento no válido' using errcode = '22023';
  end if;
  if p_kind = 'in' and not public.has_perm('cash.write') then
    raise exception 'Sin permiso para registrar entradas' using errcode = '42501';
  end if;
  if p_kind = 'out' and not public.has_perm('cash.withdraw') then
    raise exception 'Sin permiso para registrar salidas' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000
     or char_length(v_reason) not between 2 and 160 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  insert into public.cash_movements (member_id, author_name, amount, reason)
  values (v_uid, v_author, case when p_kind = 'in' then p_amount else -p_amount end, v_reason)
  returning id into v_id;
  return v_id;
end $$;

create function public.reverse_cash_movement(p_id bigint, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original public.cash_movements;
  v_author text;
  v_id bigint;
begin
  if not public.has_perm('cash.withdraw') then
    raise exception 'Sin permiso para anular movimientos' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 2 and 100 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  select * into v_original from public.cash_movements where id = p_id;
  if not found then
    raise exception 'El movimiento no existe' using errcode = 'P0002';
  end if;
  if v_original.reverses_id is not null then
    raise exception 'No se puede anular una anulación' using errcode = 'P0003';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  -- Si ya estaba anulado, el índice único reverses_id lanza 23505.
  insert into public.cash_movements (member_id, author_name, amount, reason, reverses_id)
  values (v_uid, v_author, -v_original.amount, 'Anulación #' || p_id || ': ' || v_reason, p_id)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function
  public.register_cash_movement(text, bigint, text),
  public.reverse_cash_movement(bigint, text)
from public, anon;
grant execute on function
  public.register_cash_movement(text, bigint, text),
  public.reverse_cash_movement(bigint, text)
to authenticated;

-- Etiquetas de permisos más claras ahora que la caja existe.
update public.permissions set label = 'Registrar entradas', description = 'Añadir entradas de dinero a la caja'
  where key = 'cash.write';
update public.permissions set label = 'Registrar salidas', description = 'Registrar salidas de dinero y anular movimientos'
  where key = 'cash.withdraw';
