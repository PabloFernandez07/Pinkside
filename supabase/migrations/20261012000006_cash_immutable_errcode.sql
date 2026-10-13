-- P0004 es el código de assert_failure de PostgreSQL (el único que EXCEPTION WHEN OTHERS no captura).
-- Usamos un código propio para el bloqueo de la caja. create or replace conserva los permisos revocados.
create or replace function public.cash_movements_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Los movimientos de caja no se pueden modificar ni borrar' using errcode = 'PK001';
end $$;
