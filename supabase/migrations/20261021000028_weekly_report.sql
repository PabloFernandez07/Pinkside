-- Pinkside · Informe semanal de actos ilícitos. Una fila por semana (identificada por su lunes); las secciones son
-- un JSON con un array de textos por sección. Solo quien tiene `roles.manage` lo ve y lo edita.

create table public.weekly_reports (
  week_start date primary key check (extract(isodow from week_start) = 1),
  sections jsonb not null check (jsonb_typeof(sections) = 'object' and octet_length(sections::text) <= 60000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_by_name text not null default ''
);
alter table public.weekly_reports enable row level security;
create policy weekly_reports_select on public.weekly_reports for select to authenticated
  using ((select public.has_perm('roles.manage')));
revoke all on public.weekly_reports from anon, authenticated;
grant select on public.weekly_reports to authenticated;

create function public.save_weekly_report(p_week date, p_sections jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.has_perm('roles.manage') then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if p_week is null or extract(isodow from p_week) <> 1 or p_sections is null
     or jsonb_typeof(p_sections) <> 'object' then
    raise exception 'Datos no válidos' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), discord_username, 'Miembro')
    into v_name from public.profiles where id = auth.uid();
  insert into public.weekly_reports (week_start, sections, updated_by, updated_by_name)
  values (p_week, p_sections, auth.uid(), coalesce(v_name, ''))
  on conflict (week_start) do update
    set sections = excluded.sections, updated_at = now(),
        updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name;
end $$;
revoke execute on function public.save_weekly_report(date, jsonb) from public, anon;
grant execute on function public.save_weekly_report(date, jsonb) to authenticated;
