-- Pinkside · El acento por defecto de las cuentas nuevas pasa a ser Pinkside (rosa).
-- Las cuentas que ya existen conservan el acento que tengan guardado.
alter table public.profiles alter column accent set default 'pink';
