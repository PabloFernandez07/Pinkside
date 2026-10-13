-- Pinkside · Recetas: dónde se fabrican y creación del item producido.
-- Una receta puede crear el item que produce (con su foto y stock mínimo); su coste unitario se calcula a partir
-- de los ingredientes (coste de una tanda ÷ unidades por tanda) y se recalcula cada vez que se guarda la receta.

alter table public.recipes
  add column craft_location text not null default 'workbench'
  check (craft_location in ('workbench', 'hand'));

drop function public.save_recipe(integer, text, text, bigint, integer, integer, jsonb);

create function public.save_recipe(
  p_id integer, p_name text, p_notes text, p_sale_price bigint, p_output_qty integer,
  p_output_item integer, p_ingredients jsonb,
  p_craft_location text default 'workbench',
  p_new_item jsonb default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id integer;
  v_el jsonb;
  v_item integer;
  v_seen integer[] := '{}';
  v_qty integer := coalesce(p_output_qty, 1);
  v_cost numeric;
  v_unit bigint;
  v_new integer;
begin
  if not public.has_perm('recipes.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_new_item is not null and not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso para crear items' using errcode = '42501';
  end if;
  if p_new_item is not null and p_output_item is not null then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  if p_craft_location is null or p_craft_location not in ('workbench', 'hand') then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) not between 1 and 30 then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.recipes (name, notes, sale_price, output_qty, output_item_id, craft_location)
    values (btrim(coalesce(p_name, '')), nullif(btrim(coalesce(p_notes, '')), ''),
            coalesce(p_sale_price, 0), v_qty, p_output_item, p_craft_location)
    returning id into v_id;
  else
    update public.recipes
    set name = btrim(coalesce(p_name, '')), notes = nullif(btrim(coalesce(p_notes, '')), ''),
        sale_price = coalesce(p_sale_price, 0), output_qty = v_qty,
        output_item_id = p_output_item, craft_location = p_craft_location
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

  -- Coste unitario del producto: lo que cuesta una tanda repartido entre las unidades que produce.
  select coalesce(sum(ri.quantity * i.unit_cost), 0) into v_cost
  from public.recipe_ingredients ri join public.items i on i.id = ri.item_id
  where ri.recipe_id = v_id;
  v_unit := round(v_cost / v_qty)::bigint;

  if p_new_item is not null then
    insert into public.items (name, category, min_stock, unit_cost, image_path)
    values (
      coalesce(nullif(btrim(coalesce(p_new_item ->> 'name', '')), ''), btrim(coalesce(p_name, ''))),
      nullif(btrim(coalesce(p_new_item ->> 'category', '')), ''),
      coalesce((p_new_item ->> 'min_stock')::integer, 0),
      v_unit,
      nullif(p_new_item ->> 'image_path', '')
    ) returning id into v_new;
    update public.recipes set output_item_id = v_new where id = v_id;
  elsif p_output_item is not null then
    update public.items set unit_cost = v_unit where id = p_output_item;
  end if;
  return v_id;
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range or not_null_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
  when foreign_key_violation then
    raise exception 'Un item de la receta no existe' using errcode = 'P0002';
end $$;

revoke execute on function public.save_recipe(integer, text, text, bigint, integer, integer, jsonb, text, jsonb)
  from public, anon;
grant execute on function public.save_recipe(integer, text, text, bigint, integer, integer, jsonb, text, jsonb)
  to authenticated;
