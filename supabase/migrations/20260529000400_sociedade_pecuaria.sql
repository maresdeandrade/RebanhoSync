-- 1. Proteção de Depreciação Segura da Tabela Legada
DO $$
DECLARE
  v_count int := 0;
BEGIN
  IF to_regclass('public.animais_sociedade') IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.animais_sociedade;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'Existem % registros em public.animais_sociedade. Não é seguro depreciar/remover.', v_count;
    END IF;

    ALTER TABLE public.animais_sociedade
      RENAME TO animais_sociedade_deprecated_20260529;
  END IF;
END $$;

-- 2. Tabela: sociedades_pecuarias
create table public.sociedades_pecuarias (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  contraparte_id uuid not null,
  nome text not null,
  status text not null default 'ativa',
  data_inicio date not null,
  data_fim date null,
  
  percentual_fazenda numeric(7,4) not null,
  percentual_parceiro numeric(7,4) not null,

  regra_custos text not null default 'proporcional',
  regra_perdas text not null default 'proporcional',
  regra_receita text not null default 'proporcional',

  observacoes text null,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint fk_sociedades_pecuarias_contraparte_fazenda 
    foreign key (contraparte_id, fazenda_id) references public.contrapartes(id, fazenda_id) on delete cascade,

  constraint chk_sociedade_status 
    check (status in ('ativa', 'encerrada', 'suspensa')),

  constraint chk_sociedade_percentuais_positivos 
    check (percentual_fazenda >= 0 and percentual_parceiro >= 0),

  constraint chk_sociedade_percentuais_soma 
    check (abs((percentual_fazenda + percentual_parceiro) - 100) < 0.0001),

  constraint chk_sociedade_regras_custos 
    check (regra_custos in ('fazenda', 'parceiro', 'proporcional', 'manual')),

  constraint chk_sociedade_regras_perdas 
    check (regra_perdas in ('fazenda', 'parceiro', 'proporcional', 'manual')),

  constraint chk_sociedade_regras_receita 
    check (regra_receita in ('proporcional', 'manual')),

  constraint chk_sociedade_encerramento 
    check (
      (status = 'ativa' and data_fim is null) or 
      (status = 'encerrada' and data_fim is not null) or
      (status = 'suspensa')
    ),
    
  constraint uq_sociedades_pecuarias_id_fazenda unique (id, fazenda_id)
);

-- Índices e Segurança
create index idx_sociedades_pecuarias_fazenda on public.sociedades_pecuarias(fazenda_id);
create index idx_sociedades_pecuarias_contraparte on public.sociedades_pecuarias(fazenda_id, contraparte_id);
create index idx_sociedades_pecuarias_status on public.sociedades_pecuarias(fazenda_id, status);
create index idx_sociedades_pecuarias_deleted_at on public.sociedades_pecuarias(fazenda_id, deleted_at);

alter table public.sociedades_pecuarias enable row level security;
create policy sociedades_pecuarias_select_member on public.sociedades_pecuarias for select using (public.has_membership(fazenda_id));
create policy sociedades_pecuarias_write_manager on public.sociedades_pecuarias for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));

-- 3. Tabela: sociedade_animais
create table public.sociedade_animais (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  sociedade_id uuid not null,
  animal_id uuid not null,
  data_entrada date not null,
  data_saida date null,
  status text not null default 'ativo',
  motivo_saida text null,
  observacoes text null,
  payload jsonb not null default '{}'::jsonb,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint fk_sociedade_animais_sociedade_fazenda 
    foreign key (sociedade_id, fazenda_id) references public.sociedades_pecuarias(id, fazenda_id) on delete cascade,
    
  constraint fk_sociedade_animais_animal_fazenda 
    foreign key (animal_id, fazenda_id) references public.animais(id, fazenda_id) on delete cascade,

  constraint chk_sociedade_animais_status 
    check (status in ('ativo', 'encerrado')),

  constraint chk_sociedade_animais_encerramento 
    check (
      (status = 'ativo' and data_saida is null) or 
      (status = 'encerrado' and data_saida is not null and motivo_saida is not null)
    )
);

-- Índice Único Parcial: Um animal só pode ter uma sociedade ativa
create unique index idx_sociedade_animais_unique_active 
  on public.sociedade_animais(fazenda_id, animal_id) 
  where deleted_at is null and status = 'ativo';

-- Índices e Segurança
create index idx_sociedade_animais_fazenda_sociedade on public.sociedade_animais(fazenda_id, sociedade_id);
create index idx_sociedade_animais_fazenda_animal on public.sociedade_animais(fazenda_id, animal_id);
create index idx_sociedade_animais_fazenda_status on public.sociedade_animais(fazenda_id, status);
create index idx_sociedade_animais_deleted_at on public.sociedade_animais(fazenda_id, deleted_at);

alter table public.sociedade_animais enable row level security;
create policy sociedade_animais_select_member on public.sociedade_animais for select using (public.has_membership(fazenda_id));
create policy sociedade_animais_write_manager on public.sociedade_animais for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
