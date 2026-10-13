-- Pinkside · Secciones que se pueden desactivar (Inventario y Recetas).
-- Una sección desactivada desaparece del menú y sus páginas redirigen al resumen. Los datos no se tocan.
-- Se guarda en app_settings (sin acceso directo para la web) y se lee/escribe solo con estas dos funciones.

insert into public.app_settings (key, value) values ('disabled_sections', '[]'::jsonb)
on conflict (key) do nothing;

-- Secciones desactivadas: cualquier miembro activo necesita saberlo para pintar el menú.
create function public.get_disabled_sections() returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_member() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return coalesce(
    (select array(select jsonb_array_elements_text(s.value)) from public.app_settings s where s.key = 'disabled_sections'),
    '{}'
  );
end $$;

create function public.set_section_disabled(p_section text, p_disabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_value jsonb;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_disabled is null or p_section is null or p_section not in ('inventario', 'recetas') then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select value into v_value from public.app_settings where key = 'disabled_sections' for update;
  v_value := coalesce(v_value, '[]'::jsonb) - p_section;
  if p_disabled then
    v_value := v_value || to_jsonb(p_section);
  end if;
  insert into public.app_settings (key, value) values ('disabled_sections', v_value)
  on conflict (key) do update set value = excluded.value;
end $$;

revoke execute on function public.get_disabled_sections(), public.set_section_disabled(text, boolean)
  from public, anon;
grant execute on function public.get_disabled_sections(), public.set_section_disabled(text, boolean)
  to authenticated;
