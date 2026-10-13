-- Pinkside · Fase 4 · Inventario.
-- Catálogo de items editable + libro de movimientos de stock de solo-añadir (como la caja).
-- El stock nunca se edita a mano: es la suma de los movimientos y nunca puede quedar en negativo.

-- Permiso para consultar; inventory.edit sigue siendo el de gestionar (crear items, mover stock, anular).
insert into public.permissions (key, label, description)
values ('inventory.view', 'Ver inventario', 'Consultar items, stock e historial de movimientos');
insert into public.rank_permissions (rank_id, permission)
select id, 'inventory.view' from public.ranks;
update public.permissions
set label = 'Gestionar inventario', description = 'Crear y editar items, mover stock y anular movimientos'
where key = 'inventory.edit';

create table public.items (
  id integer generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 60),
  category text check (category is null or char_length(category) between 2 and 40),
  min_stock integer not null default 0 check (min_stock between 0 and 1000000),
  unit_cost bigint not null default 0 check (unit_cost between 0 and 1000000000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index items_name_key on public.items (lower(name));
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id bigint generated always as identity primary key,
  item_id integer not null references public.items (id),
  member_id uuid not null references public.profiles (id),
  author_name text not null check (char_length(author_name) between 1 and 100),
  delta integer not null check (delta <> 0 and abs(delta) <= 1000000),
  reason text not null check (char_length(reason) between 2 and 160),
  reverses_id bigint references public.stock_movements (id),
  created_at timestamptz not null default now()
);
create index stock_movements_item_id_idx on public.stock_movements (item_id, id desc);
create index stock_movements_member_id_idx on public.stock_movements (member_id);
create unique index stock_movements_reverses_id_key on public.stock_movements (reverses_id)
  where reverses_id is not null;

-- Inmutabilidad (código propio PK001: P0004 es assert_failure y WHEN OTHERS no lo captura).
create function public.stock_movements_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Los movimientos de stock no se pueden modificar ni borrar' using errcode = 'PK001';
end $$;
create trigger stock_movements_no_change before update or delete on public.stock_movements
  for each row execute function public.stock_movements_immutable();
create trigger stock_movements_no_truncate before truncate on public.stock_movements
  for each statement execute function public.stock_movements_immutable();
revoke execute on function public.stock_movements_immutable() from public, anon, authenticated;

-- RLS: lectura con inventory.view; las escrituras solo pasan por las funciones de abajo.
alter table public.items enable row level security;
alter table public.stock_movements enable row level security;
create policy items_select on public.items for select to authenticated
  using ((select public.has_perm('inventory.view')));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select public.has_perm('inventory.view')));
revoke all on public.items, public.stock_movements from anon, authenticated;
grant select on public.items, public.stock_movements to authenticated;

-- Items con su stock actual (suma de movimientos). security_invoker: respeta el RLS de las tablas.
create view public.inventory_overview with (security_invoker = true) as
select i.id, i.name, i.category, i.min_stock, i.unit_cost, i.archived, i.created_at,
       coalesce(sum(m.delta), 0)::integer as stock
from public.items i
left join public.stock_movements m on m.item_id = i.id
group by i.id;
revoke all on public.inventory_overview from anon, authenticated;
grant select on public.inventory_overview to authenticated;

-- ---------- funciones de escritura (todas exigen inventory.edit) ----------

create function public.create_item(p_name text, p_category text, p_min_stock integer, p_unit_cost bigint)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_id integer;
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  insert into public.items (name, category, min_stock, unit_cost)
  values (btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_category, '')), ''),
          coalesce(p_min_stock, 0), coalesce(p_unit_cost, 0))
  returning id into v_id;
  return v_id;
exception
  when check_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

create function public.update_item(p_id integer, p_name text, p_category text, p_min_stock integer, p_unit_cost bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update public.items
  set name = btrim(coalesce(p_name, '')), category = nullif(btrim(coalesce(p_category, '')), ''),
      min_stock = coalesce(p_min_stock, 0), unit_cost = coalesce(p_unit_cost, 0)
  where id = p_id;
  if not found then
    raise exception 'El item no existe' using errcode = 'P0002';
  end if;
exception
  when check_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;

create function public.set_item_archived(p_id integer, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update public.items set archived = coalesce(p_archived, false) where id = p_id;
  if not found then
    raise exception 'El item no existe' using errcode = 'P0002';
  end if;
end $$;

-- Entradas y salidas de stock. Una salida nunca deja el stock por debajo de 0 (error PK002).
create function public.register_stock_movement(p_item integer, p_kind text, p_qty integer, p_reason text)
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
  if p_kind not in ('in', 'out') or p_qty is null or p_qty < 1 or p_qty > 1000000
     or char_length(v_reason) not between 2 and 160 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  -- Bloquea el item: dos salidas simultáneas no pueden dejar el stock en negativo.
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

-- Anula un movimiento creando el contrario enlazado. Si anular una entrada dejaría stock negativo, falla (PK002).
create function public.reverse_stock_movement(p_id bigint, p_reason text) returns bigint
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
  select coalesce(sum(delta), 0) into v_stock from public.stock_movements where item_id = v_original.item_id;
  if v_stock - v_original.delta < 0 then
    raise exception 'Stock insuficiente para anular' using errcode = 'PK002';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
  into v_author from public.profiles where id = v_uid;

  -- Si ya estaba anulado, el índice único reverses_id lanza 23505.
  insert into public.stock_movements (item_id, member_id, author_name, delta, reason, reverses_id)
  values (v_original.item_id, v_uid, v_author, -v_original.delta, 'Anulación #' || p_id || ': ' || v_reason, p_id)
  returning id into v_id;
  return v_id;
end $$;

-- Importación masiva: todo o nada. Los nombres que ya existen se omiten. Devuelve {created, skipped}.
create function public.create_items_bulk(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_el jsonb;
  v_name text;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_name := btrim(coalesce(v_el ->> 'name', ''));
    if exists (select 1 from public.items where lower(name) = lower(v_name)) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.items (name, category, min_stock, unit_cost)
    values (v_name, nullif(btrim(coalesce(v_el ->> 'category', '')), ''),
            coalesce((v_el ->> 'min_stock')::integer, 0), coalesce((v_el ->> 'unit_cost')::bigint, 0));
    v_created := v_created + 1;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Datos no válidos' using errcode = '22023';
  when unique_violation then
    raise exception 'Hay nombres repetidos en la lista' using errcode = '23505';
end $$;

revoke execute on function
  public.create_item(text, text, integer, bigint),
  public.update_item(integer, text, text, integer, bigint),
  public.set_item_archived(integer, boolean),
  public.register_stock_movement(integer, text, integer, text),
  public.reverse_stock_movement(bigint, text),
  public.create_items_bulk(jsonb)
from public, anon;
grant execute on function
  public.create_item(text, text, integer, bigint),
  public.update_item(integer, text, text, integer, bigint),
  public.set_item_archived(integer, boolean),
  public.register_stock_movement(integer, text, integer, text),
  public.reverse_stock_movement(bigint, text),
  public.create_items_bulk(jsonb)
to authenticated;
