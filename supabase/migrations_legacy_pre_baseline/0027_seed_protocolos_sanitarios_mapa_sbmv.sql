-- Seed de protocolos sanitarios padrao (MAPA + referencia tecnica SBMV).
-- Objetivo:
-- 1) disponibilizar templates sanitarios por fazenda no modelo atual;
-- 2) manter idempotencia por template_code/item_code;
-- 3) auto-semeadura para fazendas novas via trigger.

create or replace function public.seed_default_sanitary_protocols(_fazenda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id constant text := 'system:seed:mapa-sbmv:v1';
  v_now timestamptz := now();
  v_seed_tx_id uuid := gen_random_uuid();
begin
  -- Evita corrida entre trigger de insert de fazenda e execucoes concorrentes.
  perform pg_advisory_xact_lock(
    hashtext('seed_default_sanitary_protocols'),
    hashtext(_fazenda_id::text)
  );

  with protocol_templates as (
    select *
    from (
      values
        (
          'MAPA_BRUCELOSE_FEMEAS_3A8M_V1',
          'MAPA | Brucelose femeas 3-8 meses (B19/RB51)',
          'Vacinacao oficial do PNCEBT para femeas bovinas e bubalinas entre 3 e 8 meses. Exige supervisao/registro veterinario e comprovacao ao SVO.',
          true,
          jsonb_build_object(
            'categoria', 'vacinacao_obrigatoria',
            'alvo', 'femeas_bovinas_bubalinas_3a8_meses',
            'obrigatorio', true,
            'requires_vet', true,
            'requires_compliance_document', true,
            'notes',
              'Registrar comprovante no SVO e marcacao sanitaria conforme vacina utilizada (B19/RB51).',
            'fonte',
              jsonb_build_array(
                'https://www.gov.br/agricultura/pt-br/assuntos/noticias/mapa-reforca-a-importancia-da-vacinacao-contra-brucelose',
                'https://www.gov.br/agricultura/pt-br/assuntos/saude-animal-e-sanidade-vegetal/saude-animal/programas-de-saude-animal/brucelose-e-tuberculose-pncetb'
              )
          )
        ),
        (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
          'MAPA | Raiva herbivoros - primovacinacao (areas de risco)',
          'Aplicacao inicial em herbivoros em area de ocorrencia de raiva, com reforco programado apos 30 dias para primovacinados.',
          true,
          jsonb_build_object(
            'categoria', 'vacinacao_preventiva',
            'alvo', 'herbivoros_em_areas_de_ocorrencia',
            'obrigatorio_por_risco', true,
            'requires_vet_supervision', true,
            'notes',
              'IN MAPA no 5/2002: animais primovacinados devem receber reforco apos 30 dias.',
            'fonte',
              jsonb_build_array(
                'https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica',
                'https://www.defesa.agricultura.sp.gov.br/legislacoes/instrucao-normativa-mapa-5-de-01-03-2002%2C728.html'
              )
          )
        ),
        (
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
          'MAPA | Raiva herbivoros - revacinacao anual (areas de risco)',
          'Revacinacao periodica em ate 12 meses, conforme imunidade da vacina e orientacao do veterinario responsavel.',
          true,
          jsonb_build_object(
            'categoria', 'vacinacao_preventiva',
            'alvo', 'herbivoros_em_areas_de_ocorrencia',
            'obrigatorio_por_risco', true,
            'notes',
              'IN MAPA no 5/2002: efeito de revacinacao com intervalo maximo de 12 meses.',
            'fonte',
              jsonb_build_array(
                'https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica',
                'https://www.defesa.agricultura.sp.gov.br/legislacoes/instrucao-normativa-mapa-5-de-01-03-2002%2C728.html'
              )
          )
        ),
        (
          'SBMV_VERMIFUGACAO_ESTRATEGICA_V1',
          'SBMV | Vermifugacao estrategica com base em risco',
          'Template de vermifugacao estrategica com revisao por OPG/coprologico e ajuste por categoria animal, estacao e historico da fazenda.',
          true,
          jsonb_build_object(
            'categoria', 'controle_parasitario',
            'obrigatorio', false,
            'requires_vet', true,
            'requires_epidemiology_review', true,
            'notes',
              'Intervalo inicial sugerido; deve ser ajustado por medico veterinario responsavel para reduzir resistencia anti-helmintica.',
            'fonte',
              jsonb_build_array(
                'https://sbmv.org/',
                'https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/resistencia-aos-antimicrobianos/antimicrobianos'
              )
          )
        ),
        (
          'SBMV_MAPA_MEDICACAO_USO_PRUDENTE_V1',
          'SBMV/MAPA | Medicacao terapeutica com uso prudente',
          'Template para tratamentos sob prescricao veterinaria, com foco em uso prudente de medicamentos e avaliacao clinica pos-tratamento.',
          true,
          jsonb_build_object(
            'categoria', 'medicacao',
            'obrigatorio', false,
            'requires_vet', true,
            'requires_prescription', true,
            'notes',
              'Uso de antimicrobianos deve ser clinicamente justificado e, preferencialmente, apoiado por diagnostico laboratorial.',
            'fonte',
              jsonb_build_array(
                'https://sbmv.org/',
                'https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/resistencia-aos-antimicrobianos/antimicrobianos',
                'https://www.gov.br/agricultura/pt-br/assuntos/noticias/mapa-realiza-forum-sobre-resistencia-aos-antimicrobianos'
              )
          )
        )
    ) as t(template_code, nome, descricao, ativo, payload)
  )
  insert into public.protocolos_sanitarios (
    id,
    fazenda_id,
    nome,
    descricao,
    ativo,
    payload,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at
  )
  select
    gen_random_uuid(),
    _fazenda_id,
    t.nome,
    t.descricao,
    t.ativo,
    t.payload
      || jsonb_build_object(
        'template_code', t.template_code,
        'seed_version', '2026-02-11',
        'seed_origin', 'MAPA_SBMV'
      ),
    v_client_id,
    gen_random_uuid(),
    v_seed_tx_id,
    v_now
  from protocol_templates t
  where not exists (
    select 1
    from public.protocolos_sanitarios p
    where p.fazenda_id = _fazenda_id
      and p.payload ->> 'template_code' = t.template_code
  );

  with protocol_base as (
    select
      p.id as protocolo_id,
      p.fazenda_id,
      p.payload ->> 'template_code' as template_code
    from public.protocolos_sanitarios p
    where p.fazenda_id = _fazenda_id
      and p.deleted_at is null
  ),
  item_templates as (
    select *
    from (
      values
        (
          'MAPA_BRUCELOSE_FEMEAS_3A8M_V1',
          'BRUCELOSE_DOSE_UNICA',
          'vacinacao',
          'Vacina Brucelose B19 ou RB51 (conforme SVO/RT)',
          1,
          1,
          false,
          'brucelose:{animal_id}:dose:{dose_num}',
          jsonb_build_object(
            'alvo', 'femeas_3a8_meses',
            'janela_etaria_meses', jsonb_build_object('min', 3, 'max', 8),
            'dose_unica', true,
            'vias_recomendadas', jsonb_build_array('subcutanea'),
            'observacao',
              'Dose unica. Campo intervalo_dias e tecnico (schema exige > 0) e nao implica reforco.'
          )
        ),
        (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
          'RAIVA_PRIMOVAC_D1',
          'vacinacao',
          'Vacina antirrabica inativada (2 mL, SC/IM)',
          30,
          1,
          true,
          'raiva:{animal_id}:d1',
          jsonb_build_object(
            'dose_ml', 2,
            'dose_stage', 'D1',
            'next_item_code', 'RAIVA_PRIMOVAC_D2',
            'vias_recomendadas', jsonb_build_array('subcutanea', 'intramuscular'),
            'observacao', 'Item de primovacinacao com reforco automatico em 30 dias.'
          )
        ),
        (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
          'RAIVA_PRIMOVAC_D2',
          'vacinacao',
          'Vacina antirrabica inativada (2 mL, SC/IM)',
          1,
          2,
          false,
          'raiva:{animal_id}:d2',
          jsonb_build_object(
            'dose_ml', 2,
            'dose_stage', 'D2',
            'vias_recomendadas', jsonb_build_array('subcutanea', 'intramuscular'),
            'observacao',
              'Reforco da primovacinacao. Sem agenda automatica neste item para evitar recorrencia indevida.'
          )
        ),
        (
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
          'RAIVA_REVAC_ANUAL',
          'vacinacao',
          'Vacina antirrabica inativada (2 mL, SC/IM)',
          365,
          1,
          true,
          'raiva:{animal_id}:anual',
          jsonb_build_object(
            'dose_ml', 2,
            'vias_recomendadas', jsonb_build_array('subcutanea', 'intramuscular'),
            'observacao',
              'Revacinacao anual (ajustar conforme bula e orientacao do medico veterinario).'
          )
        ),
        (
          'SBMV_VERMIFUGACAO_ESTRATEGICA_V1',
          'VERMIFUGACAO_ESTRATEGICA_120D',
          'vermifugacao',
          'Anti-helmintico conforme prescricao e estrategia de rotacao',
          120,
          1,
          true,
          'vermif:{animal_id}:ciclo',
          jsonb_build_object(
            'requires_copro', true,
            'resistencia_monitoring', true,
            'observacao',
              'Intervalo inicial sugerido para manejo estrategico. Ajustar por categoria e sazonalidade.'
          )
        ),
        (
          'SBMV_MAPA_MEDICACAO_USO_PRUDENTE_V1',
          'MEDICACAO_TERAPEUTICA_REAVALIAR_72H',
          'medicamento',
          'Medicamento sob prescricao veterinaria',
          3,
          1,
          true,
          'medicacao:{animal_id}:reavaliacao',
          jsonb_build_object(
            'reavaliacao_horas', 72,
            'requires_prescription', true,
            'observacao',
              'Registrar principio ativo, dose, via e periodo de carencia no payload do evento.'
          )
        )
    ) as t(
      template_code,
      item_code,
      tipo,
      produto,
      intervalo_dias,
      dose_num,
      gera_agenda,
      dedup_template,
      payload
    )
  )
  insert into public.protocolos_sanitarios_itens (
    id,
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
    client_recorded_at
  )
  select
    gen_random_uuid(),
    _fazenda_id,
    p.protocolo_id,
    gen_random_uuid(),
    1,
    t.tipo::public.sanitario_tipo_enum,
    t.produto,
    t.intervalo_dias,
    t.dose_num,
    t.gera_agenda,
    t.dedup_template,
    t.payload
      || jsonb_build_object(
        'item_code', t.item_code,
        'seed_version', '2026-02-11',
        'seed_origin', 'MAPA_SBMV'
      ),
    v_client_id,
    gen_random_uuid(),
    v_seed_tx_id,
    v_now
  from item_templates t
  join protocol_base p
    on p.template_code = t.template_code
  where not exists (
    select 1
    from public.protocolos_sanitarios_itens i
    where i.fazenda_id = _fazenda_id
      and i.protocolo_id = p.protocolo_id
      and i.payload ->> 'item_code' = t.item_code
  );
end;
$$;

create or replace function public.trg_seed_default_sanitary_protocols_on_farm_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_sanitary_protocols(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_default_sanitary_protocols_on_farm_insert on public.fazendas;
create trigger trg_seed_default_sanitary_protocols_on_farm_insert
after insert on public.fazendas
for each row
execute function public.trg_seed_default_sanitary_protocols_on_farm_insert();

do $$
declare
  f record;
begin
  for f in
    select id
    from public.fazendas
    where deleted_at is null
  loop
    perform public.seed_default_sanitary_protocols(f.id);
  end loop;
end $$;

