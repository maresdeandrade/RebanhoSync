begin;

create table if not exists public.catalogo_protocolos_oficiais (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  nome text not null,
  versao int not null check (versao > 0),
  escopo text not null check (escopo in ('federal', 'estadual')),
  uf text null,
  aptidao text not null check (aptidao in ('corte', 'leite', 'misto', 'all')),
  sistema text not null check (sistema in ('extensivo', 'semi_intensivo', 'intensivo', 'all')),
  status_legal text not null check (status_legal in ('obrigatorio', 'recomendado', 'boa_pratica')),
  base_legal_json jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_catalogo_protocolos_oficiais_updated_at
before update on public.catalogo_protocolos_oficiais
for each row execute function public.set_updated_at();

create unique index if not exists ux_catalogo_protocolos_oficiais_federal
on public.catalogo_protocolos_oficiais(slug, escopo, versao)
where uf is null;

create unique index if not exists ux_catalogo_protocolos_oficiais_estadual
on public.catalogo_protocolos_oficiais(slug, escopo, uf, versao)
where uf is not null;

create table if not exists public.catalogo_protocolos_oficiais_itens (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.catalogo_protocolos_oficiais(id) on delete cascade,
  area text not null check (
    area in (
      'vacinacao',
      'parasitas',
      'medicamentos',
      'biosseguranca',
      'nutricao',
      'sustentabilidade',
      'notificacao'
    )
  ),
  codigo text not null,
  categoria_animal text null,
  gatilho_tipo text not null check (
    gatilho_tipo in ('idade', 'sexo', 'entrada', 'movimento', 'calendario', 'risco', 'uso_produto')
  ),
  gatilho_json jsonb not null default '{}'::jsonb,
  frequencia_json jsonb not null default '{}'::jsonb,
  requires_vet boolean not null default false,
  requires_gta boolean not null default false,
  carencia_regra_json jsonb not null default '{}'::jsonb,
  gera_agenda boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_catalogo_protocolos_oficiais_itens_updated_at
before update on public.catalogo_protocolos_oficiais_itens
for each row execute function public.set_updated_at();

create unique index if not exists ux_catalogo_protocolos_oficiais_itens_template_codigo
on public.catalogo_protocolos_oficiais_itens(template_id, codigo);

create table if not exists public.catalogo_doencas_notificaveis (
  codigo text primary key,
  nome text not null,
  especie_alvo text null,
  tipo_notificacao text not null,
  sinais_alerta_json jsonb not null default '{}'::jsonb,
  acao_imediata_json jsonb not null default '{}'::jsonb,
  base_legal_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_catalogo_doencas_notificaveis_updated_at
before update on public.catalogo_doencas_notificaveis
for each row execute function public.set_updated_at();

create table if not exists public.fazenda_sanidade_config (
  fazenda_id uuid primary key references public.fazendas(id) on delete cascade,
  uf text null,
  aptidao text not null check (aptidao in ('corte', 'leite', 'misto', 'all')),
  sistema text not null check (sistema in ('extensivo', 'semi_intensivo', 'intensivo', 'all')),
  zona_raiva_risco text not null check (zona_raiva_risco in ('baixo', 'medio', 'alto')) default 'baixo',
  pressao_carrapato text not null check (pressao_carrapato in ('baixo', 'medio', 'alto')) default 'baixo',
  pressao_helmintos text not null check (pressao_helmintos in ('baixo', 'medio', 'alto')) default 'baixo',
  modo_calendario text not null check (modo_calendario in ('minimo_legal', 'tecnico_recomendado', 'completo')) default 'minimo_legal',
  payload jsonb not null default '{}'::jsonb,

  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_fazenda_sanidade_config_updated_at
before update on public.fazenda_sanidade_config
for each row execute function public.set_updated_at();

alter table public.catalogo_protocolos_oficiais enable row level security;
alter table public.catalogo_protocolos_oficiais_itens enable row level security;
alter table public.catalogo_doencas_notificaveis enable row level security;
alter table public.fazenda_sanidade_config enable row level security;

drop policy if exists catalogo_protocolos_oficiais_select on public.catalogo_protocolos_oficiais;
create policy catalogo_protocolos_oficiais_select
on public.catalogo_protocolos_oficiais
for select
to authenticated
using (true);

drop policy if exists catalogo_protocolos_oficiais_itens_select on public.catalogo_protocolos_oficiais_itens;
create policy catalogo_protocolos_oficiais_itens_select
on public.catalogo_protocolos_oficiais_itens
for select
to authenticated
using (true);

drop policy if exists catalogo_doencas_notificaveis_select on public.catalogo_doencas_notificaveis;
create policy catalogo_doencas_notificaveis_select
on public.catalogo_doencas_notificaveis
for select
to authenticated
using (true);

drop policy if exists fazenda_sanidade_config_select on public.fazenda_sanidade_config;
drop policy if exists fazenda_sanidade_config_write on public.fazenda_sanidade_config;

create policy fazenda_sanidade_config_select
on public.fazenda_sanidade_config
for select
using (public.has_membership(fazenda_id));

create policy fazenda_sanidade_config_write
on public.fazenda_sanidade_config
for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner', 'manager')
);

insert into public.catalogo_protocolos_oficiais (
  slug,
  nome,
  versao,
  escopo,
  uf,
  aptidao,
  sistema,
  status_legal,
  base_legal_json,
  payload
)
select
  seed.slug,
  seed.nome,
  seed.versao,
  seed.escopo,
  seed.uf,
  seed.aptidao,
  seed.sistema,
  seed.status_legal,
  seed.base_legal_json,
  seed.payload
from (
  values
    (
      'brucelose-pncebt',
      'Brucelose - vacinacao obrigatoria de bezerras',
      1,
      'federal',
      null,
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'programa', 'PNCEBT',
        'referencias', jsonb_build_array('PNCEBT', 'Vacinacao de femeas entre 3 e 8 meses com B19; RB51 para regularizacao conforme regramento aplicavel')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'descricao_operacional', 'Obrigacao federal dura para bezerras, com documentacao e responsabilidade tecnica habilitada.'
      )
    ),
    (
      'raiva-herbivoros-risco',
      'Raiva dos herbivoros - manejo por risco',
      1,
      'federal',
      null,
      'all',
      'all',
      'recomendado',
      jsonb_build_object(
        'programa', 'PNCRH',
        'referencias', jsonb_build_array('Vacina recomendada em areas de risco, reforco apos 30 dias e revacinacao anual')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'descricao_operacional', 'Aplicar apenas quando a configuracao da fazenda indicar risco para raiva.'
      )
    ),
    (
      'transito-gta-precheck',
      'Transito animal - GTA e pre-check documental',
      1,
      'federal',
      null,
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'base', 'Transito animal com GTA/e-GTA',
        'referencias', jsonb_build_array('Obrigacao administrativa vinculada a movimentacao, venda, reproducao, eventos e abate')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'suspeita-notificacao-imediata',
      'Suspeita sanitaria - notificacao imediata',
      1,
      'federal',
      null,
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'base', 'IN MAPA 50/2013',
        'referencias', jsonb_build_array('Notificacao obrigatoria ao SVO e uso do e-Sisbravet quando aplicavel')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'medicamentos-carencia-rastreabilidade',
      'Medicamentos - carencia e rastreabilidade',
      1,
      'federal',
      null,
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'base', 'Decreto 5.053/2004',
        'referencias', jsonb_build_array('Registrar produto, lote, via, responsavel e periodo de carencia')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'feed-ban-ruminantes',
      'Conformidade alimentar de ruminantes',
      1,
      'federal',
      null,
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'base', 'IN MAPA 8/2004',
        'referencias', jsonb_build_array('Proibicao de uso de proteinas e gorduras de origem animal em alimentacao de ruminantes')
      ),
      jsonb_build_object(
        'animal_centric', false,
        'pack', 'brasil_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'parasitas-estrategico',
      'Controle parasitario estrategico',
      1,
      'federal',
      null,
      'all',
      'all',
      'recomendado',
      jsonb_build_object(
        'base', 'Recomendacao tecnica por risco e resistencia',
        'referencias', jsonb_build_array('Nao hardcodar calendario universal; priorizar pressao parasitaria, categoria e falha clinica')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'descricao_operacional', 'Calendario tecnico configuravel por risco de helmintos e carrapatos.'
      )
    ),
    (
      'quarentena-entrada',
      'Quarentena e segregacao de entrada',
      1,
      'federal',
      null,
      'all',
      'all',
      'boa_pratica',
      jsonb_build_object(
        'base', 'Biosseguranca de entrada',
        'referencias', jsonb_build_array('Animais sem status sanitario conhecido devem entrar em separacao/quarentena')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'brasil_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'agua-limpeza-checklist',
      'Agua, limpeza e higiene operacional',
      1,
      'federal',
      null,
      'all',
      'all',
      'boa_pratica',
      jsonb_build_object(
        'base', 'BPA - manejo sanitario',
        'referencias', jsonb_build_array('Qualidade de agua, limpeza de curral, cochos, bebedouros e equipamentos')
      ),
      jsonb_build_object(
        'animal_centric', false,
        'pack', 'brasil_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'sp-atualizacao-rebanho',
      'Sao Paulo - atualizacao de rebanho',
      1,
      'estadual',
      'SP',
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'base', 'Overlay estadual SP',
        'referencias', jsonb_build_array('Atualizacao cadastral/rebanho em duas etapas anuais')
      ),
      jsonb_build_object(
        'animal_centric', false,
        'pack', 'sp_overlay_v1',
        'execution_mode', 'checklist'
      )
    ),
    (
      'go-brucelose-comprovacao',
      'Goias - comprovacao semestral de brucelose',
      1,
      'estadual',
      'GO',
      'all',
      'all',
      'obrigatorio',
      jsonb_build_object(
        'base', 'Overlay estadual GO',
        'referencias', jsonb_build_array('Comprovacao semestral de vacinacao de brucelose conforme regra operacional local')
      ),
      jsonb_build_object(
        'animal_centric', true,
        'pack', 'go_overlay_v1',
        'execution_mode', 'checklist'
      )
    )
) as seed(
  slug,
  nome,
  versao,
  escopo,
  uf,
  aptidao,
  sistema,
  status_legal,
  base_legal_json,
  payload
)
where not exists (
  select 1
  from public.catalogo_protocolos_oficiais existing
  where existing.slug = seed.slug
    and existing.escopo = seed.escopo
    and existing.versao = seed.versao
    and coalesce(existing.uf, '') = coalesce(seed.uf, '')
);

insert into public.catalogo_protocolos_oficiais_itens (
  template_id,
  area,
  codigo,
  categoria_animal,
  gatilho_tipo,
  gatilho_json,
  frequencia_json,
  requires_vet,
  requires_gta,
  carencia_regra_json,
  gera_agenda,
  payload
)
select
  template_id,
  area,
  codigo,
  categoria_animal,
  gatilho_tipo,
  gatilho_json,
  frequencia_json,
  requires_vet,
  requires_gta,
  carencia_regra_json,
  gera_agenda,
  payload
from (
  values
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'brucelose-pncebt' and escopo = 'federal' and uf is null and versao = 1),
      'vacinacao',
      'brucelose-b19',
      'bezerra',
      'idade',
      jsonb_build_object('sexo_alvo', 'F', 'age_start_days', 90, 'age_end_days', 240),
      jsonb_build_object('dose_num', 1),
      true,
      false,
      '{}'::jsonb,
      true,
      jsonb_build_object(
        'produto', 'Vacina Brucelose B19',
        'label', 'Brucelose B19 - janela 3 a 8 meses',
        'indicacao', 'Obrigacao federal para bezerras entre 3 e 8 meses.',
        'dedup_template', 'brucelose:{animal_id}:b19',
        'notes', 'Aplicacao por medico-veterinario ou vacinador habilitado, com prova vacinal.'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'brucelose-pncebt' and escopo = 'federal' and uf is null and versao = 1),
      'vacinacao',
      'brucelose-rb51-regularizacao',
      'novilha',
      'risco',
      jsonb_build_object('risk_field', 'zona_raiva_risco', 'risk_values', jsonb_build_array('baixo', 'medio', 'alto')),
      jsonb_build_object('dose_num', 1),
      true,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'produto', 'Vacina Brucelose RB51',
        'label', 'RB51 para regularizacao conforme regra aplicavel',
        'indicacao', 'Fluxo de regularizacao de bezerras fora da janela original, quando permitido.',
        'notes', 'Manter desativado por padrao; aplicar conforme PNCEBT e overlay local.'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'raiva-herbivoros-risco' and escopo = 'federal' and uf is null and versao = 1),
      'vacinacao',
      'raiva-d1',
      'bezerro',
      'risco',
      jsonb_build_object('risk_field', 'zona_raiva_risco', 'risk_values', jsonb_build_array('medio', 'alto'), 'age_start_days', 90),
      jsonb_build_object('dose_num', 1, 'interval_days', 30),
      false,
      false,
      '{}'::jsonb,
      true,
      jsonb_build_object(
        'produto', 'Vacina Antirrabica',
        'label', 'Raiva - dose inicial em area de risco',
        'indicacao', 'Aplicar a partir de 3 meses em fazendas com risco configurado.',
        'dedup_template', 'raiva:{animal_id}:d1'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'raiva-herbivoros-risco' and escopo = 'federal' and uf is null and versao = 1),
      'vacinacao',
      'raiva-reforco-30d',
      'bezerro',
      'risco',
      jsonb_build_object('risk_field', 'zona_raiva_risco', 'risk_values', jsonb_build_array('medio', 'alto'), 'age_start_days', 90),
      jsonb_build_object('dose_num', 2, 'interval_days', 30),
      false,
      false,
      '{}'::jsonb,
      true,
      jsonb_build_object(
        'produto', 'Vacina Antirrabica',
        'label', 'Raiva - reforco apos 30 dias',
        'indicacao', 'Primovacinacao em area de risco requer reforco 30 dias apos a primeira dose.',
        'dedup_template', 'raiva:{animal_id}:d2'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'raiva-herbivoros-risco' and escopo = 'federal' and uf is null and versao = 1),
      'vacinacao',
      'raiva-anual',
      'adulto',
      'risco',
      jsonb_build_object('risk_field', 'zona_raiva_risco', 'risk_values', jsonb_build_array('medio', 'alto')),
      jsonb_build_object('dose_num', 3, 'interval_days', 365),
      false,
      false,
      '{}'::jsonb,
      true,
      jsonb_build_object(
        'produto', 'Vacina Antirrabica',
        'label', 'Raiva - revacinacao anual',
        'indicacao', 'Revisao anual em propriedades com risco configurado para raiva.',
        'dedup_template', 'raiva:{animal_id}:anual'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'transito-gta-precheck' and escopo = 'federal' and uf is null and versao = 1),
      'biosseguranca',
      'gta-precheck',
      'all',
      'movimento',
      jsonb_build_object('finalidades', jsonb_build_array('movimentacao', 'venda', 'reproducao', 'evento', 'abate')),
      '{}'::jsonb,
      false,
      true,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Checklist de GTA/e-GTA',
        'indicacao', 'Validar GTA/e-GTA antes de liberar transito do animal.',
        'subarea', 'gta'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'transito-gta-precheck' and escopo = 'federal' and uf is null and versao = 1),
      'biosseguranca',
      'pncebt-repro-interestadual',
      'novilha',
      'movimento',
      jsonb_build_object('finalidade', 'reproducao_interestadual'),
      '{}'::jsonb,
      true,
      true,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Atestados negativos para reproducao interestadual',
        'indicacao', 'Solicitar atestados negativos de brucelose/tuberculose com validade de 60 dias.',
        'subarea', 'pncebt_documental'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'suspeita-notificacao-imediata' and escopo = 'federal' and uf is null and versao = 1),
      'notificacao',
      'suspeita-imediata',
      'all',
      'risco',
      jsonb_build_object('trigger_event', 'suspeita_sanitaria'),
      '{}'::jsonb,
      false,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Fluxo imediato de suspeita sanitaria',
        'indicacao', 'Acionar SVO/e-Sisbravet em suspeitas, sinais desconhecidos ou mortalidade alta/incomum.',
        'subarea', 'notificacao'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'medicamentos-carencia-rastreabilidade' and escopo = 'federal' and uf is null and versao = 1),
      'medicamentos',
      'carencia-rastreabilidade',
      'all',
      'uso_produto',
      jsonb_build_object('product_use', 'medicamento_ou_vacina'),
      '{}'::jsonb,
      false,
      false,
      jsonb_build_object('auto_badge', true, 'campos_obrigatorios', jsonb_build_array('produto', 'lote', 'via', 'responsavel', 'carencia')),
      false,
      jsonb_build_object(
        'produto', 'Registro de produto veterinario',
        'label', 'Carencia e rastreabilidade obrigatorias',
        'indicacao', 'Registrar lote, data, responsavel, via e carencia em todo uso de produto veterinario.',
        'subarea', 'carencia'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'feed-ban-ruminantes' and escopo = 'federal' and uf is null and versao = 1),
      'nutricao',
      'feed-ban',
      'all',
      'uso_produto',
      jsonb_build_object('target', 'ruminantes'),
      '{}'::jsonb,
      false,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Feed-ban de ruminantes',
        'indicacao', 'Bloquear formulacoes com proteina/gordura animal proibida para ruminantes.',
        'subarea', 'feed_ban'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'parasitas-estrategico' and escopo = 'federal' and uf is null and versao = 1),
      'parasitas',
      'helmintos-estrategico',
      'all',
      'risco',
      jsonb_build_object('risk_field', 'pressao_helmintos', 'risk_values', jsonb_build_array('medio', 'alto')),
      jsonb_build_object('interval_days', 120, 'dose_num', 1),
      false,
      false,
      '{}'::jsonb,
      true,
      jsonb_build_object(
        'produto', 'Vermifugo estrategico',
        'label', 'Controle estrategico de helmintos',
        'indicacao', 'Planejar controle por estacao, categoria e falha clinica; evitar calendario cego.',
        'subarea', 'helmintos',
        'alert_same_base', true
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'parasitas-estrategico' and escopo = 'federal' and uf is null and versao = 1),
      'parasitas',
      'carrapato-resistencia',
      'all',
      'risco',
      jsonb_build_object('risk_field', 'pressao_carrapato', 'risk_values', jsonb_build_array('medio', 'alto')),
      jsonb_build_object('interval_days', 90, 'dose_num', 1),
      false,
      false,
      '{}'::jsonb,
      true,
      jsonb_build_object(
        'produto', 'Controle estrategico de carrapato',
        'label', 'Controle estrategico de carrapato',
        'indicacao', 'Registrar principio ativo e sinalizar falha clinica para sugerir biocarrapaticidograma.',
        'subarea', 'carrapato',
        'alert_same_base', true
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'quarentena-entrada' and escopo = 'federal' and uf is null and versao = 1),
      'biosseguranca',
      'quarentena-entrada',
      'all',
      'entrada',
      jsonb_build_object('requires_unknown_status', true),
      '{}'::jsonb,
      false,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Quarentena/separacao de entrada',
        'indicacao', 'Animais com status sanitario desconhecido entram em segregacao antes de integrar o lote.',
        'subarea', 'quarentena'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'agua-limpeza-checklist' and escopo = 'federal' and uf is null and versao = 1),
      'biosseguranca',
      'agua-equipamentos',
      'all',
      'calendario',
      jsonb_build_object('months', jsonb_build_array(1,2,3,4,5,6,7,8,9,10,11,12)),
      jsonb_build_object('interval_days', 30),
      false,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Checklist de agua, cochos, bebedouros e equipamentos',
        'indicacao', 'Executar rotina de limpeza e verificacao operacional.',
        'subarea', 'agua_limpeza'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'sp-atualizacao-rebanho' and escopo = 'estadual' and uf = 'SP' and versao = 1),
      'biosseguranca',
      'sp-atualizacao-maio',
      'all',
      'calendario',
      jsonb_build_object('months', jsonb_build_array(5)),
      '{}'::jsonb,
      false,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Atualizacao de rebanho - etapa 1',
        'indicacao', 'Cumprir a etapa anual de atualizacao de rebanho em Sao Paulo.',
        'subarea', 'atualizacao_rebanho'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'sp-atualizacao-rebanho' and escopo = 'estadual' and uf = 'SP' and versao = 1),
      'biosseguranca',
      'sp-atualizacao-novembro',
      'all',
      'calendario',
      jsonb_build_object('months', jsonb_build_array(11)),
      '{}'::jsonb,
      false,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Atualizacao de rebanho - etapa 2',
        'indicacao', 'Cumprir a segunda etapa anual de atualizacao de rebanho em Sao Paulo.',
        'subarea', 'atualizacao_rebanho'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'go-brucelose-comprovacao' and escopo = 'estadual' and uf = 'GO' and versao = 1),
      'biosseguranca',
      'go-comprovacao-junho',
      'bezerra',
      'calendario',
      jsonb_build_object('months', jsonb_build_array(6)),
      '{}'::jsonb,
      true,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Comprovacao semestral de brucelose - 1o semestre',
        'indicacao', 'Registrar comprovacao semestral da vacinacao de brucelose conforme regra operacional local.',
        'subarea', 'comprovacao_brucelose'
      )
    ),
    (
      (select id from public.catalogo_protocolos_oficiais where slug = 'go-brucelose-comprovacao' and escopo = 'estadual' and uf = 'GO' and versao = 1),
      'biosseguranca',
      'go-comprovacao-dezembro',
      'bezerra',
      'calendario',
      jsonb_build_object('months', jsonb_build_array(12)),
      '{}'::jsonb,
      true,
      false,
      '{}'::jsonb,
      false,
      jsonb_build_object(
        'label', 'Comprovacao semestral de brucelose - 2o semestre',
        'indicacao', 'Registrar comprovacao semestral da vacinacao de brucelose conforme regra operacional local.',
        'subarea', 'comprovacao_brucelose'
      )
    )
) as seed(
  template_id,
  area,
  codigo,
  categoria_animal,
  gatilho_tipo,
  gatilho_json,
  frequencia_json,
  requires_vet,
  requires_gta,
  carencia_regra_json,
  gera_agenda,
  payload
)
where template_id is not null
  and not exists (
    select 1
    from public.catalogo_protocolos_oficiais_itens existing
    where existing.template_id = seed.template_id
      and existing.codigo = seed.codigo
  );

