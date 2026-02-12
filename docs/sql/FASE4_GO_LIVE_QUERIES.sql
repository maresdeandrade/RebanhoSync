-- FASE 4 GO-LIVE - Query Pack executavel
-- Uso: executar no SQL Editor do Supabase (service role).
-- Escopo: verificacoes objetivas de rollout, hardening e isolamento entre fazendas.

-- =========================================================
-- [S00] Parametros de execucao
-- =========================================================
drop table if exists _fase4_go_live_params;
create temporary table _fase4_go_live_params as
select
  array[]::uuid[] as pilot_farms, -- opcional: preencher com IDs das fazendas piloto
  interval '30 minutes' as kpi_window;

-- Exemplo para usar filtro de piloto:
-- update _fase4_go_live_params
-- set pilot_farms = array[
--   '00000000-0000-0000-0000-000000000001'::uuid,
--   '00000000-0000-0000-0000-000000000002'::uuid
-- ];

select * from _fase4_go_live_params;

-- =========================================================
-- [S01] Feature flags por fazenda (valor bruto e efetivo)
-- =========================================================
with flags as (
  select
    f.id as fazenda_id,
    f.nome as fazenda_nome,
    f.metadata -> 'eventos_rollout' as eventos_rollout,
    case
      when jsonb_typeof(f.metadata -> 'eventos_rollout' -> 'strict_rules_enabled') = 'boolean'
        then (f.metadata -> 'eventos_rollout' ->> 'strict_rules_enabled')::boolean
      else null
    end as strict_rules_raw,
    case
      when jsonb_typeof(f.metadata -> 'eventos_rollout' -> 'strict_anti_teleporte') = 'boolean'
        then (f.metadata -> 'eventos_rollout' ->> 'strict_anti_teleporte')::boolean
      else null
    end as strict_anti_raw,
    f.updated_at
  from public.fazendas f
  where f.deleted_at is null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or f.id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
)
select
  fazenda_id,
  fazenda_nome,
  strict_rules_raw,
  strict_anti_raw,
  coalesce(strict_rules_raw, true) as strict_rules_enabled_effective,
  (coalesce(strict_rules_raw, true) and coalesce(strict_anti_raw, true)) as strict_anti_teleporte_effective,
  updated_at,
  eventos_rollout
from flags
order by fazenda_nome;

-- =========================================================
-- [S02] Sanidade do payload de rollout (tipagem JSON)
-- Critico: qualquer linha aqui precisa correcao antes do go-live.
-- =========================================================
select
  f.id as fazenda_id,
  f.nome as fazenda_nome,
  f.metadata -> 'eventos_rollout' as eventos_rollout
from public.fazendas f
where f.deleted_at is null
  and (
    coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
    or f.id in (select unnest(pilot_farms) from _fase4_go_live_params)
  )
  and f.metadata ? 'eventos_rollout'
  and (
    jsonb_typeof(f.metadata -> 'eventos_rollout') <> 'object'
    or coalesce(jsonb_typeof(f.metadata -> 'eventos_rollout' -> 'strict_rules_enabled'), 'null') not in ('boolean', 'null')
    or coalesce(jsonb_typeof(f.metadata -> 'eventos_rollout' -> 'strict_anti_teleporte'), 'null') not in ('boolean', 'null')
  )
order by f.nome;

-- =========================================================
-- [S03] Hardening: constraints/FKs criticas (presenca + validacao)
-- =========================================================
with expected as (
  select *
  from (values
    ('fk_evt_sanitario_evento_fazenda'),
    ('fk_evt_pesagem_evento_fazenda'),
    ('fk_evt_nutricao_evento_fazenda'),
    ('fk_evt_mov_evento_fazenda'),
    ('fk_evt_fin_evento_fazenda'),
    ('ck_evt_fin_valor_total_pos'),
    ('ck_evt_nutricao_quantidade_pos_nullable'),
    ('ck_evt_mov_destino_required'),
    ('ck_evt_mov_from_to_diff'),
    ('fk_evt_fin_contraparte_fazenda')
  ) as t(conname)
)
select
  e.conname,
  c.contype,
  c.convalidated,
  pg_get_constraintdef(c.oid) as definition,
  case
    when c.oid is null then 'MISSING'
    when c.convalidated then 'OK'
    else 'NOT_VALIDATED'
  end as status
from expected e
left join pg_constraint c
  on c.conname = e.conname
order by e.conname;

