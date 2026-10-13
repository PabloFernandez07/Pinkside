-- Pinkside · Endurecimiento tras la revisión de seguridad/BD. Todo con `create or replace` (conserva los permisos de ejecución).

-- 1) CRÍTICO: un tipo de movimiento nulo se saltaba la comprobación de permisos (NULL no entra en ningún `if`).
create or replace function public.register_cash_movement(p_kind text, p_amount bigint, p_reason text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_author text;
  v_id bigint;
begin
  if p_kind is null or p_kind not in ('in', 'out') then
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

-- 2) Mismo fallo en stock: `p_kind` nulo evitaba la comprobación de stock insuficiente.
create or replace function public.register_stock_movement(p_item integer, p_kind text, p_qty integer, p_reason text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_author text;
  v_item public.items;
  v_stock integer;
  v_id bigint;
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('in', 'out') or p_qty is null or p_qty < 1 or p_qty > 1000000
     or char_length(v_reason) not between 2 and 160 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  select * into v_item from public.items where id = p_item for update;
  if not found then
    raise exception 'El item no existe' using errcode = 'P0002';
  end if;
  if v_item.archived then
    raise exception 'El item está archivado' using errcode = 'P0003';
  end if;

  select coalesce(sum(delta), 0) into v_stock from public.stock_movements where item_id = p_item;
  if p_kind = 'out' and v_stock - p_qty < 0 then
    raise exception 'Stock insuficiente' using errcode = 'PK002';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  insert into public.stock_movements (item_id, member_id, author_name, delta, reason)
  values (p_item, v_uid, v_author, case when p_kind = 'in' then p_qty else -p_qty end, v_reason)
  returning id into v_id;
  return v_id;
end $$;

-- 3) Anular dos veces el mismo movimiento daba "stock insuficiente" en lugar de "ya anulado".
create or replace function public.reverse_stock_movement(p_id bigint, p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original public.stock_movements;
  v_stock integer;
  v_author text;
  v_id bigint;
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 2 and 100 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  select * into v_original from public.stock_movements where id = p_id;
  if not found then
    raise exception 'El movimiento no existe' using errcode = 'P0002';
  end if;
  if v_original.reverses_id is not null then
    raise exception 'No se puede anular una anulación' using errcode = 'P0003';
  end if;

  perform 1 from public.items where id = v_original.item_id for update;
  if exists (select 1 from public.stock_movements where reverses_id = p_id) then
    raise exception 'El movimiento ya está anulado' using errcode = '23505';
  end if;
  select coalesce(sum(delta), 0) into v_stock from public.stock_movements where item_id = v_original.item_id;
  if v_stock - v_original.delta < 0 then
    raise exception 'Stock insuficiente para anular' using errcode = 'PK002';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  insert into public.stock_movements (item_id, member_id, author_name, delta, reason, reverses_id)
  values (v_original.item_id, v_uid, v_author, -v_original.delta, 'Anulación #' || p_id || ': ' || v_reason, p_id)
  returning id into v_id;
  return v_id;
end $$;

-- 4) Booleanos nulos: `set_member_blocked(.., null)` desbloqueaba y `set_rank_permission(.., null)` revocaba.
create or replace function public.set_member_blocked(p_member uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_actor smallint := public.my_rank_level(); v_target smallint;
begin
  if not public.has_perm('members.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_blocked is null then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  if p_member = (select auth.uid()) then
    raise exception 'No puedes bloquearte a ti mismo' using errcode = '42501';
  end if;
  select coalesce(r.level, 0) into v_target from public.profiles pr
    left join public.ranks r on r.id = pr.rank_id where pr.id = p_member;
  if v_target is null or (v_target >= v_actor and v_actor < 100) then
    raise exception 'Acción no permitida' using errcode = '42501';
  end if;
  update public.profiles
  set status = case when p_blocked then 'blocked'::public.member_status else 'active'::public.member_status end
  where id = p_member and status in ('active', 'blocked');
  if not found then
    raise exception 'Solo se puede bloquear o desbloquear a miembros activos' using errcode = 'P0003';
  end if;
end $$;

create or replace function public.set_rank_permission(p_rank smallint, p_permission text, p_allowed boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor smallint := public.my_rank_level();
  v_target smallint;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_allowed is null then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select level into v_target from public.ranks where id = p_rank;
  if v_target is null then
    raise exception 'El rango no existe' using errcode = 'P0002';
  end if;
  if v_actor < 100 and v_target >= v_actor then
    raise exception 'Solo puedes editar rangos inferiores al tuyo' using errcode = '42501';
  end if;
  if not exists (select 1 from public.permissions where key = p_permission) then
    raise exception 'Permiso desconocido' using errcode = 'P0002';
  end if;

  if p_allowed then
    if v_actor < 100 and not public.has_perm(p_permission) then
      raise exception 'No puedes conceder un permiso que no tienes' using errcode = '42501';
    end if;
    insert into public.rank_permissions (rank_id, permission) values (p_rank, p_permission)
    on conflict do nothing;
  else
    if v_target = 100 and p_permission in ('members.manage', 'roles.manage') then
      raise exception 'El Líder no puede perder este permiso' using errcode = 'P0003';
    end if;
    delete from public.rank_permissions where rank_id = p_rank and permission = p_permission;
  end if;
end $$;

-- 5) El ID de Discord solo se acepta si el registro viene realmente de Discord. `raw_app_meta_data` lo escribe
--    el servidor de autenticación; `raw_user_meta_data` lo controla el cliente (con el registro por email
--    activado, alguien podría declarar el ID de Discord del Líder y heredar su rango).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_discord text := coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub');
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'discord' then
    raise exception 'Solo se admite el registro con Discord';
  end if;
  if v_discord is null then
    raise exception 'Falta la identidad de Discord en el registro';
  end if;
  insert into public.profiles (id, discord_id, discord_username, avatar_url)
  values (
    new.id,
    v_discord,
    regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
      '#0+$', ''
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

-- 6) Fabricar contra editar la receta a la vez: bloquea la receta (FOR SHARE) mientras se fabrica.
create or replace function public.craft_recipe(p_recipe integer, p_batches integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_recipe public.recipes;
  v_author text;
  v_reason text;
  v_row record;
  v_out public.items;
  v_consumed integer := 0;
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_batches is null or p_batches < 1 or p_batches > 10000 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  select * into v_recipe from public.recipes where id = p_recipe for share;
  if not found then
    raise exception 'La receta no existe' using errcode = 'P0002';
  end if;
  if v_recipe.archived then
    raise exception 'La receta está archivada' using errcode = 'P0003';
  end if;

  perform 1 from public.items
  where id in (select item_id from public.recipe_ingredients where recipe_id = p_recipe
               union select v_recipe.output_item_id where v_recipe.output_item_id is not null)
  order by id for update;

  for v_row in
    select ri.item_id, ri.quantity::bigint * p_batches as need, i.name, i.archived,
           coalesce((select sum(m.delta) from public.stock_movements m where m.item_id = ri.item_id), 0) as stock
    from public.recipe_ingredients ri join public.items i on i.id = ri.item_id
    where ri.recipe_id = p_recipe
  loop
    if v_row.archived then
      raise exception 'Un ingrediente está archivado' using errcode = 'P0003', detail = v_row.name;
    end if;
    if v_row.need > 1000000 then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
    if v_row.stock < v_row.need then
      raise exception 'Stock insuficiente' using errcode = 'PK002', detail = v_row.name;
    end if;
  end loop;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;
  v_reason := 'Crafteo: ' || v_recipe.name || ' ×' || p_batches;

  for v_row in select item_id, quantity from public.recipe_ingredients where recipe_id = p_recipe order by item_id loop
    insert into public.stock_movements (item_id, member_id, author_name, delta, reason)
    values (v_row.item_id, v_uid, v_author, -(v_row.quantity * p_batches), v_reason);
    v_consumed := v_consumed + 1;
  end loop;

  if v_recipe.output_item_id is not null then
    select * into v_out from public.items where id = v_recipe.output_item_id;
    if v_out.archived then
      raise exception 'El item de salida está archivado' using errcode = 'P0003', detail = v_out.name;
    end if;
    if v_recipe.output_qty::bigint * p_batches > 1000000 then
      raise exception 'Datos no válidos' using errcode = '22023';
    end if;
    insert into public.stock_movements (item_id, member_id, author_name, delta, reason)
    values (v_recipe.output_item_id, v_uid, v_author, v_recipe.output_qty * p_batches, v_reason);
  end if;

  return jsonb_build_object(
    'batches', p_batches,
    'units', v_recipe.output_qty * p_batches,
    'consumed_items', v_consumed,
    'output_item_id', v_recipe.output_item_id
  );
exception
  when check_violation or numeric_value_out_of_range then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

-- 7) Límite anti-spam de urgentes: serializa por autor para que las peticiones simultáneas no lo esquiven.
create or replace function public.create_urgent_request(
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
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
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

-- 8) Rendimiento: el Resumen ordena el libro de stock por fecha (feed de actividad).
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
