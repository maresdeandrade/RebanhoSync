-- 0021_add_animais_origem_raca.sql
-- Adiciona campos origem (enum) e raca (text) à tabela animais

do $$
begin
  -- 1. Criar ENUM origem
  if not exists (select 1 from pg_type where typname = 'origem_enum') then
    create type public.origem_enum as enum (
      'nascimento',    -- Nascido na fazenda
      'compra',        -- Comprado
      'doacao',        -- Doação recebida
      'arrendamento',  -- Arrendado
      'sociedade'      -- Parceria/sociedade
    );
  end if;

  -- 2. Adicionar coluna origem
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'animais' and column_name = 'origem'
  ) then
    alter table public.animais add column origem public.origem_enum null;
  end if;

  -- 3. Adicionar coluna raca
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'animais' and column_name = 'raca'
  ) then
    alter table public.animais add column raca text null;
  end if;

end $$;

-- Comentários
comment on column public.animais.origem is
  'Como o animal chegou à fazenda (nascimento, compra, doação, arrendamento, sociedade)';
comment on column public.animais.raca is
  'Raça ou composição racial do animal';
