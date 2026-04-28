-- 20260408120100_update_repro_views.sql
-- Parte 2: Atualização da View (com DROP para permitir mudança de schema)

-- 1. Remover views dependentes para permitir alteração de colunas em vw_repro_episodios
DROP VIEW IF EXISTS public.vw_repro_status_animal CASCADE;
DROP VIEW IF EXISTS public.vw_repro_episodios CASCADE;

-- 2. Re-criar vw_repro_episodios (Versão complexa com suporte a Aborto)
create or replace view public.vw_repro_episodios as
with base as (
  select
    e.id              as evento_id,
    e.fazenda_id,
    e.animal_id,
    e.lote_id,
    e.occurred_at,
    e.observacoes,
    e.payload         as payload_evento,
    e.corrige_evento_id,
    r.tipo,
    r.macho_id,
    r.payload         as payload_repro
  from public.eventos e
  join public.eventos_reproducao r
    on r.evento_id = e.id
   and r.fazenda_id = e.fazenda_id
  where e.dominio = 'reproducao'
    and e.animal_id is not null
    and e.deleted_at is null
),
services as (
  select
    b.*,
    lead(b.occurred_at) over (
      partition by b.fazenda_id, b.animal_id
      order by b.occurred_at
    ) as next_service_at
  from base b
  where b.tipo in ('cobertura','IA')
),
diagnosticos as (
  select * from base where tipo = 'diagnostico'
),
partos as (
  select * from base where tipo = 'parto'
),
abortos as (
  select * from base where tipo = 'aborto'
)
select
  s.fazenda_id,
  s.animal_id,

  -- episódio
  s.evento_id                as episodio_evento_id,
  s.tipo                     as tipo_servico,
  s.occurred_at              as servico_occurred_at,
  s.macho_id                 as servico_macho_id,
  s.lote_id                  as servico_lote_id,

  -- diagnóstico
  d.evento_id                as diagnostico_evento_id,
  d.occurred_at              as diagnostico_occurred_at,
  coalesce(
    d.payload_repro ->> 'resultado',
    d.payload_repro ->> 'diagnostico_resultado'
  )                          as diagnostico_resultado,
  case
    when (d.payload_repro ->> 'data_prevista_parto') ~ '^\d{4}-\d{2}-\d{2}$'
      then (d.payload_repro ->> 'data_prevista_parto')::date
    when coalesce(d.payload_repro ->> 'resultado', d.payload_repro ->> 'diagnostico_resultado') = 'positivo'
      then (s.occurred_at + interval '283 days')::date
    else null
  end                        as data_prevista_parto,

  -- parto
  p.evento_id                as parto_evento_id,
  p.occurred_at              as parto_occurred_at,
  case
    when (p.payload_repro ->> 'numero_crias') ~ '^\d+$'
      then (p.payload_repro ->> 'numero_crias')::int
    else null
  end as numero_crias,
  (p.occurred_at + interval '210 days')::date as data_prevista_desmame,

  -- aborto
  a.evento_id                as aborto_evento_id,
  a.occurred_at              as aborto_occurred_at,

  -- status do episódio
  case
    when p.evento_id is not null then 'parido'
    when a.evento_id is not null then 'abortado'
    when coalesce(d.payload_repro ->> 'resultado', d.payload_repro ->> 'diagnostico_resultado') = 'positivo' then 'prenhez_confirmada'
    when coalesce(d.payload_repro ->> 'resultado', d.payload_repro ->> 'diagnostico_resultado') = 'negativo' then 'falhou'
    when d.evento_id is not null then 'diagnostico_pendente'
    else 'aberto'
  end                        as status_episodio

from services s
left join lateral (
  select d1.*
  from diagnosticos d1
  where d1.fazenda_id = s.fazenda_id
    and d1.animal_id = s.animal_id
    and d1.occurred_at >= s.occurred_at
    and (s.next_service_at is null or d1.occurred_at < s.next_service_at)
    and (
      (d1.payload_repro ->> 'episode_evento_id') is null
      or (d1.payload_repro ->> 'episode_evento_id') = s.evento_id::text
    )
  order by
    ((d1.payload_repro ->> 'episode_evento_id') = s.evento_id::text) desc,
    d1.occurred_at desc
  limit 1
) d on true
left join lateral (
  select p1.*
  from partos p1
  where p1.fazenda_id = s.fazenda_id
    and p1.animal_id = s.animal_id
    and p1.occurred_at >= s.occurred_at
    and (s.next_service_at is null or p1.occurred_at < s.next_service_at)
    and (
      (p1.payload_repro ->> 'episode_evento_id') is null
      or (p1.payload_repro ->> 'episode_evento_id') = s.evento_id::text
    )
  order by
    ((p1.payload_repro ->> 'episode_evento_id') = s.evento_id::text) desc,
    p1.occurred_at asc
  limit 1
) p on true
left join lateral (
  select a1.*
  from abortos a1
  where a1.fazenda_id = s.fazenda_id
    and a1.animal_id = s.animal_id
    and a1.occurred_at >= s.occurred_at
    and (s.next_service_at is null or a1.occurred_at < s.next_service_at)
    and (
      (a1.payload_repro ->> 'episode_evento_id') is null
      or (a1.payload_repro ->> 'episode_evento_id') = s.evento_id::text
    )
  order by
    ((a1.payload_repro ->> 'episode_evento_id') = s.evento_id::text) desc,
    a1.occurred_at asc
  limit 1
) a on true;

-- 3. Re-criar vw_repro_status_animal
-- Deriva o status reprodutivo atual por animal a partir de vw_repro_episodios.
create or replace view public.vw_repro_status_animal as
with epis as (
  select * from public.vw_repro_episodios
),
last_epi as (
  select distinct on (fazenda_id, animal_id)
    fazenda_id,
    animal_id,
    episodio_evento_id,
    servico_occurred_at,
    diagnostico_occurred_at,
    diagnostico_resultado,
    data_prevista_parto,
    parto_occurred_at,
    data_prevista_desmame,
    status_episodio
  from epis
  order by fazenda_id, animal_id, servico_occurred_at desc
),
last_parto as (
  select
    fazenda_id,
    animal_id,
    max(parto_occurred_at) as last_parto_at
  from epis
  group by fazenda_id, animal_id
)
select
  le.fazenda_id,
  le.animal_id,

  -- categoria produtiva inferida
  case
    when lp.last_parto_at is null then 'novilha'
    else 'vaca'
  end as categoria_produtiva_inferida,

  -- status reprodutivo atual (derivado)
  case
    when lp.last_parto_at is not null
     and now() <= lp.last_parto_at + interval '45 days'
      then 'PARIDA_PUERPERIO'

    when lp.last_parto_at is not null
     and now() <= lp.last_parto_at + interval '210 days'
      then 'LACTANTE'

    when le.status_episodio = 'prenhez_confirmada'
      then 'PRENHA'

    when le.status_episodio in ('aberto','diagnostico_pendente')
      then 'SERVIDA'

    when le.status_episodio in ('falhou', 'abortado')
      then 'ABERTA'

    else 'ABERTA'
  end as status_reprodutivo,

  -- referências úteis para UI
  le.episodio_evento_id as episodio_atual_evento_id,
  le.servico_occurred_at as last_servico_at,
  le.diagnostico_occurred_at as last_diagnostico_at,
  le.diagnostico_resultado as last_diagnostico_resultado,
  lp.last_parto_at,
  le.data_prevista_parto,
  le.data_prevista_desmame

from last_epi le
left join last_parto lp
  on lp.fazenda_id = le.fazenda_id
   and lp.animal_id = le.animal_id;
