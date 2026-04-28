-- Canonical bovine taxonomy projection
-- Source of truth for operational derivation remains the client module
-- src/lib/animals/taxonomy.ts. This view exists for reporting, SQL consumers,
-- and server-side inspection without changing the physical shape of animais.

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace
      and typname = 'categoria_zootecnica_canonica_enum'
  ) then
    create type public.categoria_zootecnica_canonica_enum as enum (
      'bezerra',
      'novilha',
      'vaca',
      'bezerro',
      'garrote',
      'boi_terminacao',
      'touro'
    );
  end if;

  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace
      and typname = 'fase_veterinaria_enum'
  ) then
    create type public.fase_veterinaria_enum as enum (
      'neonatal',
      'pre_desmama',
      'pos_desmama',
      'pre_pubere',
      'pubere',
      'gestante',
      'puerperio'
    );
  end if;

  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace
      and typname = 'estado_produtivo_reprodutivo_enum'
  ) then
    create type public.estado_produtivo_reprodutivo_enum as enum (
      'vazia',
      'prenhe',
      'pre_parto_imediato',
      'seca',
      'recem_parida',
      'lactacao',
      'inteiro',
      'castrado',
      'reprodutor',
      'terminacao'
    );
  end if;
end $$;

drop view if exists public.vw_animais_taxonomia;

