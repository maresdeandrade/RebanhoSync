begin;

-- MIGRACAO DE CONSOLIDACAO DE PROTOCOLOS SANITARIOS
-- Objetivo: Eliminar duplicacoes entre pack oficial, protocolos materializados e agrupamentos customizados
-- Regra: Cada fazenda deve ter APENAS UM protocolo ativo por familia:
--   - brucelose -> "MAPA | Brucelose femeas 3-8 meses (B19/RB51)"
--   - raiva_herbivoros -> "MAPA | Raiva herbivoros (areas de risco)"

-- PASSO 1: Identificar protocolos duplicados por familia e fazenda
drop view if exists public.vw_protocolos_duplicados_por_familia;

create temporary table tmp_protocolos_para_consolidar as
with ranked_protocols as (
  select
    p.id,
    p.fazenda_id,
    p.nome,
    p.payload ->> 'family_code' as family_code,
    p.payload ->> 'canonical_key' as canonical_key,
    p.payload ->> 'template_code' as template_code,
    p.created_at,
    row_number() over (
      partition by p.fazenda_id, coalesce(p.payload ->> 'family_code', 'unknown')
      order by
        case
          -- Prioriza protocolos com canonical_key definido
          when p.payload ->> 'canonical_key' is not null then 0
          else 1
        end,
        -- Depois prioriza pelo template_code mais recente (V2 > V1)
        case
          when p.payload ->> 'template_code' like '%V2%' then 0
          when p.payload ->> 'template_code' like '%V1%' then 1
          else 2
        end,
        p.created_at desc,
        p.id
    ) as rank_in_family
  from public.protocolos_sanitarios p
  where p.deleted_at is null
    and p.payload ->> 'family_code' in ('brucelose', 'raiva_herbivoros')
)
select
  id,
  fazenda_id,
  nome,
  family_code,
  canonical_key,
  template_code,
  rank_in_family,
  case when rank_in_family = 1 then 'KEEP' else 'MERGE_AND_DELETE' end as action
from ranked_protocols;

-- PASSO 2: Migrar itens dos protocolos duplicados para o protocolo alvo
with protocols_to_merge as (
  select
    t.fazenda_id,
    t.id as source_id,
    (
      select tp.id
      from tmp_protocolos_para_consolidar tp
      where tp.fazenda_id = t.fazenda_id
        and tp.family_code = t.family_code
        and tp.rank_in_family = 1
    ) as target_id
  from tmp_protocolos_para_consolidar t
  where t.action = 'MERGE_AND_DELETE'
),
items_migrated as (
  insert into public.protocolos_sanitarios_itens (
    fazenda_id,
    protocolo_id,
    protocol_item_id,
    version,
    tipo,
    produto,
    intervalo_dias,
    dose_num,
    gera_agenda,
    dedup_template,
    payload,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at,
    server_received_at
  )
  select
    p.fazenda_id as fazenda_id,
    pm.target_id as protocolo_id,
    gen_random_uuid() as protocol_item_id,
    i.version,
    i.tipo,
    i.produto,
    i.intervalo_dias,
    i.dose_num,
    i.gera_agenda,
    i.dedup_template,
    i.payload || jsonb_build_object('migrated_from', pm.source_id::text),
    i.client_id,
    i.client_op_id,
    i.client_tx_id,
    i.client_recorded_at,
    now() as server_received_at
  from protocols_to_merge pm
  join public.protocolos_sanitarios_itens i on i.protocolo_id = pm.source_id
  join public.protocolos_sanitarios p on p.id = pm.target_id
  where i.deleted_at is null
    and not exists (
      select 1
      from public.protocolos_sanitarios_itens existing
      where existing.protocolo_id = pm.target_id
        and existing.deleted_at is null
        and existing.payload ->> 'item_code' = i.payload ->> 'item_code'
    )
  returning 1
)
select count(*) from items_migrated;

-- PASSO 3: Marcar protocolos duplicados como deletados
update public.protocolos_sanitarios p
set
  deleted_at = coalesce(p.deleted_at, now()),
  ativo = false,
  payload = coalesce(p.payload, '{}'::jsonb) || jsonb_build_object(
    'consolidation_reason', 'duplicidade_por_familia',
    'consolidated_at', now()
  ),
  updated_at = now()
from tmp_protocolos_para_consolidar t
where p.id = t.id
  and t.action = 'MERGE_AND_DELETE'
  and p.deleted_at is null;

-- PASSO 4: Atualizar protocolos alvo com metadados de consolidacao
update public.protocolos_sanitarios p
set
  payload = coalesce(p.payload, '{}'::jsonb) || jsonb_build_object(
    'consolidation_target', true,
    'consolidated_at', now(),
    'merged_count', (
      select count(*)
      from tmp_protocolos_para_consolidar t
      where t.fazenda_id = p.fazenda_id
        and t.family_code = p.payload ->> 'family_code'
        and t.action = 'MERGE_AND_DELETE'
    )
  ),
  updated_at = now()
from tmp_protocolos_para_consolidar t
where p.id = t.id
  and t.action = 'KEEP';

-- PASSO 5: Garantir vinculacao com catalogo oficial
update public.protocolos_sanitarios p
set
  payload = coalesce(p.payload, '{}'::jsonb) || jsonb_build_object(
    'official_catalog_slug', case
      when p.payload ->> 'family_code' = 'brucelose' then 'brucelose-pncebt'
      when p.payload ->> 'family_code' = 'raiva_herbivoros' then 'raiva-herbivoros-risco'
      else null
    end,
    'official_catalog_version', 1
  ),
  updated_at = now()
where p.deleted_at is null
  and p.payload ->> 'family_code' in ('brucelose', 'raiva_herbivoros')
  and (p.payload ->> 'official_catalog_slug' is null or p.payload ->> 'official_catalog_slug' = '');

-- PASSO 6: Limpeza - remover entrada temporaria
drop table if exists tmp_protocolos_para_consolidar;

-- VALIDACAO FINAL: Log de consolidacao
do $$
declare
  v_count_brucelose int;
  v_count_raiva int;
begin
  select count(distinct p.id)
  into v_count_brucelose
  from public.protocolos_sanitarios p
  where p.deleted_at is null
    and p.payload ->> 'family_code' = 'brucelose';

  select count(distinct p.id)
  into v_count_raiva
  from public.protocolos_sanitarios p
  where p.deleted_at is null
    and p.payload ->> 'family_code' = 'raiva_herbivoros';

  raise notice '=== CONSOLIDAÇÃO CONCLUÍDA ===';
  raise notice 'Protocolos Brucelose ativos: %', v_count_brucelose;
  raise notice 'Protocolos Raiva ativos: %', v_count_raiva;
  raise notice 'Cada fazenda deve ter no máximo 1 protocolo ativo por família.';
end $$;

commit;