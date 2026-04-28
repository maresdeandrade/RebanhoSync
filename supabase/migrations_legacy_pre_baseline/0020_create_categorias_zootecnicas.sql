-- 0020_create_categorias_zootecnicas.sql
-- Cria tabela de regras para classificação zootécnica de animais

do $$
begin
  -- 1. Criar tabela categorias_zootecnicas
  if not exists (
    select 1 from information_schema.tables
    where table_name = 'categorias_zootecnicas'
  ) then
    create table public.categorias_zootecnicas (
      id uuid primary key default gen_random_uuid(),
      fazenda_id uuid not null references public.fazendas(id),
      
      -- Classificação
      categoria text not null check (categoria in (
        'bezerro', 'garrote', 'boi', 'touro',
        'bezerra', 'novilha', 'vaca'
      )),
      sexo char(1) not null check (sexo in ('M', 'F')),
      
      -- Faixa etária (em meses)
      idade_min_meses int not null check (idade_min_meses >= 0),
      idade_max_meses int null check (idade_max_meses is null or idade_max_meses > idade_min_meses),
      
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      
      -- Apenas uma regra por (fazenda, categoria, sexo)
      unique (fazenda_id, categoria, sexo)
    );
  end if;

  -- 2. Trigger de updated_at
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_categorias_zootecnicas_updated_at'
  ) then
    create trigger trg_categorias_zootecnicas_updated_at
    before update on public.categorias_zootecnicas
    for each row execute function public.set_updated_at();
  end if;

  -- 3. Habilitar RLS
  alter table public.categorias_zootecnicas enable row level security;

  -- 4. RLS Policies
  
  -- SELECT: todos os membros da fazenda
  if not exists (
    select 1 from pg_policies
    where tablename = 'categorias_zootecnicas' and policyname = 'categorias_zootecnicas_select'
  ) then
    create policy categorias_zootecnicas_select
      on public.categorias_zootecnicas for select
      using (public.has_membership(fazenda_id));
  end if;

  -- WRITE: apenas owner
  if not exists (
    select 1 from pg_policies
    where tablename = 'categorias_zootecnicas' and policyname = 'categorias_zootecnicas_write'
  ) then
    create policy categorias_zootecnicas_write
      on public.categorias_zootecnicas for all
      using (public.has_membership(fazenda_id))
      with check (
        public.has_membership(fazenda_id)
        and public.role_in_fazenda(fazenda_id) = 'owner'
      );
  end if;

end $$;

-- Comentários
comment on table public.categorias_zootecnicas is
  'Regras para classificação zootécnica de animais (bezerro, novilho, boi, etc.)';
comment on column public.categorias_zootecnicas.categoria is
  'Categoria zootécnica (bezerro/novilho/boi/bezerra/novilha/vaca)';
comment on column public.categorias_zootecnicas.idade_min_meses is
  'Idade mínima em meses para esta categoria';
comment on column public.categorias_zootecnicas.idade_max_meses is
  'Idade máxima em meses (null = sem limite superior)';
