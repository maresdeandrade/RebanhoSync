-- Migration: P4 - Avaliacao/ronda de pasto como evento historico
-- Fato append-only: cria detalhe especifico sem alterar pastos, lotes ou pasto_ocupacoes.

alter type public.dominio_enum add value if not exists 'pastagem';

create table if not exists public.eventos_pasto_avaliacao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  pasto_id uuid not null,
  lote_id uuid,
  ocupacao_id uuid,

  momento text not null,
  altura_cm numeric(6,2),
  cobertura_solo text,
  invasoras_nivel text,

  ecc_lote_medio numeric(3,2),
  ecc_escala text not null default '1_5',
  fezes_score text,

  agua_status text,
  suplemento_tipo text,
  suplemento_quantidade numeric(10,2),
  suplemento_unidade text,

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

  constraint fk_avaliacao_evento
    foreign key (evento_id, fazenda_id)
    references public.eventos(id, fazenda_id) on delete cascade,

  constraint fk_avaliacao_pasto
    foreign key (pasto_id, fazenda_id)
    references public.pastos(id, fazenda_id),

  constraint fk_avaliacao_lote
    foreign key (lote_id, fazenda_id)
    references public.lotes(id, fazenda_id) on delete set null,

  constraint fk_avaliacao_ocupacao
    foreign key (ocupacao_id)
    references public.pasto_ocupacoes(id) on delete set null
);

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_momento
    check (momento in ('entrada', 'saida', 'ronda'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_altura
    check (altura_cm is null or altura_cm > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_ecc
    check (ecc_lote_medio is null or ecc_lote_medio between 1 and 5);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_cobertura
    check (
      cobertura_solo is null
      or cobertura_solo in ('excelente', 'media', 'ruim')
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_invasoras
    check (
      invasoras_nivel is null
      or invasoras_nivel in ('nenhuma', 'leve', 'moderada', 'alta')
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_fezes
    check (
      fezes_score is null
      or fezes_score in ('aneladas', 'ressecadas_empilhadas', 'liquidas')
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_agua
    check (
      agua_status is null
      or agua_status in ('limpo', 'sujo', 'nivel_baixo', 'seco')
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_suplemento_qtd
    check (suplemento_quantidade is null or suplemento_quantidade >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.eventos_pasto_avaliacao
    add constraint ck_eventos_pasto_avaliacao_suplemento_unidade
    check (suplemento_unidade is null or suplemento_unidade in ('kg', 'sacos'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_eventos_pasto_avaliacao_fazenda_pasto
  on public.eventos_pasto_avaliacao(fazenda_id, pasto_id);

create index if not exists idx_eventos_pasto_avaliacao_fazenda_lote
  on public.eventos_pasto_avaliacao(fazenda_id, lote_id);

create index if not exists idx_eventos_pasto_avaliacao_ocupacao
  on public.eventos_pasto_avaliacao(ocupacao_id);

create index if not exists idx_eventos_pasto_avaliacao_deleted_at
  on public.eventos_pasto_avaliacao(deleted_at);

create unique index if not exists ux_eventos_pasto_avaliacao_client_op_id
  on public.eventos_pasto_avaliacao(client_op_id);

create index if not exists idx_eventos_pasto_avaliacao_client_tx_id
  on public.eventos_pasto_avaliacao(client_tx_id);

drop trigger if exists trg_eventos_pasto_avaliacao_updated_at
  on public.eventos_pasto_avaliacao;
create trigger trg_eventos_pasto_avaliacao_updated_at
  before update on public.eventos_pasto_avaliacao
  for each row execute function public.set_updated_at();

drop trigger if exists trg_eventos_pasto_avaliacao_prevent_business_update
  on public.eventos_pasto_avaliacao;
create trigger trg_eventos_pasto_avaliacao_prevent_business_update
  before update on public.eventos_pasto_avaliacao
  for each row execute function public.prevent_business_update();

alter table public.eventos_pasto_avaliacao enable row level security;

drop policy if exists eventos_pasto_avaliacao_select_member
  on public.eventos_pasto_avaliacao;
create policy eventos_pasto_avaliacao_select_member
  on public.eventos_pasto_avaliacao for select
  using (public.has_membership(fazenda_id));

drop policy if exists eventos_pasto_avaliacao_insert_member
  on public.eventos_pasto_avaliacao;
create policy eventos_pasto_avaliacao_insert_member
  on public.eventos_pasto_avaliacao for insert
  with check (public.has_membership(fazenda_id));
