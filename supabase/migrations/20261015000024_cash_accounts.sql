-- Pinkside · Cuenta de cada miembro.
-- En vez de registrar "entra X" o "sale X", cada miembro escribe el saldo TOTAL de su cuenta y la base calcula la
-- diferencia con lo que tenía y la guarda en el libro (que sigue siendo de solo añadir). Subir el saldo exige
-- `cash.write`; bajarlo, `cash.withdraw`. El saldo de la caja sigue siendo la suma de todos los movimientos.

-- Saldo de mi cuenta: suma de mis movimientos válidos (sin lo anulado ni las anulaciones, como `cash_by_member`).
create function public.my_cash_balance() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(m.amount), 0)::bigint
  from public.cash_movements m
  where m.member_id = (select auth.uid())
    and m.reverses_id is null
    and not exists (select 1 from public.cash_movements r where r.reverses_id = m.id)
$$;

-- Fija el saldo total de mi cuenta. Errcode PK004: el saldo ya era ese.
create function public.set_cash_balance(p_balance bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_current bigint;
  v_delta bigint;
  v_author text;
  v_id bigint;
begin
  if p_balance is null or p_balance < 0 or p_balance > 1000000000 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  -- Dos actualizaciones a la vez de la misma persona no pueden leer el mismo saldo de partida.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  v_current := public.my_cash_balance();
  v_delta := p_balance - v_current;
  if v_delta = 0 then
    raise exception 'Tu cuenta ya tiene ese saldo' using errcode = 'PK004';
  end if;
  if v_delta > 0 and not public.has_perm('cash.write') then
    raise exception 'Sin permiso para subir el saldo' using errcode = '42501';
  end if;
  if v_delta < 0 and not public.has_perm('cash.withdraw') then
    raise exception 'Sin permiso para bajar el saldo' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  insert into public.cash_movements (member_id, author_name, amount, reason)
  values (
    v_uid, v_author, v_delta,
    'Cuenta: $' || replace(to_char(v_current, 'FM999,999,999,999'), ',', '.')
      || ' → $' || replace(to_char(p_balance, 'FM999,999,999,999'), ',', '.')
  )
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.my_cash_balance(), public.set_cash_balance(bigint) from public, anon;
grant execute on function public.my_cash_balance(), public.set_cash_balance(bigint) to authenticated;

-- Ya no se registran entradas y salidas sueltas: se actualiza la cuenta.
drop function public.register_cash_movement(text, bigint, text);

update public.permissions set label = 'Subir el saldo de su cuenta', description = 'Actualizar su cuenta con un saldo mayor'
  where key = 'cash.write';
update public.permissions set label = 'Bajar el saldo de su cuenta', description = 'Actualizar su cuenta con un saldo menor y anular movimientos'
  where key = 'cash.withdraw';
