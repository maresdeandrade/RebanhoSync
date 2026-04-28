begin;

create or replace function public.seed_default_sanitary_protocols(_fazenda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O seed estrutural legado foi aposentado.
  -- A arquitetura atual usa:
  -- 1) pack oficial versionado e opcional por fazenda
  -- 2) templates canonicos importados explicitamente na camada operacional
  return;
end;
$$;

with legacy_raiva as (
  select
    p.id,
    p.fazenda_id,
    p.created_at,
    case
      when p.payload ->> 'template_code' in (
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2'
      ) then 'primovac'
      when p.payload ->> 'template_code' in (
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
      ) then 'revac'
      else null
    end as legacy_role
  from public.protocolos_sanitarios p
  where p.deleted_at is null
    and p.payload ->> 'template_code' in (
      'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
      'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
      'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
      'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
    )
),
target_per_farm as (
  select distinct on (fazenda_id)
    fazenda_id,
    id as target_protocol_id
  from legacy_raiva
  order by
    fazenda_id,
    case when legacy_role = 'primovac' then 0 else 1 end,
    created_at,
    id
),
source_per_farm as (
  select
    lr.fazenda_id,
    lr.id as source_protocol_id,
    tp.target_protocol_id
  from legacy_raiva lr
  join target_per_farm tp
    on tp.fazenda_id = lr.fazenda_id
  where lr.id <> tp.target_protocol_id
)
update public.protocolos_sanitarios_itens i
set
  protocolo_id = s.target_protocol_id,
  updated_at = now()
from source_per_farm s
where i.protocolo_id = s.source_protocol_id
  and i.deleted_at is null
  and not exists (
    select 1
    from public.protocolos_sanitarios_itens existing
    where existing.protocolo_id = s.target_protocol_id
      and existing.deleted_at is null
      and existing.payload ->> 'item_code' = i.payload ->> 'item_code'
  );

with source_per_farm as (
  select
    lr.fazenda_id,
    lr.id as source_protocol_id,
    tp.target_protocol_id
  from (
    select
      p.id,
      p.fazenda_id
    from public.protocolos_sanitarios p
    where p.deleted_at is null
      and p.payload ->> 'template_code' in (
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
      )
  ) lr
  join (
    select distinct on (fazenda_id)
      fazenda_id,
      id as target_protocol_id
    from (
      select
        p.id,
        p.fazenda_id,
        p.created_at,
        case
          when p.payload ->> 'template_code' in (
            'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
            'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2'
          ) then 0
          else 1
        end as priority_rank
      from public.protocolos_sanitarios p
      where p.deleted_at is null
        and p.payload ->> 'template_code' in (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
        )
    ) ranked
    order by fazenda_id, priority_rank, created_at, id
  ) tp
    on tp.fazenda_id = lr.fazenda_id
  where lr.id <> tp.target_protocol_id
)
update public.protocolos_sanitarios_itens i
set
  deleted_at = coalesce(i.deleted_at, now()),
  gera_agenda = false,
  updated_at = now()
from source_per_farm s
where i.protocolo_id = s.source_protocol_id
  and i.deleted_at is null;

update public.protocolos_sanitarios p
set
  nome = 'MAPA | Raiva herbivoros (areas de risco)',
  descricao = 'Primovacinacao, reforco e revacinacao anual consolidados em uma unica familia protocolar legada.',
  payload = coalesce(p.payload, '{}'::jsonb) || jsonb_build_object(
    'family_code', 'raiva_herbivoros',
    'canonical_key', 'raiva_herbivoros',
    'source_origin', 'seed_legado_mapa',
    'scope', 'fazenda',
    'activation_mode', 'materializar_protocolo',
    'legacy_family_consolidated', true
  ),
  updated_at = now()
where p.id in (
  select distinct on (fazenda_id)
    id
  from (
    select
      p.id,
      p.fazenda_id,
      p.created_at,
      case
        when p.payload ->> 'template_code' in (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2'
        ) then 0
        else 1
      end as priority_rank
    from public.protocolos_sanitarios p
    where p.deleted_at is null
      and p.payload ->> 'template_code' in (
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
      )
  ) ranked
  order by fazenda_id, priority_rank, created_at, id
);

with source_per_farm as (
  select
    lr.fazenda_id,
    lr.id as source_protocol_id,
    tp.target_protocol_id
  from (
    select
      p.id,
      p.fazenda_id
    from public.protocolos_sanitarios p
    where p.deleted_at is null
      and p.payload ->> 'template_code' in (
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
        'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
        'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
      )
  ) lr
  join (
    select distinct on (fazenda_id)
      fazenda_id,
      id as target_protocol_id
    from (
      select
        p.id,
        p.fazenda_id,
        p.created_at,
        case
          when p.payload ->> 'template_code' in (
            'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
            'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2'
          ) then 0
          else 1
        end as priority_rank
      from public.protocolos_sanitarios p
      where p.deleted_at is null
        and p.payload ->> 'template_code' in (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2'
        )
    ) ranked
    order by fazenda_id, priority_rank, created_at, id
  ) tp
    on tp.fazenda_id = lr.fazenda_id
  where lr.id <> tp.target_protocol_id
)
update public.protocolos_sanitarios p
set
  ativo = false,
  deleted_at = coalesce(p.deleted_at, now()),
  payload = coalesce(p.payload, '{}'::jsonb) || jsonb_build_object(
    'legacy_family_redirect', 'raiva_herbivoros'
  ),
  updated_at = now()
from source_per_farm s
where p.id = s.source_protocol_id
  and p.deleted_at is null;

update public.protocolos_sanitarios p
set
  payload = coalesce(p.payload, '{}'::jsonb) || jsonb_build_object(
    'family_code', 'brucelose',
    'canonical_key', 'brucelose',
    'source_origin', 'seed_legado_mapa',
    'scope', 'fazenda',
    'activation_mode', 'materializar_protocolo'
  ),
  updated_at = now()
where p.deleted_at is null
  and p.payload ->> 'template_code' in (
    'MAPA_BRUCELOSE_FEMEAS_3A8M_V1',
    'MAPA_BRUCELOSE_FEMEAS_3A8M_V2'
  );

commit;
