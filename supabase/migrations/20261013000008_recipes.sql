-- Pinkside · Fase 5 · Recetas.
-- Receta = ingredientes (items del inventario) + unidades que produce + precio de venta por unidad.
-- "Fabricar" consume los ingredientes y suma el producto de forma atómica, con movimientos de stock trazables.

insert into public.permissions (key, label, description)
values ('recipes.view', 'Ver recetas', 'Consultar recetas y calcular costes y beneficios');
insert into public.rank_permissions (rank_id, permission)
select id, 'recipes.view' from public.ranks;
update public.permissions
set label = 'Gestionar recetas', description = 'Crear, editar, archivar y borrar recetas'
where key = 'recipes.edit';

create table public.recipes (
  id integer generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 60),
  notes text check (notes is null or char_length(notes) between 1 and 300),
  sale_price bigint not null default 0 check (sale_price between 0 and 1000000000),
  output_qty integer not null default 1 check (output_qty between 1 and 1000),
  output_item_id integer references public.items (id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recipes_name_key on public.recipes (lower(name));
create index recipes_output_item_id_idx on public.recipes (output_item_id);
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  recipe_id integer not null references public.recipes (id) on delete cascade,
  item_id integer not null references public.items (id),
  quantity integer not null check (quantity between 1 and 1000000),
  primary key (recipe_id, item_id)
);
create index recipe_ingredients_item_id_idx on public.recipe_ingredients (item_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
create policy recipes_select on public.recipes for select to authenticated
  using ((select public.has_perm('recipes.view')));
create policy recipe_ingredients_select on public.recipe_ingredients for select to authenticated
  using ((select public.has_perm('recipes.view')));
revoke all on public.recipes, public.recipe_ingredients from anon, authenticated;
grant select on public.recipes, public.recipe_ingredients to authenticated;

-- Crea (p_id nulo) o actualiza una receta y reemplaza sus ingredientes en una sola operación.
create function public.save_recipe(
  p_id integer, p_name text, p_notes text, p_sale_price bigint, p_output_qty integer,
  p_output_item integer, p_ingredients jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id integer;
  v_el jsonb;
  v_item integer;
  v_seen integer[] := '{}';
begin
  if not public.has_perm('recipes.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) not between 1 and 30 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.recipes (name, notes, sale_price, output_qty, output_item_id)
    values (btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_notes, '')), ''),
            coalesce(p_sale_price, 0), coalesce(p_output_qty, 1), p_output_item)
    returning id into v_id;
  else
    update public.recipes
    set name = btrim(coalesce(p_name, '')), notes = nullif(btrim(coalesce(p_notes, '')), ''),
        sale_price = coalesce(p_sale_price, 0), output_qty = coalesce(p_output_qty, 1),
        output_item_id = p_output_item
    where id = p_id;
    if not found then
      raise exception 'La receta no existe' using errcode = 'P0002';
    end if;
    v_id := p_id;
    delete from public.recipe_ingredients where recipe_id = v_id;
  end if;

  for v_el in select * from jsonb_array_elements(p_ingredients) loop
    v_item := (v_el ->> 'item_id')::integer;
    if v_item is null or v_item = any (v_seen) then
      raise exception 'Ingrediente repetido o sin item' using errcode = '22023';
    end if;
    v_seen := v_seen || v_item;
    insert into public.recipe_ingredients (recipe_id, item_id, quantity)
    values (v_id, v_item, (v_el ->> 'quantity')::integer);
  end loop;
  return v_id;
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range or not_null_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
  when foreign_key_violation then
    raise exception 'Un item de la receta no existe' using errcode = 'P0002';
end $$;

create function public.set_recipe_archived(p_id integer, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('recipes.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update public.recipes set archived = coalesce(p_archived, false) where id = p_id;
  if not found then
    raise exception 'La receta no existe' using errcode = 'P0002';
  end if;
end $$;

create function public.delete_recipe(p_id integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm('recipes.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.recipes where id = p_id;
  if not found then
    raise exception 'La receta no existe' using errcode = 'P0002';
  end if;
end $$;

-- Fabrica N tandas: resta los ingredientes y suma el producto (si la receta tiene item de salida).
-- Todo o nada. Si falta stock de cualquier ingrediente falla con PK002 y el item en `detail`.
create function public.craft_recipe(p_recipe integer, p_batches integer) returns jsonb
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

  select * into v_recipe from public.recipes where id = p_recipe;
  if not found then
    raise exception 'La receta no existe' using errcode = 'P0002';
  end if;
  if v_recipe.archived then
    raise exception 'La receta está archivada' using errcode = 'P0003';
  end if;

  -- Bloquea todos los items implicados siempre en el mismo orden (evita bloqueos cruzados).
  perform 1 from public.items
  where id in (select item_id from public.recipe_ingredients where recipe_id = p_recipe
               union select v_recipe.output_item_id where v_recipe.output_item_id is not null)
  order by id for update;

  -- Comprueba el stock de TODOS los ingredientes antes de mover nada.
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

revoke execute on function
  public.save_recipe(integer, text, text, bigint, integer, integer, jsonb),
  public.set_recipe_archived(integer, boolean),
  public.delete_recipe(integer),
  public.craft_recipe(integer, integer)
from public, anon;
grant execute on function
  public.save_recipe(integer, text, text, bigint, integer, integer, jsonb),
  public.set_recipe_archived(integer, boolean),
  public.delete_recipe(integer),
  public.craft_recipe(integer, integer)
to authenticated;
