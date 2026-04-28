-- Idempotent structural seed for global sanitary catalogs.
-- P6.1: conservative canonical catalog. Do not use this seed as the full
-- normative source; payload.fonte_base marks entries that still require
-- external/UF/finality validation before becoming hard product policy.

insert into public.produtos_veterinarios (nome, categoria)
select v.nome, v.categoria
from (values
  ('Ivermectina', 'antiparasitario'),
  ('Doramectina', 'antiparasitario'),
  ('Abamectina', 'antiparasitario'),
  ('Benzimidazol', 'antiparasitario'),
  ('Levamisol', 'antiparasitario'),
  ('Endectocida generico', 'antiparasitario'),
  ('Ectoparasiticida carrapaticida', 'ectoparasiticida'),
  ('Vacina Brucelose B19', 'vacina'),
  ('Vacina Raiva Herbivoros', 'vacina'),
  ('Vacina Clostridioses Polivalente', 'vacina'),
  ('Vacina Reprodutiva IBR BVD Leptospirose', 'vacina'),
  ('Antibiotico Penicilinico', 'antibiotico'),
  ('Antibiotico Oxitetraciclina', 'antibiotico'),
  ('Anti-inflamatorio nao esteroidal', 'anti-inflamatorio'),
  ('Antisseptico iodado', 'antisseptico'),
  ('Solucao eletrolitica oral', 'suporte-hidratacao'),
  ('Suporte vitaminico mineral', 'suplemento'),
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
    'brucelose-pncebt',
    'Brucelose PNCEBT - femeas 3 a 8 meses',
    1,
    'federal',
    null,
    'all',
    'all',
    'obrigatorio',
    '{"fonte":"premissa_projeto","programa":"PNCEBT"}'::jsonb,
    '{"family_code":"brucelose","fonte_base":"PNCEBT/premissa_projeto","descricao_operacional":"Vacinacao obrigatoria contra brucelose para femeas bovinas/bubalinas entre 3 e 8 meses.","observacao":"Execucao exige responsavel tecnico/habilitacao conforme regra oficial.","matriz_p6_1":true}'::jsonb
  ),
  (
    'raiva-herbivoros-risco',
    'Raiva dos herbivoros - vigilancia e risco configurado',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"premissa_projeto","programa":"PNCRH"}'::jsonb,
    '{"family_code":"raiva_herbivoros","fonte_base":"PNCRH/premissa_projeto","descricao_operacional":"Vigilancia e vacinacao estrategica condicionada a risco/configuracao da fazenda.","depends_on_config":["fazenda_sanidade_config.zona_raiva_risco","ativacao_operacional_explicita"],"nao_universal":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'pnefa-sindrome-vesicular',
    'PNEFA - vigilancia de sindrome vesicular',
    1,
    'federal',
    null,
    'all',
    'all',
    'obrigatorio',
    '{"fonte":"premissa_projeto","programa":"PNEFA"}'::jsonb,
    '{"family_code":"febre_aftosa_vigilancia","fonte_base":"PNEFA/premissa_projeto","descricao_operacional":"Vigilancia, alerta e bloqueio operacional futuro para suspeita de sindrome vesicular.","nao_criar_vacinacao_rotineira":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'in50-doencas-notificaveis',
    'IN MAPA 50/2013 - doencas notificaveis',
    1,
    'federal',
    null,
    'all',
    'all',
    'obrigatorio',
    '{"fonte":"premissa_projeto","ato":"IN MAPA 50/2013"}'::jsonb,
    '{"family_code":"doencas_notificaveis","fonte_base":"IN MAPA 50/2013/premissa_projeto","descricao_operacional":"Catalogo de alerta/notificacao. Suspeita/notificacao nao vira agenda periodica por padrao.","matriz_p6_1":true}'::jsonb
  ),
  (
    'transito-gta-precheck',
    'Transito externo - checklist GTA/e-GTA',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"premissa_projeto"}'::jsonb,
    '{"family_code":"transito_documental","fonte_base":"validar_regra_externa_uf_finalidade","descricao_operacional":"Checklist/preflight documental para transito externo; nao modela emissao fiscal/documental completa.","requires_external_validation":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'clostridioses-tecnico',
    'Clostridioses - recomendacao tecnica',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"tecnico_projeto"}'::jsonb,
    '{"family_code":"clostridioses","fonte_base":"tecnico_recomendado","descricao_operacional":"Catalogo tecnico; agenda nasce somente se a fazenda ativar protocolo operacional.","activation_required_for_agenda":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'reprodutiva-ibr-bvd-lepto',
    'IBR/BVD/Leptospirose - recomendacao tecnica',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"tecnico_projeto"}'::jsonb,
    '{"family_code":"leptospirose_ibr_bvd","fonte_base":"tecnico_recomendado","descricao_operacional":"Protocolo reprodutivo recomendado; nao e obrigacao legal no projeto.","activation_required_for_agenda":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'vermifugacao-estrategica',
    'Vermifugacao estrategica - recomendacao tecnica',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"tecnico_projeto"}'::jsonb,
    '{"family_code":"controle_parasitario","fonte_base":"tecnico_recomendado","descricao_operacional":"Controle de helmintos condicionado a pressao/configuracao e ativacao operacional pela fazenda.","activation_required_for_agenda":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'controle-carrapato',
    'Controle de carrapato - recomendacao tecnica',
    1,
    'federal',
    null,
    'all',
    'all',
    'recomendado',
    '{"fonte":"tecnico_projeto"}'::jsonb,
    '{"family_code":"controle_carrapato","fonte_base":"tecnico_recomendado","descricao_operacional":"Controle de ectoparasitas condicionado a pressao/configuracao e ativacao operacional pela fazenda.","activation_required_for_agenda":true,"matriz_p6_1":true}'::jsonb
  ),
  (
    'biosseguranca-operacional',
    'Biosseguranca operacional - boas praticas',
    1,
    'federal',
    null,
    'all',
    'all',
    'boa_pratica',
    '{"fonte":"tecnico_projeto"}'::jsonb,
    '{"family_code":"biosseguranca_operacional","fonte_base":"boa_pratica","descricao_operacional":"Checklist operacional de biosseguranca, agua/limpeza e quarentena; nao gera agenda animal automatica.","matriz_p6_1":true}'::jsonb
  ),
  (
    'medicamentos-rastreabilidade',
    'Medicamentos - rastreabilidade e carencia operacional',
    1,
    'federal',
    null,
    'all',
    'all',
    'boa_pratica',
    '{"fonte":"tecnico_projeto"}'::jsonb,
    '{"family_code":"medicamentos_rastreabilidade","fonte_base":"boa_pratica","descricao_operacional":"Registro estruturado de uso de medicamentos; nao define dose, posologia ou carencia obrigatoria no seed.","nao_define_dose":true,"nao_define_carencia_obrigatoria":true,"matriz_p6_1":true}'::jsonb
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
    'brucelose-pncebt',
    'vacinacao',
    'brucelose-b19-dose-unica',
    'femea_bovina_bubalina',
    'idade',
    '{"sexo_alvo":"F","species":["bovino","bubalino"],"age_start_days":90,"age_end_days":240}'::jsonb,
    '{"dose_num":1,"dose_label":"dose_unica"}'::jsonb,
    true,
    false,
    '{}'::jsonb,
    true,
    '{"produto":"Vacina Brucelose B19","label":"Brucelose PNCEBT - dose unica","tipo_evento_sanitario":"vacinacao","family_code":"brucelose","dedup_strategy":"animal_family_item_window","requires_documentation":true,"observacao":"Execucao exige responsavel tecnico/habilitacao conforme regra oficial."}'::jsonb
  ),
  (
    'raiva-herbivoros-risco',
    'vacinacao',
    'raiva-vigilancia-risco',
    null,
    'risco',
    '{"risk_field":"zona_raiva_risco","risk_values":["medio","alto"],"requires_explicit_activation":true}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"produto":"Vacina Raiva Herbivoros","label":"Raiva dos herbivoros - avaliar risco/configuracao","tipo_evento_sanitario":"vacinacao","family_code":"raiva_herbivoros","dedup_strategy":"activation_required","motivo_nao_gerar_agenda":"Depende de risco/configuracao e ativacao operacional explicita; nao aplicar universalmente."}'::jsonb
  ),
  (
    'pnefa-sindrome-vesicular',
    'notificacao',
    'sindrome-vesicular-alerta',
    null,
    'risco',
    '{"event_code":"suspeita_sindrome_vesicular"}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"label":"Suspeita de sindrome vesicular - alerta/notificacao","tipo_evento_sanitario":"alerta_sanitario","family_code":"febre_aftosa_vigilancia","dedup_strategy":"animal_disease_event","bloqueia_movimentacao":true,"requires_technical_guidance":true,"requires_official_notification":true,"nao_criar_vacinacao_rotineira":true,"motivo_nao_gerar_agenda":"PNEFA entra como vigilancia/notificacao, nao como calendario vacinal default."}'::jsonb
  ),
  (
    'in50-doencas-notificaveis',
    'notificacao',
    'doencas-notificaveis-alerta',
    null,
    'risco',
    '{"source":"catalogo_doencas_notificaveis"}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"label":"Doencas notificaveis - registrar suspeita e orientar notificacao","tipo_evento_sanitario":"alerta_sanitario","family_code":"doencas_notificaveis","dedup_strategy":"animal_disease_event","bloqueia_movimentacao":true,"requires_technical_guidance":true,"requires_official_notification":true,"motivo_nao_gerar_agenda":"Catalogo de alerta/notificacao nao cria agenda periodica."}'::jsonb
  ),
  (
    'transito-gta-precheck',
    'biosseguranca',
    'gta-egta-precheck',
    null,
    'movimento',
    '{"external_transit":true,"requires_external_validation":true}'::jsonb,
    '{}'::jsonb,
    false,
    true,
    '{}'::jsonb,
    false,
    '{"label":"Checklist GTA/e-GTA antes de transito externo","tipo_evento_sanitario":"conformidade","family_code":"transito_documental","dedup_strategy":"movement_context","bloqueia_movimentacao":true,"motivo_nao_gerar_agenda":"Checklist/preflight documental; nao e agenda sanitaria periodica nem emissao fiscal."}'::jsonb
  ),
  (
    'clostridioses-tecnico',
    'vacinacao',
    'clostridioses-recomendado',
    null,
    'calendario',
    '{}'::jsonb,
    '{"suggested_interval_days":365}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"produto":"Vacina Clostridioses Polivalente","label":"Clostridioses - protocolo tecnico recomendado","tipo_evento_sanitario":"vacinacao","family_code":"clostridioses","dedup_strategy":"farm_activation_required","motivo_nao_gerar_agenda":"Boa recomendacao tecnica; agenda so nasce por protocolo operacional ativado pela fazenda."}'::jsonb
  ),
  (
    'reprodutiva-ibr-bvd-lepto',
    'vacinacao',
    'reprodutiva-ibr-bvd-lepto',
    'reprodutores_matrizes',
    'calendario',
    '{"anchor":"pre_breeding_season"}'::jsonb,
    '{"suggested_interval_days":365}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"produto":"Vacina Reprodutiva IBR BVD Leptospirose","label":"IBR/BVD/Leptospirose - recomendacao tecnica","tipo_evento_sanitario":"vacinacao","family_code":"leptospirose_ibr_bvd","dedup_strategy":"farm_activation_required","motivo_nao_gerar_agenda":"Recomendacao tecnica; nao marcar como obrigatoria sem fonte normativa explicita."}'::jsonb
  ),
  (
    'vermifugacao-estrategica',
    'parasitas',
    'vermifugacao-estrategica',
    null,
    'risco',
    '{"risk_field":"pressao_helmintos","risk_values":["medio","alto"],"requires_explicit_activation":true}'::jsonb,
    '{"suggested_interval_days":180}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"produto":"Endectocida generico","label":"Vermifugacao estrategica","tipo_evento_sanitario":"vermifugacao","family_code":"controle_parasitario","dedup_strategy":"farm_activation_required","motivo_nao_gerar_agenda":"Agenda depende de protocolo operacional ativo da fazenda."}'::jsonb
  ),
  (
    'controle-carrapato',
    'parasitas',
    'controle-carrapato',
    null,
    'risco',
    '{"risk_field":"pressao_carrapato","risk_values":["medio","alto"],"requires_explicit_activation":true}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"produto":"Ectoparasiticida carrapaticida","label":"Controle de carrapato","tipo_evento_sanitario":"medicamento","family_code":"controle_carrapato","dedup_strategy":"farm_activation_required","motivo_nao_gerar_agenda":"Agenda depende de protocolo operacional ativo e avaliacao tecnica da fazenda."}'::jsonb
  ),
  (
    'biosseguranca-operacional',
    'biosseguranca',
    'biosseguranca-checklist',
    null,
    'calendario',
    '{"subareas":["quarentena","agua_limpeza","higiene_operacional"]}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    '{}'::jsonb,
    false,
    '{"label":"Biosseguranca operacional - checklist","tipo_evento_sanitario":"conformidade","family_code":"biosseguranca_operacional","dedup_strategy":"checklist_context","bloqueia_movimentacao":true,"motivo_nao_gerar_agenda":"Checklist de boa pratica/compliance; nao gerar agenda animal automatica."}'::jsonb
  ),
  (
    'medicamentos-rastreabilidade',
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
    '{"label":"Registrar medicamento e rastreabilidade","tipo_evento_sanitario":"medicamento","family_code":"medicamentos_rastreabilidade","dedup_strategy":"event_product_animal","nao_define_dose":true,"nao_define_carencia_obrigatoria":true,"motivo_nao_gerar_agenda":"Uso terapeutico depende de avaliacao/manual; seed nao define dose, posologia ou carencia obrigatoria."}'::jsonb
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
    'raiva-herbivoros',
    'Raiva dos herbivoros',
    'bovinos,bubalinos',
    'imediata',
    '{"fonte":"premissa_projeto","sinais":["neurologicos","alteracao_comportamental","morte_subita"]}'::jsonb,
    '{"fonte":"premissa_projeto","acao":"isolar, bloquear movimentacao local e acionar orientacao oficial"}'::jsonb,
    '{"fonte":"premissa_projeto","programa":"PNCRH"}'::jsonb
  ),
  (
    'brucelose',
    'Brucelose',
    'bovinos,bubalinos',
    'conforme_orientacao_oficial',
    '{"fonte":"premissa_projeto","sinais":["abortamento","falha_reprodutiva"]}'::jsonb,
    '{"fonte":"premissa_projeto","acao":"registrar suspeita e buscar orientacao tecnica/oficial"}'::jsonb,
    '{"fonte":"premissa_projeto","programa":"PNCEBT"}'::jsonb
  ),
  (
    'tuberculose-bovina',
    'Tuberculose bovina',
    'bovinos,bubalinos',
    'conforme_orientacao_oficial',
    '{"fonte":"premissa_projeto","sinais":["emagrecimento","tosse_cronica"]}'::jsonb,
    '{"fonte":"premissa_projeto","acao":"registrar suspeita e buscar orientacao tecnica/oficial"}'::jsonb,
    '{"fonte":"premissa_projeto","programa":"PNCEBT"}'::jsonb
  ),
  (
    'sindrome-vesicular',
    'Sindrome vesicular / suspeita compativel com febre aftosa',
    'bovinos,bubalinos',
    'imediata',
    '{"fonte":"premissa_projeto","sinais":["vesiculas","salivacao","claudicacao","lesoes_orais"]}'::jsonb,
    '{"fonte":"premissa_projeto","acao":"abrir suspeita sanitaria, bloquear movimentacao e acionar orientacao oficial"}'::jsonb,
    '{"fonte":"premissa_projeto","programa":"PNEFA"}'::jsonb
  ),
  (
    'doenca-notificavel-generica',
    'Doenca notificavel - entrada generica IN MAPA 50/2013',
    'multiespecie',
    'conforme_orientacao_oficial',
    '{"fonte":"premissa_projeto","sinais":["sinais_clinicos_relevantes","mortalidade_incomum"]}'::jsonb,
    '{"fonte":"premissa_projeto","acao":"registrar suspeita e seguir fluxo oficial aplicavel"}'::jsonb,
    '{"fonte":"premissa_projeto","ato":"IN MAPA 50/2013"}'::jsonb
  )
on conflict (codigo) do update
set nome = excluded.nome,
    especie_alvo = excluded.especie_alvo,
    tipo_notificacao = excluded.tipo_notificacao,
    sinais_alerta_json = excluded.sinais_alerta_json,
    acao_imediata_json = excluded.acao_imediata_json,
    base_legal_json = excluded.base_legal_json,
    updated_at = now();