-- =========================================================
-- [S04] Seed/trigger de protocolos sanitarios (0027)
-- =========================================================
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'seed_default_sanitary_protocols',
    'trg_seed_default_sanitary_protocols_on_farm_insert'
  )
order by p.proname;

select
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as enabled_mode
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'fazendas'
  and t.tgname = 'trg_seed_default_sanitary_protocols_on_farm_insert'
  and not t.tgisinternal;

-- =========================================================
-- [S05] Isolamento entre fazendas (cross-tenant checks)
-- Critico: qualquer inconsistencias > 0 bloqueia go-live.
-- =========================================================
select *
from (
  select
    'eventos.animal_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos e
  left join public.animais a
    on a.id = e.animal_id
   and a.fazenda_id = e.fazenda_id
  where e.deleted_at is null
    and e.animal_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or e.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and a.id is null

  union all

  select
    'eventos.lote_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos e
  left join public.lotes l
    on l.id = e.lote_id
   and l.fazenda_id = e.fazenda_id
  where e.deleted_at is null
    and e.lote_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or e.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and l.id is null

  union all

  select
    'eventos_financeiro.contraparte_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos_financeiro ef
  left join public.contrapartes c
    on c.id = ef.contraparte_id
   and c.fazenda_id = ef.fazenda_id
  where ef.deleted_at is null
    and ef.contraparte_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or ef.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and c.id is null

  union all

  select
    'eventos_movimentacao.from_lote_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos_movimentacao em
  left join public.lotes l
    on l.id = em.from_lote_id
   and l.fazenda_id = em.fazenda_id
  where em.deleted_at is null
    and em.from_lote_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and l.id is null

  union all

  select
    'eventos_movimentacao.to_lote_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos_movimentacao em
  left join public.lotes l
    on l.id = em.to_lote_id
   and l.fazenda_id = em.fazenda_id
  where em.deleted_at is null
    and em.to_lote_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and l.id is null

  union all

  select
    'eventos_movimentacao.from_pasto_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos_movimentacao em
  left join public.pastos p
    on p.id = em.from_pasto_id
   and p.fazenda_id = em.fazenda_id
  where em.deleted_at is null
    and em.from_pasto_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and p.id is null

  union all

  select
    'eventos_movimentacao.to_pasto_id' as check_name,
    count(*)::bigint as inconsistencias
  from public.eventos_movimentacao em
  left join public.pastos p
    on p.id = em.to_pasto_id
   and p.fazenda_id = em.fazenda_id
  where em.deleted_at is null
    and em.to_pasto_id is not null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and p.id is null
) x
order by x.check_name;

-- =========================================================
-- [S06] Ingestao de eventos por dominio (janela de KPI)
-- Observacao: mede ingestao server-side, nao substitui KPI local de sync.
-- =========================================================
select
  e.fazenda_id,
  e.dominio,
  count(*)::bigint as eventos_recebidos,
  min(e.server_received_at) as primeiro_recebimento,
  max(e.server_received_at) as ultimo_recebimento
from public.eventos e
where e.deleted_at is null
  and e.server_received_at >= now() - (select kpi_window from _fase4_go_live_params)
  and (
    coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
    or e.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
  )
group by e.fazenda_id, e.dominio
order by e.fazenda_id, e.dominio;

-- =========================================================
-- [S07] Colisao de client_tx_id entre fazendas (suspeita de isolamento)
-- Critico: qualquer linha aqui bloqueia go-live ate investigacao.
-- =========================================================
select
  e.client_tx_id,
  count(distinct e.fazenda_id) as fazendas_distintas,
  min(e.server_received_at) as primeiro_recebimento,
  max(e.server_received_at) as ultimo_recebimento
from public.eventos e
where e.deleted_at is null
  and e.client_tx_id is not null
  and e.server_received_at >= now() - (select kpi_window from _fase4_go_live_params)
group by e.client_tx_id
having count(distinct e.fazenda_id) > 1
order by ultimo_recebimento desc;

