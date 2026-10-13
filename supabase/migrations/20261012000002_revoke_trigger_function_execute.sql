-- handle_new_user y set_updated_at son funciones de trigger: no deben ser invocables desde la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
