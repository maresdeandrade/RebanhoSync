-- Fase 2: rastreabilidade sanitaria operacional em colunas estruturadas.
-- O contrato de protocolo imutavel da Fase 1 permanece intacto.

alter table public.eventos_sanitario
  add column if not exists produto_veterinario_id uuid null,
  add column if not exists produto_nome_snapshot text null,
  add column if not exists estoque_lote_id uuid null,
  add column if not exists estoque_lote_codigo_snapshot text null,
  add column if not exists lote_fabricante text null,
  add column if not exists validade_produto date null,
  add column if not exists dose_quantidade numeric(12,4) null,
  add column if not exists dose_unidade text null,
  add column if not exists via_aplicacao text null,
  add column if not exists responsavel_nome text null,
  add column if not exists responsavel_tipo text null,
  add column if not exists carencia_carne_dias integer null,
  add column if not exists carencia_leite_dias integer null,
  add column if not exists carencia_carne_ate date null,
  add column if not exists carencia_leite_ate date null,
  add column if not exists custo_unitario_snapshot numeric(12,4) null,
  add column if not exists custo_total_snapshot numeric(12,2) null;

alter table public.eventos_sanitario
  drop constraint if exists fk_eventos_sanitario_produto_veterinario,
  add constraint fk_eventos_sanitario_produto_veterinario
    foreign key (produto_veterinario_id)
    references public.produtos_veterinarios(id)
    on delete set null;

alter table public.eventos_sanitario
  drop constraint if exists fk_eventos_sanitario_estoque_lote_fazenda,
  add constraint fk_eventos_sanitario_estoque_lote_fazenda
    foreign key (estoque_lote_id, fazenda_id)
    references public.insumo_lotes(id, fazenda_id);

alter table public.eventos_sanitario
  drop constraint if exists ck_eventos_sanitario_dose_positive,
  add constraint ck_eventos_sanitario_dose_positive
    check (dose_quantidade is null or dose_quantidade > 0),
  drop constraint if exists ck_eventos_sanitario_carencia_non_negative,
  add constraint ck_eventos_sanitario_carencia_non_negative
    check (
      (carencia_carne_dias is null or carencia_carne_dias >= 0)
      and (carencia_leite_dias is null or carencia_leite_dias >= 0)
    ),
  drop constraint if exists ck_eventos_sanitario_custo_non_negative,
  add constraint ck_eventos_sanitario_custo_non_negative
    check (
      (custo_unitario_snapshot is null or custo_unitario_snapshot >= 0)
      and (custo_total_snapshot is null or custo_total_snapshot >= 0)
    ),
  drop constraint if exists ck_eventos_sanitario_structured_product_required_fields,
  add constraint ck_eventos_sanitario_structured_product_required_fields
    check (
      produto_veterinario_id is null
      or (
        dose_quantidade is not null
        and nullif(btrim(dose_unidade), '') is not null
        and nullif(btrim(via_aplicacao), '') is not null
      )
    );

create index if not exists idx_eventos_sanitario_produto_veterinario
  on public.eventos_sanitario (fazenda_id, produto_veterinario_id)
  where deleted_at is null;

create index if not exists idx_eventos_sanitario_estoque_lote
  on public.eventos_sanitario (fazenda_id, estoque_lote_id)
  where deleted_at is null;

create index if not exists idx_eventos_sanitario_carencia_dates
  on public.eventos_sanitario (fazenda_id, carencia_carne_ate, carencia_leite_ate)
  where deleted_at is null;

create unique index if not exists ux_insumo_movimentacoes_consumo_sanitario_evento
  on public.insumo_movimentacoes (fazenda_id, source_evento_id)
  where tipo = 'consumo_sanitario'
    and source_evento_id is not null
    and deleted_at is null;

create or replace view public.vw_animais_carencia_ativa
with (security_invoker = true)
as
select
  e.animal_id,
  e.fazenda_id,
  coalesce(es.produto_nome_snapshot, es.produto) as produto,
  'carne' as tipo_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date as inicio_carencia,
  es.carencia_carne_ate as fim_carencia,
  es.carencia_carne_ate >= current_date as ativa
from public.eventos e
join public.eventos_sanitario es
  on es.evento_id = e.id
  and es.fazenda_id = e.fazenda_id
where e.dominio = 'sanitario'
  and e.deleted_at is null
  and es.deleted_at is null
  and e.animal_id is not null
  and es.carencia_carne_dias is not null
  and es.carencia_carne_dias > 0
  and es.carencia_carne_ate is not null
  and es.carencia_carne_ate >= current_date

union all

select
  e.animal_id,
  e.fazenda_id,
  coalesce(es.produto_nome_snapshot, es.produto) as produto,
  'leite' as tipo_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date as inicio_carencia,
  es.carencia_leite_ate as fim_carencia,
  es.carencia_leite_ate >= current_date as ativa
from public.eventos e
join public.eventos_sanitario es
  on es.evento_id = e.id
  and es.fazenda_id = e.fazenda_id
where e.dominio = 'sanitario'
  and e.deleted_at is null
  and es.deleted_at is null
  and e.animal_id is not null
  and es.carencia_leite_dias is not null
  and es.carencia_leite_dias > 0
  and es.carencia_leite_ate is not null
  and es.carencia_leite_ate >= current_date;
