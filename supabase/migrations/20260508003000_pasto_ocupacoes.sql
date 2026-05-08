-- Migration: P1 - pasto_ocupacoes
-- Estado materializado derivado de eventos de movimentação lote→pasto.
-- Não substitui eventos; é read model operacional para queries rápidas de ocupação.
-- Constraint ux_pasto_ocupacao_aberta_por_lote garante no máximo 1 ocupação aberta por lote.

create table public.pasto_ocupacoes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  pasto_id uuid not null,
  lote_id uuid not null,
  entrada_em timestamptz not null,
  saida_em timestamptz,
  entrada_evento_id uuid,
  saida_evento_id uuid,
  animais_inicio integer,
  animais_fim integer,
  ua_inicio numeric(10,2),
  ua_fim numeric(10,2),
  status text not null default 'aberta',
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint fk_pasto_ocupacoes_pasto
    foreign key (pasto_id, fazenda_id)
    references public.pastos(id, fazenda_id),

  constraint fk_pasto_ocupacoes_lote
    foreign key (lote_id, fazenda_id)
    references public.lotes(id, fazenda_id),

  constraint fk_pasto_ocupacoes_entrada_evento
    foreign key (entrada_evento_id, fazenda_id)
    references public.eventos(id, fazenda_id) on delete set null,

  constraint fk_pasto_ocupacoes_saida_evento
    foreign key (saida_evento_id, fazenda_id)
    references public.eventos(id, fazenda_id) on delete set null,

  constraint ck_pasto_ocupacoes_status
    check (status in ('aberta', 'fechada', 'cancelada')),

  constraint ck_pasto_ocupacoes_datas
    check (saida_em is null or saida_em >= entrada_em)
);

-- Índices operacionais
create index idx_pasto_ocupacoes_fazenda_pasto
  on public.pasto_ocupacoes(fazenda_id, pasto_id);

create index idx_pasto_ocupacoes_fazenda_lote
  on public.pasto_ocupacoes(fazenda_id, lote_id);

create index idx_pasto_ocupacoes_fazenda_status
  on public.pasto_ocupacoes(fazenda_id, status);

-- No máximo 1 ocupação aberta por lote (não por pasto: múltiplos lotes podem ocupar o mesmo pasto)
create unique index ux_pasto_ocupacao_aberta_por_lote
  on public.pasto_ocupacoes(fazenda_id, lote_id)
  where status = 'aberta' and deleted_at is null;

-- Índices padrão do projeto (client_op_id único, client_tx_id, deleted_at)
create unique index ux_pasto_ocupacoes_client_op_id on public.pasto_ocupacoes(client_op_id);
create index idx_pasto_ocupacoes_client_tx_id on public.pasto_ocupacoes(client_tx_id);
create index idx_pasto_ocupacoes_deleted_at on public.pasto_ocupacoes(deleted_at);

-- updated_at trigger
create trigger trg_pasto_ocupacoes_updated_at
  before update on public.pasto_ocupacoes
  for each row execute function public.set_updated_at();

-- RLS
-- Padrão: select=member (todos os membros leem), write=manager (alinhado com lotes e pastos)
alter table public.pasto_ocupacoes enable row level security;

create policy pasto_ocupacoes_select_member
  on public.pasto_ocupacoes for select
  using (public.has_membership(fazenda_id));

create policy pasto_ocupacoes_write_manager
  on public.pasto_ocupacoes for all
  using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]))
  with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