-- =========================================================
-- [S08] Gate SQL consolidado (PASS/FAIL)
-- =========================================================
with expected as (
  select *
  from (values
    ('fk_evt_sanitario_evento_fazenda'),
    ('fk_evt_pesagem_evento_fazenda'),
    ('fk_evt_nutricao_evento_fazenda'),
    ('fk_evt_mov_evento_fazenda'),
    ('fk_evt_fin_evento_fazenda'),
    ('ck_evt_fin_valor_total_pos'),
    ('ck_evt_nutricao_quantidade_pos_nullable'),
    ('ck_evt_mov_destino_required'),
    ('ck_evt_mov_from_to_diff'),
    ('fk_evt_fin_contraparte_fazenda')
  ) as t(conname)
),
constraint_status as (
  select
    count(*) filter (where c.oid is null) as missing_count,
    count(*) filter (where c.oid is not null and c.convalidated = false) as not_validated_count
  from expected e
  left join pg_constraint c
    on c.conname = e.conname
),
invalid_rollout_payload as (
  select
    count(*)::bigint as invalid_count
  from public.fazendas f
  where f.deleted_at is null
    and (
      coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
      or f.id in (select unnest(pilot_farms) from _fase4_go_live_params)
    )
    and f.metadata ? 'eventos_rollout'
    and (
      jsonb_typeof(f.metadata -> 'eventos_rollout') <> 'object'
      or coalesce(jsonb_typeof(f.metadata -> 'eventos_rollout' -> 'strict_rules_enabled'), 'null') not in ('boolean', 'null')
      or coalesce(jsonb_typeof(f.metadata -> 'eventos_rollout' -> 'strict_anti_teleporte'), 'null') not in ('boolean', 'null')
    )
),
tenant_inconsistency as (
  select sum(inconsistencias)::bigint as inconsistencias_total
  from (
    select count(*)::bigint as inconsistencias
    from public.eventos e
    left join public.animais a on a.id = e.animal_id and a.fazenda_id = e.fazenda_id
    where e.deleted_at is null
      and e.animal_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or e.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and a.id is null

    union all

    select count(*)::bigint as inconsistencias
    from public.eventos e
    left join public.lotes l on l.id = e.lote_id and l.fazenda_id = e.fazenda_id
    where e.deleted_at is null
      and e.lote_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or e.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and l.id is null

    union all

    select count(*)::bigint as inconsistencias
    from public.eventos_financeiro ef
    left join public.contrapartes c on c.id = ef.contraparte_id and c.fazenda_id = ef.fazenda_id
    where ef.deleted_at is null
      and ef.contraparte_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or ef.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and c.id is null

    union all

    select count(*)::bigint as inconsistencias
    from public.eventos_movimentacao em
    left join public.lotes l on l.id = em.from_lote_id and l.fazenda_id = em.fazenda_id
    where em.deleted_at is null
      and em.from_lote_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and l.id is null

    union all

    select count(*)::bigint as inconsistencias
    from public.eventos_movimentacao em
    left join public.lotes l on l.id = em.to_lote_id and l.fazenda_id = em.fazenda_id
    where em.deleted_at is null
      and em.to_lote_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and l.id is null

    union all

    select count(*)::bigint as inconsistencias
    from public.eventos_movimentacao em
    left join public.pastos p on p.id = em.from_pasto_id and p.fazenda_id = em.fazenda_id
    where em.deleted_at is null
      and em.from_pasto_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and p.id is null

    union all

    select count(*)::bigint as inconsistencias
    from public.eventos_movimentacao em
    left join public.pastos p on p.id = em.to_pasto_id and p.fazenda_id = em.fazenda_id
    where em.deleted_at is null
      and em.to_pasto_id is not null
      and (
        coalesce(cardinality((select pilot_farms from _fase4_go_live_params)), 0) = 0
        or em.fazenda_id in (select unnest(pilot_farms) from _fase4_go_live_params)
      )
      and p.id is null
  ) x
),
cross_farm_tx as (
  select count(*)::bigint as suspicious_count
  from (
    select e.client_tx_id
    from public.eventos e
    where e.deleted_at is null
      and e.client_tx_id is not null
      and e.server_received_at >= now() - (select kpi_window from _fase4_go_live_params)
    group by e.client_tx_id
    having count(distinct e.fazenda_id) > 1
  ) t
)
select
  cs.missing_count as constraints_missing,
  cs.not_validated_count as constraints_not_validated,
  irp.invalid_count as invalid_rollout_payload_rows,
  ti.inconsistencias_total as tenant_inconsistencias_total,
  cft.suspicious_count as cross_farm_client_tx_count,
  case when cs.missing_count = 0 then 'PASS' else 'FAIL' end as gate_constraints_installed,
  case when irp.invalid_count = 0 then 'PASS' else 'FAIL' end as gate_rollout_payload,
  case when ti.inconsistencias_total = 0 and cft.suspicious_count = 0 then 'PASS' else 'FAIL' end as gate_tenant_isolation
from constraint_status cs
cross join invalid_rollout_payload irp
cross join tenant_inconsistency ti
cross join cross_farm_tx cft;