create view public.vw_animais_taxonomia as
with farm_config as (
  select
    f.id as fazenda_id,
    coalesce(nullif(f.metadata #>> '{animal_lifecycle,stage_classification_basis}', ''), 'idade') as stage_classification_basis,
    coalesce(nullif(f.metadata #>> '{animal_lifecycle,weaning_days}', '')::int, 210) as weaning_days,
    coalesce(nullif(f.metadata #>> '{animal_lifecycle,weaning_weight_kg}', '')::numeric, 180) as weaning_weight_kg,
    coalesce(nullif(f.metadata #>> '{animal_lifecycle,male_adult_days}', '')::int, 731) as male_adult_days,
    coalesce(nullif(f.metadata #>> '{animal_lifecycle,male_adult_weight_kg}', '')::numeric, 450) as male_adult_weight_kg
  from public.fazendas f
  where f.deleted_at is null
),
latest_positive_diag as (
  select distinct on (e.fazenda_id, e.animal_id)
    e.fazenda_id,
    e.animal_id,
    nullif(er.payload ->> 'data_prevista_parto', '')::date as data_prevista_parto
  from public.eventos e
  join public.eventos_reproducao er
    on er.evento_id = e.id
   and er.fazenda_id = e.fazenda_id
  where e.deleted_at is null
    and er.deleted_at is null
    and er.tipo = 'diagnostico'
    and coalesce(er.payload ->> 'resultado', er.payload ->> 'diagnostico_resultado') = 'positivo'
  order by e.fazenda_id, e.animal_id, e.occurred_at desc
),
latest_parto as (
  select distinct on (e.fazenda_id, e.animal_id)
    e.fazenda_id,
    e.animal_id,
    e.occurred_at::date as data_ultimo_parto
  from public.eventos e
  join public.eventos_reproducao er
    on er.evento_id = e.id
   and er.fazenda_id = e.fazenda_id
  where e.deleted_at is null
    and er.deleted_at is null
    and er.tipo = 'parto'
  order by e.fazenda_id, e.animal_id, e.occurred_at desc
),
facts as (
  select
    a.id as animal_id,
    a.fazenda_id,
    a.sexo,
    a.status,
    a.data_nascimento,
    a.payload,
    fc.stage_classification_basis,
    fc.weaning_days,
    fc.weaning_weight_kg,
    fc.male_adult_days,
    fc.male_adult_weight_kg,
    case
      when a.data_nascimento is null then null
      else (current_date - a.data_nascimento::date)
    end as idade_dias,
    nullif(a.payload #>> '{weaning,completed_at}', '')::date as data_desmama,
    nullif(a.payload #>> '{metrics,last_weight_kg}', '')::numeric as latest_weight_kg,
    case
      when a.payload #>> '{taxonomy_facts,schema_version}' ~ '^\d+$'
        then (a.payload #>> '{taxonomy_facts,schema_version}')::int
      else 1
    end as taxonomy_facts_schema_version,
    case
      when a.payload #>> '{taxonomy_facts,castrado}' in ('true', 'false')
        then (a.payload #>> '{taxonomy_facts,castrado}')::boolean
      else false
    end as castrado,
    case
      when a.payload #>> '{taxonomy_facts,puberdade_confirmada}' in ('true', 'false')
        then (a.payload #>> '{taxonomy_facts,puberdade_confirmada}')::boolean
      else null
    end as puberdade_confirmada_raw,
    case
      when a.payload #>> '{taxonomy_facts,secagem_realizada}' in ('true', 'false')
        then (a.payload #>> '{taxonomy_facts,secagem_realizada}')::boolean
      else false
    end as secagem_realizada,
    case
      when a.payload #>> '{taxonomy_facts,em_lactacao}' in ('true', 'false')
        then (a.payload #>> '{taxonomy_facts,em_lactacao}')::boolean
      else null
    end as em_lactacao_raw,
    case
      when a.payload #>> '{taxonomy_facts,prenhez_confirmada}' in ('true', 'false')
        then (a.payload #>> '{taxonomy_facts,prenhez_confirmada}')::boolean
      else null
    end as prenhez_confirmada_raw,
    coalesce(
      nullif(a.payload #>> '{taxonomy_facts,data_prevista_parto}', '')::date,
      lpd.data_prevista_parto
    ) as data_prevista_parto,
    coalesce(
      nullif(a.payload #>> '{taxonomy_facts,data_ultimo_parto}', '')::date,
      lp.data_ultimo_parto
    ) as data_ultimo_parto,
    coalesce(
      nullif(a.payload #>> '{lifecycle,destino_produtivo}', ''),
      case
        when a.papel_macho in ('reprodutor', 'rufiao') then a.papel_macho::text
        else null
      end
    ) as destino_produtivo,
    coalesce(
      nullif(a.payload #>> '{male_profile,status_reprodutivo}', ''),
      case
        when a.papel_macho in ('reprodutor', 'rufiao') then
          case when a.habilitado_monta then 'apto' else 'candidato' end
        when a.habilitado_monta then 'apto'
        else null
      end
    ) as status_reprodutivo_macho,
    coalesce(vrsa.status_estimado = 'PRENHA', false) as prenhez_por_repro
  from public.animais a
  join farm_config fc
    on fc.fazenda_id = a.fazenda_id
  left join latest_positive_diag lpd
    on lpd.fazenda_id = a.fazenda_id
   and lpd.animal_id = a.id
  left join latest_parto lp
    on lp.fazenda_id = a.fazenda_id
   and lp.animal_id = a.id
  left join public.vw_repro_status_animal vrsa
    on vrsa.fazenda_id = a.fazenda_id
   and vrsa.animal_id = a.id
  where a.deleted_at is null
),
normalized as (
  select
    f.*,
    coalesce(f.prenhez_confirmada_raw, f.prenhez_por_repro, false) as prenhez_confirmada,
    (f.data_ultimo_parto is not null) as pariu_alguma_vez,
    coalesce(
      f.puberdade_confirmada_raw,
      case
        when f.data_ultimo_parto is not null then true
        when coalesce(f.prenhez_confirmada_raw, f.prenhez_por_repro, false) then true
        when f.status_reprodutivo_macho is not null then true
        else null
      end
    ) as puberdade_confirmada,
    coalesce(
      f.em_lactacao_raw,
      case
        when f.data_ultimo_parto is not null
         and (current_date - f.data_ultimo_parto) <= 210
         and not f.secagem_realizada
          then true
        else false
      end
    ) as em_lactacao
  from facts f
),
classified as (
  select
    n.*,
    (
      case
        when n.sexo = 'F' and n.pariu_alguma_vez then 'vaca'
        when n.sexo = 'F' and (
          case
            when n.stage_classification_basis = 'peso' and n.latest_weight_kg is not null
              then n.latest_weight_kg < n.weaning_weight_kg
            when n.idade_dias is null then true
            else n.idade_dias < n.weaning_days
          end
        ) then 'bezerra'
        when n.sexo = 'F' then 'novilha'
        when (
          case
            when n.stage_classification_basis = 'peso' and n.latest_weight_kg is not null
              then n.latest_weight_kg < n.weaning_weight_kg
            when n.idade_dias is null then true
            else n.idade_dias < n.weaning_days
          end
        ) then 'bezerro'
        when n.destino_produtivo = 'reprodutor'
         and n.status_reprodutivo_macho = 'apto'
         and (
           case
             when n.stage_classification_basis = 'peso' and n.latest_weight_kg is not null
               then n.latest_weight_kg >= n.male_adult_weight_kg
             else coalesce(n.idade_dias >= n.male_adult_days, false)
           end
         ) then 'touro'
        when n.destino_produtivo in ('abate', 'engorda')
         and (
           case
             when n.stage_classification_basis = 'peso' and n.latest_weight_kg is not null
               then n.latest_weight_kg >= n.male_adult_weight_kg
             else coalesce(n.idade_dias >= n.male_adult_days, false)
           end
         ) then 'boi_terminacao'
        else 'garrote'
      end
    )::public.categoria_zootecnica_canonica_enum as categoria_zootecnica,
    (
      case
        when n.data_ultimo_parto is not null and (current_date - n.data_ultimo_parto) <= 60
          then 'puerperio'
        when n.prenhez_confirmada then 'gestante'
        when coalesce(n.idade_dias <= 28, false) then 'neonatal'
        when n.data_desmama is null
         and (n.idade_dias is null or n.idade_dias <= n.weaning_days)
          then 'pre_desmama'
        when n.puberdade_confirmada = true then 'pubere'
        when n.puberdade_confirmada = false then 'pre_pubere'
        else 'pos_desmama'
      end
    )::public.fase_veterinaria_enum as fase_veterinaria
  from normalized n
)
select
  c.animal_id,
  c.fazenda_id,
  c.sexo,
  c.status,
  c.data_nascimento,
  c.taxonomy_facts_schema_version,
  c.idade_dias,
  c.data_desmama,
  c.pariu_alguma_vez,
  c.puberdade_confirmada,
  c.prenhez_confirmada,
  c.data_prevista_parto,
  c.data_ultimo_parto,
  c.secagem_realizada,
  c.em_lactacao,
  c.castrado,
  c.destino_produtivo,
  c.status_reprodutivo_macho,
  c.categoria_zootecnica,
  c.fase_veterinaria,
  (
    case
      when c.sexo = 'F' and c.data_ultimo_parto is not null and (current_date - c.data_ultimo_parto) <= 15
        then 'recem_parida'
      when c.sexo = 'F' and c.secagem_realizada
        then 'seca'
      when c.sexo = 'F'
       and c.prenhez_confirmada
       and c.data_prevista_parto is not null
       and (c.data_prevista_parto - current_date) <= 30
        then 'pre_parto_imediato'
      when c.sexo = 'F' and c.prenhez_confirmada
        then 'prenhe'
      when c.sexo = 'F' and c.em_lactacao
        then 'lactacao'
      when c.sexo = 'F'
        then 'vazia'
      when c.destino_produtivo = 'reprodutor'
       and c.status_reprodutivo_macho in ('apto', 'candidato', 'suspenso')
        then 'reprodutor'
      when c.categoria_zootecnica = 'boi_terminacao'
       or c.destino_produtivo in ('abate', 'engorda')
        then 'terminacao'
      when c.castrado
        then 'castrado'
      else 'inteiro'
    end
  )::public.estado_produtivo_reprodutivo_enum as estado_produtivo_reprodutivo
from classified c;

comment on view public.vw_animais_taxonomia is
  'Projecao canonicamente derivada da taxonomia bovina. Usa fatos em animais.payload.taxonomy_facts e eventos reprodutivos apenas como leitura.';
