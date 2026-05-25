-- Migration: Inventario de insumos tenant-scoped com rastreabilidade.
-- Mantem catalogos oficiais/globais separados do estoque operacional por fazenda.

create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  nome text not null,
  tipo text not null,
  categoria text,
  produto_veterinario_id uuid references public.produtos_veterinarios(id) on delete set null,
  unidade_base text not null,
  ativo boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint ck_insumos_tipo check (tipo in ('sanitario', 'nutricional', 'outro')),
  constraint ck_insumos_unidade_base check (unidade_base in ('ml', 'l', 'g', 'kg', 'un', 'dose')),
  constraint ck_insumos_nome_not_blank check (length(btrim(nome)) > 0)
);

create table if not exists public.insumo_apresentacoes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null,
  insumo_id uuid not null,
  nome text not null,
  unidade_compra text not null,
  quantidade_base numeric(12,3) not null,
  unidade_base text not null,
  codigo_barras text,
  fabricante text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  unique (id, insumo_id, fazenda_id),
  constraint ck_insumo_apresentacoes_nome_not_blank check (length(btrim(nome)) > 0),
  constraint ck_insumo_apresentacoes_unidade_compra check (unidade_compra in ('frasco', 'saco', 'bombona', 'caixa', 'unidade', 'dose', 'outro')),
  constraint ck_insumo_apresentacoes_quantidade_pos check (quantidade_base > 0),
  constraint ck_insumo_apresentacoes_unidade_base check (unidade_base in ('ml', 'l', 'g', 'kg', 'un', 'dose')),
  constraint fk_insumo_apresentacoes_insumo_fazenda foreign key (insumo_id, fazenda_id) references public.insumos(id, fazenda_id) on delete cascade
);

create table if not exists public.insumo_lotes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null,
  insumo_id uuid not null,
  apresentacao_id uuid,
  identificacao_lote text,
  validade date,
  fabricante text,
  local_armazenamento text,
  quantidade_inicial_base numeric(12,3) not null default 0,
  saldo_atual_base numeric(12,3) not null default 0,
  unidade_base text not null,
  status text not null default 'ativo',
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  unique (id, insumo_id, fazenda_id),
  constraint ck_insumo_lotes_quantidade_inicial_non_negative check (quantidade_inicial_base >= 0),
  constraint ck_insumo_lotes_saldo_non_negative check (saldo_atual_base >= 0),
  constraint ck_insumo_lotes_unidade_base check (unidade_base in ('ml', 'l', 'g', 'kg', 'un', 'dose')),
  constraint ck_insumo_lotes_status check (status in ('ativo', 'esgotado', 'vencido', 'bloqueado')),
  constraint fk_insumo_lotes_insumo_fazenda foreign key (insumo_id, fazenda_id) references public.insumos(id, fazenda_id) on delete cascade,
  constraint fk_insumo_lotes_apresentacao_fazenda foreign key (apresentacao_id, insumo_id, fazenda_id) references public.insumo_apresentacoes(id, insumo_id, fazenda_id) on delete set null
);

