-- Pinkside · Fotos de items. Las imágenes viven en un bucket público de Supabase Storage (`item-images`) y el item
-- guarda solo el nombre del archivo. Solo quien puede editar el inventario sube o borra fotos.

alter table public.items
  add column image_path text
  check (image_path is null or image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpg)$');

-- La vista añade la columna al final (create or replace no permite reordenar) y conserva security_invoker y permisos.
create or replace view public.inventory_overview with (security_invoker = true) as
select i.id, i.name, i.category, i.min_stock, i.unit_cost, i.archived, i.created_at,
       coalesce(sum(m.delta), 0)::integer as stock,
       i.image_path
from public.items i
left join public.stock_movements m on m.item_id = i.id
group by i.id;

-- Bucket público (las fotos de items no son sensibles; los nombres son UUID no adivinables). 256 KB y solo imágenes web.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 262144, array['image/webp', 'image/png', 'image/jpeg']);

create policy item_images_select on storage.objects for select to authenticated
  using (bucket_id = 'item-images' and (select public.is_active_member()));
create policy item_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (select public.has_perm('inventory.edit')));
create policy item_images_update on storage.objects for update to authenticated
  using (bucket_id = 'item-images' and (select public.has_perm('inventory.edit')))
  with check (bucket_id = 'item-images' and (select public.has_perm('inventory.edit')));
create policy item_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (select public.has_perm('inventory.edit')));

-- Asigna (o quita, con p_path nulo) la foto de un item. Devuelve el archivo anterior para que la app lo borre de Storage.
create function public.set_item_image(p_id integer, p_path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if not public.has_perm('inventory.edit') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  select image_path into v_old from public.items where id = p_id for update;
  if not found then
    raise exception 'El item no existe' using errcode = 'P0002';
  end if;
  update public.items set image_path = p_path where id = p_id;
  return v_old;
exception
  when check_violation then
    raise exception 'Datos no válidos' using errcode = '22023';
end $$;
revoke execute on function public.set_item_image(integer, text) from public, anon;
grant execute on function public.set_item_image(integer, text) to authenticated;
