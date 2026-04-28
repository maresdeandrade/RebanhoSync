-- 0019_create_animais_sociedade.sql
-- Cria tabela animais_sociedade para rastrear animais de terceiros

do $$
begin
  -- 1. Criar tabela animais_sociedade
  if not exists (
    select 1 from information_schema.tables
    where table_name = 'animais_sociedade'
  ) then
    create table public.animais_sociedade (
      id uuid primary key default gen_random_uuid(),
      fazenda_id uuid not null references public.fazendas(id),
      
      animal_id uuid not null,
      contraparte_id uuid not null,
      
      percentual numeric(5,2) null check (percentual >= 0 and percentual <= 100),
      inicio date not null default current_date,
      fim date null,
      
      payload jsonb not null default '{}'::jsonb,
      
      -- sync metadata
      client_id text not null,
      client_op_id uuid not null,
      client_tx_id uuid null,
      client_recorded_at timestamptz not null,
      server_received_at timestamptz not null default now(),
      
      deleted_at timestamptz null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;

  -- 2. Trigger de updated_at
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_animais_sociedade_updated_at'
  ) then
    create trigger trg_animais_sociedade_updated_at
    before update on public.animais_sociedade
    for each row execute function public.set_updated_at();
  end if;

  -- 3. Garantir índices únicos compostos nas tabelas referenciadas
  
  -- Índice único (id, fazenda_id) em animais (já deve existir)
  if not exists (
    select 1 from pg_indexes
    where tablename = 'animais' and indexname = 'uq_animais_id_fazenda'
  ) then
    create unique index uq_animais_id_fazenda
      on public.animais (id, fazenda_id);
  end if;

  -- Índice único (id, fazenda_id) em contrapartes (verific ar se já existe do 0001_init)
  if not exists (
    select 1 from pg_indexes
    where tablename = 'contrapartes' and indexname = 'ux_contrapartes_id_fazenda'
  ) then
    -- Já existe como ux_contrapartes_id_fazenda no 0001_init.sql
    -- Não precisa criar novamente
  end if;

  -- 4. Foreign Keys Compostas
  
  -- FK animal_id + fazenda_id → animais
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_animais_sociedade_animal'
  ) then
    alter table public.animais_sociedade
      add constraint fk_animais_sociedade_animal
      foreign key (animal_id, fazenda_id)
      references public.animais (id, fazenda_id) on delete restrict;
  end if;

  -- FK contraparte_id + fazenda_id → contrapartes
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_animais_sociedade_contraparte'
  ) then
    alter table public.animais_sociedade
      add constraint fk_animais_sociedade_contraparte
      foreign key (contraparte_id, fazenda_id)
      references public.contrapartes (id, fazenda_id) on delete restrict;
  end if;

  -- 5. Constraints

  -- Apenas uma sociedade ativa por animal
  if not exists (
    select 1 from pg_indexes
    where tablename = 'animais_sociedade' and indexname = 'uq_animais_sociedade_ativa'
  ) then
    create unique index uq_animais_sociedade_ativa
      on public.animais_sociedade (fazenda_id, animal_id)
      where deleted_at is null and fim is null;
  end if;

  -- 6. Habilitar RLS
  alter table public.animais_sociedade enable row level security;

  -- 7. RLS Policies
  
  -- SELECT: todos os membros da fazenda
  if not exists (
    select 1 from pg_policies
    where tablename = 'animais_sociedade' and policyname = 'animais_sociedade_select'
  ) then
    create policy animais_sociedade_select
      on public.animais_sociedade for select
      using (public.has_membership(fazenda_id));
  end if;

  -- WRITE: apenas owner/manager
  if not exists (
    select 1 from pg_policies
    where tablename = 'animais_sociedade' and policyname = 'animais_sociedade_write'
  ) then
    create policy animais_sociedade_write
      on public.animais_sociedade for all
      using (public.has_membership(fazenda_id))
      with check (
        public.has_membership(fazenda_id)
        and public.role_in_fazenda(fazenda_id) in ('owner','manager')
      );
  end if;

end $$;

-- Comentários
comment on table public.animais_sociedade is
  'Rastreamento de animais de terceiros na fazenda (parceria/sociedade)';
comment on column public.animais_sociedade.animal_id is
  'Animal em sociedade';
comment on column public.animais_sociedade.contraparte_id is
  'Dono/parceiro do animal';
comment on column public.animais_sociedade.percentual is
  'Percentual de participação da fazenda (0-100%)';
comment on column public.animais_sociedade.inicio is
  'Data de início da sociedade';
comment on column public.animais_sociedade.fim is
  'Data de encerramento da sociedade (null = ativa)';