create table if not exists public.insumo_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null,
  insumo_id uuid not null,
  insumo_lote_id uuid not null,
  tipo text not null,
  quantidade_base numeric(12,3) not null,
  unidade_base text not null,
  occurred_at timestamptz not null default now(),
  source_evento_id uuid,
  source_evento_dominio text,
  animal_id uuid,
  rebanho_lote_id uuid,
  pasto_id uuid,
  observacoes text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (client_op_id),
  constraint ck_insumo_movimentacoes_tipo check (tipo in (
    'entrada',
    'ajuste_positivo',
    'ajuste_negativo',
    'consumo_sanitario',
    'consumo_nutricao',
    'perda',
    'transferencia_entrada',
    'transferencia_saida'
  )),
  constraint ck_insumo_movimentacoes_quantidade_pos check (quantidade_base > 0),
  constraint ck_insumo_movimentacoes_unidade_base check (unidade_base in ('ml', 'l', 'g', 'kg', 'un', 'dose')),
  constraint ck_insumo_movimentacoes_source_domain check (
    source_evento_dominio is null
    or source_evento_dominio in ('sanitario', 'nutricao', 'pastagem')
  ),
  constraint ck_insumo_movimentacoes_consumo_source check (
    (
      tipo = 'consumo_sanitario'
      and source_evento_id is not null
      and source_evento_dominio = 'sanitario'
    )
    or (
      tipo = 'consumo_nutricao'
      and source_evento_id is not null
      and source_evento_dominio in ('nutricao', 'pastagem')
    )
    or tipo not in ('consumo_sanitario', 'consumo_nutricao')
  ),
  constraint fk_insumo_movimentacoes_insumo_fazenda foreign key (insumo_id, fazenda_id) references public.insumos(id, fazenda_id) on delete cascade,
  constraint fk_insumo_movimentacoes_lote_fazenda foreign key (insumo_lote_id, insumo_id, fazenda_id) references public.insumo_lotes(id, insumo_id, fazenda_id) on delete restrict,
  constraint fk_insumo_movimentacoes_source_evento_fazenda foreign key (source_evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete restrict,
  constraint fk_insumo_movimentacoes_animal_fazenda foreign key (animal_id, fazenda_id) references public.animais(id, fazenda_id) on delete set null,
  constraint fk_insumo_movimentacoes_rebanho_lote_fazenda foreign key (rebanho_lote_id, fazenda_id) references public.lotes(id, fazenda_id) on delete set null,
  constraint fk_insumo_movimentacoes_pasto_fazenda foreign key (pasto_id, fazenda_id) references public.pastos(id, fazenda_id) on delete set null
);

create unique index if not exists ux_insumos_nome_active
  on public.insumos(fazenda_id, lower(nome))
  where deleted_at is null;

create index if not exists idx_insumos_fazenda_tipo
  on public.insumos(fazenda_id, tipo, deleted_at);
create index if not exists idx_insumo_apresentacoes_insumo
  on public.insumo_apresentacoes(fazenda_id, insumo_id, deleted_at);
create index if not exists idx_insumo_lotes_insumo_status
  on public.insumo_lotes(fazenda_id, insumo_id, status, deleted_at);
create index if not exists idx_insumo_lotes_validade
  on public.insumo_lotes(fazenda_id, validade);
create index if not exists idx_insumo_movimentacoes_lote_occurred
  on public.insumo_movimentacoes(fazenda_id, insumo_lote_id, occurred_at desc);
create index if not exists idx_insumo_movimentacoes_source_evento
  on public.insumo_movimentacoes(fazenda_id, source_evento_id);

create or replace function public.prevent_insumo_movimentacao_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Inventory movements are append-only; use counter movements for corrections'
    using errcode = '23514',
          constraint = 'ck_insumo_movimentacoes_append_only';
end;
$$;

create or replace function public.apply_insumo_movimentacao_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric(12,3);
  v_next_saldo numeric(12,3);
  v_source_dominio public.dominio_enum;
  v_source_deleted_at timestamptz;
begin
  if new.tipo in ('consumo_sanitario', 'consumo_nutricao') then
    select e.dominio, e.deleted_at
      into v_source_dominio, v_source_deleted_at
      from public.eventos e
     where e.id = new.source_evento_id
       and e.fazenda_id = new.fazenda_id;

    if v_source_dominio is null or v_source_deleted_at is not null then
      raise exception 'Inventory consumption requires active source event'
        using errcode = '23514',
              constraint = 'ck_insumo_movimentacoes_consumo_source';
    end if;

    if new.tipo = 'consumo_sanitario' and v_source_dominio <> 'sanitario'::public.dominio_enum then
      raise exception 'Sanitary inventory consumption requires sanitary source event'
        using errcode = '23514',
              constraint = 'ck_insumo_movimentacoes_consumo_source';
    end if;

    if new.tipo = 'consumo_nutricao' and v_source_dominio not in ('nutricao'::public.dominio_enum, 'pastagem'::public.dominio_enum) then
      raise exception 'Nutritional inventory consumption requires nutrition or pasture source event'
        using errcode = '23514',
              constraint = 'ck_insumo_movimentacoes_consumo_source';
    end if;
  end if;

  v_delta := case new.tipo
    when 'entrada' then new.quantidade_base
    when 'ajuste_positivo' then new.quantidade_base
    when 'transferencia_entrada' then new.quantidade_base
    else -new.quantidade_base
  end;

  update public.insumo_lotes
     set saldo_atual_base = saldo_atual_base + v_delta,
         updated_at = now()
   where id = new.insumo_lote_id
     and fazenda_id = new.fazenda_id
   returning saldo_atual_base into v_next_saldo;

  if v_next_saldo is null then
    raise exception 'Inventory lot not found for movement'
      using errcode = '23503',
            constraint = 'fk_insumo_movimentacoes_lote_fazenda';
  end if;

  if v_next_saldo < 0 then
    raise exception 'Inventory movement would make lot balance negative'
      using errcode = '23514',
            constraint = 'ck_insumo_lotes_saldo_non_negative';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_insumos_updated_at on public.insumos;
