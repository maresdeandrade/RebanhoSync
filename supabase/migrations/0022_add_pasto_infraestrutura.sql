-- Add infraestrutura column to pastos table
alter table public.pastos
add column if not exists infraestrutura jsonb not null default '{}'::jsonb;

-- Add tipo_pasto column
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_pasto_enum') then
    create type public.tipo_pasto_enum as enum (
      'nativo',
      'cultivado',
      'integracao',
      'degradado'
    );
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'pastos' and column_name = 'tipo_pasto'
  ) then
    alter table public.pastos add column tipo_pasto public.tipo_pasto_enum null;
  end if;
end $$;
