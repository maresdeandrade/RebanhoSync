-- Idempotent structural seed for global sanitary catalogs.
-- Keep normative expansion out of this file unless it already exists in project sources.

insert into public.produtos_veterinarios (nome, categoria)
select v.nome, v.categoria
from (values
  ('Ivermectina', 'antiparasitario'),
  ('Doramectina', 'antiparasitario'),
  ('Abamectina', 'antiparasitario'),
  ('Vacina Brucelose', 'vacina'),
  ('Vacina Raiva', 'vacina'),
  ('Penicilina', 'antibiotico'),
  ('Oxitetraciclina', 'antibiotico'),
  ('Complexo B', 'suplemento')
) as v(nome, categoria)
where not exists (
  select 1
  from public.produtos_veterinarios p
  where lower(p.nome) = lower(v.nome)
);

insert into public.catalogo_protocolos_oficiais (
  slug, nome, versao, escopo, uf, aptidao, sistema, status_legal, base_legal_json, payload
) values
  (
    'brucelose-bezerras',
    'Brucelose - bezerras',
    1,
    'federal',
    null,
    'all',
    'all',
    'obrigatorio',
    '{"fonte":"projeto"}'::jsonb,
    '{"family_code":"brucelose","descricao_operacional":"Vacinação de bezerras conforme pacote oficial existente no projeto."}'::jsonb
  ),
  (
    'raiva-herbivoros-risco',
    'Raiva dos herbívoros - áreas de risco',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"projeto"}'::jsonb,
    '{"family_code":"raiva_herbivoros","descricao_operacional":"Calendário de raiva por risco conforme contrato sanitário atual."}'::jsonb
  ),
  (
    'medicamentos-carencia-rastreabilidade',
    'Medicamentos - carência e rastreabilidade',
    1,
    'federal',
    null,
    'all',
    'all',
    'boa_pratica',
    '{"fonte":"projeto"}'::jsonb,
    '{"family_code":"medicamentos_rastreabilidade","descricao_operacional":"Checklist documental de uso de medicamentos; não define dose obrigatória."}'::jsonb
  ),
  (
    'parasitas-estrategico',
    'Controle parasitário estratégico',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"projeto"}'::jsonb,
    '{"family_code":"controle_parasitario","descricao_operacional":"Controle parasitário operacional conforme catálogo existente."}'::jsonb
  ),
  (
    'suspeita-notificacao-imediata',
    'Suspeita sanitária - notificação imediata',
    1,
    'federal',
    null,
    'all',
    'all',
    'obrigatorio',
    '{"fonte":"projeto"}'::jsonb,
    '{"family_code":"notificacao_suspeita","descricao_operacional":"Read model/documento de atenção; não materializa vacinação."}'::jsonb
  )
on conflict (slug) do update
set nome = excluded.nome,
    versao = excluded.versao,
    escopo = excluded.escopo,
    uf = excluded.uf,
    aptidao = excluded.aptidao,
    sistema = excluded.sistema,
    status_legal = excluded.status_legal,
    base_legal_json = excluded.base_legal_json,
    payload = excluded.payload,
    updated_at = now();

with templates as (
  select id, slug from public.catalogo_protocolos_oficiais
)
insert into public.catalogo_protocolos_oficiais_itens (
  template_id, area, codigo, categoria_animal, gatilho_tipo, gatilho_json,
  frequencia_json, requires_vet, requires_gta, carencia_regra_json, gera_agenda, payload
)
select t.id, s.area, s.codigo, s.categoria_animal, s.gatilho_tipo, s.gatilho_json,
       s.frequencia_json, s.requires_vet, s.requires_gta, s.carencia_regra_json,
       s.gera_agenda, s.payload