create trigger trg_insumos_updated_at
  before update on public.insumos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_insumo_apresentacoes_updated_at on public.insumo_apresentacoes;
create trigger trg_insumo_apresentacoes_updated_at
  before update on public.insumo_apresentacoes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_insumo_lotes_updated_at on public.insumo_lotes;
create trigger trg_insumo_lotes_updated_at
  before update on public.insumo_lotes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_insumo_movimentacoes_prevent_update on public.insumo_movimentacoes;
create trigger trg_insumo_movimentacoes_prevent_update
  before update on public.insumo_movimentacoes
  for each row execute function public.prevent_insumo_movimentacao_update();

drop trigger if exists trg_insumo_movimentacoes_apply_saldo on public.insumo_movimentacoes;
create trigger trg_insumo_movimentacoes_apply_saldo
  after insert on public.insumo_movimentacoes
  for each row execute function public.apply_insumo_movimentacao_saldo();

alter table public.insumos enable row level security;
alter table public.insumo_apresentacoes enable row level security;
alter table public.insumo_lotes enable row level security;
alter table public.insumo_movimentacoes enable row level security;

drop policy if exists insumos_select_member on public.insumos;
create policy insumos_select_member
  on public.insumos for select
  using (public.has_membership(fazenda_id));

drop policy if exists insumos_write_manager on public.insumos;
create policy insumos_write_manager
  on public.insumos for all
  using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]))
  with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));

drop policy if exists insumo_apresentacoes_select_member on public.insumo_apresentacoes;
create policy insumo_apresentacoes_select_member
  on public.insumo_apresentacoes for select
  using (public.has_membership(fazenda_id));

drop policy if exists insumo_apresentacoes_write_manager on public.insumo_apresentacoes;
create policy insumo_apresentacoes_write_manager
  on public.insumo_apresentacoes for all
  using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]))
  with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));

drop policy if exists insumo_lotes_select_member on public.insumo_lotes;
create policy insumo_lotes_select_member
  on public.insumo_lotes for select
  using (public.has_membership(fazenda_id));

drop policy if exists insumo_lotes_write_manager on public.insumo_lotes;
create policy insumo_lotes_write_manager
  on public.insumo_lotes for all
  using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]))
  with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));

drop policy if exists insumo_movimentacoes_select_member on public.insumo_movimentacoes;
create policy insumo_movimentacoes_select_member
  on public.insumo_movimentacoes for select
  using (public.has_membership(fazenda_id));

drop policy if exists insumo_movimentacoes_insert_consumo_member on public.insumo_movimentacoes;
create policy insumo_movimentacoes_insert_consumo_member
  on public.insumo_movimentacoes for insert
  with check (
    public.has_membership(fazenda_id)
    and tipo in ('consumo_sanitario', 'consumo_nutricao')
    and source_evento_id is not null
  );

drop policy if exists insumo_movimentacoes_insert_manager on public.insumo_movimentacoes;
create policy insumo_movimentacoes_insert_manager
  on public.insumo_movimentacoes for insert
  with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