insert into public.catalogo_doencas_notificaveis (
  codigo,
  nome,
  especie_alvo,
  tipo_notificacao,
  sinais_alerta_json,
  acao_imediata_json,
  base_legal_json
)
select
  codigo,
  nome,
  especie_alvo,
  tipo_notificacao,
  sinais_alerta_json,
  acao_imediata_json,
  base_legal_json
from (
  values
    (
      'notif-generica',
      'Suspeita sanitaria de notificacao obrigatoria',
      'bovinos_e_bubalinos',
      'imediata',
      jsonb_build_object(
        'sinais', jsonb_build_array('sinais de causa desconhecida', 'mortalidade alta ou inesperada', 'sindrome neurologica', 'hemorragia anormal')
      ),
      jsonb_build_object(
        'passos', jsonb_build_array('Segregar animal/lote', 'Suspender movimentacao', 'Acionar SVO', 'Abrir rota e-Sisbravet')
      ),
      jsonb_build_object(
        'base', 'IN MAPA 50/2013'
      )
    ),
    (
      'raiva-herbivoros',
      'Raiva dos herbivoros - suspeita',
      'herbivoros',
      'imediata',
      jsonb_build_object(
        'sinais', jsonb_build_array('alteracao neurologica', 'andar cambaleante', 'paralisia', 'morte repentina')
      ),
      jsonb_build_object(
        'passos', jsonb_build_array('Isolar suspeitos', 'Evitar manipulacao sem EPI', 'Acionar SVO', 'Registrar rota local de notificacao')
      ),
      jsonb_build_object(
        'base', 'Programa de Raiva dos Herbivoros'
      )
    ),
    (
      'aftosa-suspeita',
      'Febre aftosa - suspeita de reintroducao',
      'bovinos',
      'imediata',
      jsonb_build_object(
        'sinais', jsonb_build_array('vesiculas', 'salivacao intensa', 'claudicacao', 'lesoes em boca/cascos')
      ),
      jsonb_build_object(
        'passos', jsonb_build_array('Suspender movimentacao', 'Acionar SVO imediatamente', 'Preservar evidencias e lotes expostos')
      ),
      jsonb_build_object(
        'base', 'Pais livre de aftosa sem vacinacao - vigilancia e prevencao de reintroducao'
      )
    )
) as seed(
  codigo,
  nome,
  especie_alvo,
  tipo_notificacao,
  sinais_alerta_json,
  acao_imediata_json,
  base_legal_json
)
where not exists (
  select 1
  from public.catalogo_doencas_notificaveis existing
  where existing.codigo = seed.codigo
);

commit;