from templates t
join (values
  (
    'brucelose-bezerras',
    'vacinacao',
    'brucelose-b19-dose-unica',
    'bezerra',
    'idade',
    '{"sexo_alvo":"F","age_start_days":90,"age_end_days":240}'::jsonb,
    '{"interval_days":1,"dose_num":1}'::jsonb,
    true,
    false,
    '{}'::jsonb,
    true,
    '{"produto":"Vacina Brucelose","label":"Brucelose B19","requires_documentation":true}'::jsonb
  ),
  (
    'raiva-herbivoros-risco',
    'vacinacao',
    'raiva-d1',
    null,
    'risco',
    '{"risk_field":"zona_raiva_risco","risk_values":["medio","alto"],"age_start_days":90}'::jsonb,
    '{"interval_days":30,"dose_num":1}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    true,
    '{"produto":"Vacina Raiva","label":"Raiva D1"}'::jsonb
  ),
  (
    'raiva-herbivoros-risco',
    'vacinacao',
    'raiva-reforco-30d',
    null,
    'risco',
    '{"risk_field":"zona_raiva_risco","risk_values":["medio","alto"],"age_start_days":90}'::jsonb,
    '{"interval_days":30,"dose_num":2}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    true,
    '{"produto":"Vacina Raiva","label":"Raiva reforço 30 dias"}'::jsonb
  ),
  (
    'raiva-herbivoros-risco',
    'vacinacao',
    'raiva-anual',
    null,
    'risco',
    '{"risk_field":"zona_raiva_risco","risk_values":["medio","alto"],"age_start_days":90}'::jsonb,
    '{"interval_days":365,"dose_num":3}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    true,
    '{"produto":"Vacina Raiva","label":"Raiva anual"}'::jsonb
  ),
  (
    'parasitas-estrategico',
    'parasitas',
    'vermifugacao-estrategica',
    null,
    'risco',
    '{"risk_field":"pressao_helmintos","risk_values":["medio","alto"]}'::jsonb,
    '{"interval_days":180,"dose_num":1}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    true,
    '{"produto":"Ivermectina","label":"Vermifugação estratégica"}'::jsonb
  ),
  (
    'medicamentos-carencia-rastreabilidade',
    'medicamentos',
    'medicamento-registro-carencia',
    null,
    'uso_produto',
    '{}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    '{"modelado_como":"metadata_compliance_parcial"}'::jsonb,
    false,
    '{"label":"Registrar medicamento e carência","nao_define_dose":true}'::jsonb
  ),
  (
    'suspeita-notificacao-imediata',
    'notificacao',
    'suspeita-notificar-svo',
    null,
    'risco',
    '{}'::jsonb,
    '{}'::jsonb,
    true,
    false,
    '{}'::jsonb,
    false,
    '{"label":"Suspeita sanitária: acionar orientação oficial"}'::jsonb
  )
) as s(slug, area, codigo, categoria_animal, gatilho_tipo, gatilho_json, frequencia_json, requires_vet, requires_gta, carencia_regra_json, gera_agenda, payload)
  on s.slug = t.slug
on conflict (template_id, codigo) do update
set area = excluded.area,
    categoria_animal = excluded.categoria_animal,
    gatilho_tipo = excluded.gatilho_tipo,
    gatilho_json = excluded.gatilho_json,
    frequencia_json = excluded.frequencia_json,
    requires_vet = excluded.requires_vet,
    requires_gta = excluded.requires_gta,
    carencia_regra_json = excluded.carencia_regra_json,
    gera_agenda = excluded.gera_agenda,
    payload = excluded.payload,
    updated_at = now();

insert into public.catalogo_doencas_notificaveis (
  codigo, nome, especie_alvo, tipo_notificacao, sinais_alerta_json, acao_imediata_json, base_legal_json
) values
  (
    'raiva',
    'Raiva dos herbívoros',
    'bovinos',
    'imediata',
    '{"fonte":"projeto","sinais":["neurologicos","alteracao_comportamental"]}'::jsonb,
    '{"fonte":"projeto","acao":"isolar e acionar orientação oficial"}'::jsonb,
    '{"fonte":"projeto"}'::jsonb
  ),
  (
    'brucelose',
    'Brucelose',
    'bovinos',
    'conforme_orientacao_oficial',
    '{"fonte":"projeto","sinais":["abortamento","falha_reprodutiva"]}'::jsonb,
    '{"fonte":"projeto","acao":"registrar suspeita e buscar orientação técnica"}'::jsonb,
    '{"fonte":"projeto"}'::jsonb
  ),
  (
    'tuberculose',
    'Tuberculose bovina',
    'bovinos',
    'conforme_orientacao_oficial',
    '{"fonte":"projeto","sinais":["emagrecimento","tosse_cronica"]}'::jsonb,
    '{"fonte":"projeto","acao":"registrar suspeita e buscar orientação técnica"}'::jsonb,
    '{"fonte":"projeto"}'::jsonb
  )
on conflict (codigo) do update
set nome = excluded.nome,
    especie_alvo = excluded.especie_alvo,
    tipo_notificacao = excluded.tipo_notificacao,
    sinais_alerta_json = excluded.sinais_alerta_json,
    acao_imediata_json = excluded.acao_imediata_json,
    base_legal_json = excluded.base_legal_json,
    updated_at = now();
