-- RebanhoSync development baseline/squash.
-- Canonical base schema for offline-first operation, RBAC/RLS and sanitary domain.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_business_update()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['updated_at','deleted_at','server_received_at']::text[])
       <> (to_jsonb(old) - array['updated_at','deleted_at','server_received_at']::text[]) then
      raise exception 'append-only event rows cannot be business-updated'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_event_occurred_on()
returns trigger
language plpgsql
as $$
begin
  new.occurred_on = (new.occurred_at at time zone 'America/Sao_Paulo')::date;
  return new;
end;
$$;

do $$ begin create type public.farm_role_enum as enum ('cowboy','manager','owner'); exception when duplicate_object then null; end $$;
do $$ begin create type public.farm_invite_status_enum as enum ('pending','accepted','rejected','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.theme_enum as enum ('system','light','dark'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sexo_enum as enum ('M','F'); exception when duplicate_object then null; end $$;
do $$ begin create type public.animal_status_enum as enum ('ativo','vendido','morto'); exception when duplicate_object then null; end $$;
do $$ begin create type public.lote_status_enum as enum ('ativo','inativo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.papel_macho_enum as enum ('reprodutor','rufiao'); exception when duplicate_object then null; end $$;
do $$ begin create type public.origem_enum as enum ('nascimento','compra','doacao','arrendamento','sociedade'); exception when duplicate_object then null; end $$;
do $$ begin create type public.contraparte_tipo_enum as enum ('pessoa','empresa'); exception when duplicate_object then null; end $$;
do $$ begin create type public.estado_uf_enum as enum ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_producao_enum as enum ('corte','leite','mista'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sistema_manejo_enum as enum ('confinamento','semi_confinamento','pastagem'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_pasto_enum as enum ('nativo','cultivado','integracao','degradado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.dominio_enum as enum ('sanitario','pesagem','nutricao','movimentacao','reproducao','financeiro','alerta_sanitario','conformidade','obito'); exception when duplicate_object then null; end $$;
do $$ begin create type public.agenda_status_enum as enum ('agendado','concluido','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.agenda_source_kind_enum as enum ('manual','automatico'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_tipo_enum as enum ('vacinacao','vermifugacao','medicamento'); exception when duplicate_object then null; end $$;
do $$ begin create type public.repro_tipo_enum as enum ('cobertura','IA','diagnostico','parto','aborto'); exception when duplicate_object then null; end $$;
do $$ begin create type public.financeiro_tipo_enum as enum ('compra','venda'); exception when duplicate_object then null; end $$;
do $$ begin create type public.causa_obito_enum as enum ('doenca','acidente','predador','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.destino_produtivo_animal_enum as enum ('reprodutor','rufiao','engorda','abate','venda','descarte'); exception when duplicate_object then null; end $$;
do $$ begin create type public.categoria_zootecnica_canonica_enum as enum ('bezerra','novilha','vaca','bezerro','garrote','boi_terminacao','touro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.fase_veterinaria_enum as enum ('neonatal','pre_desmama','pos_desmama','pre_pubere','pubere','gestante','puerperio'); exception when duplicate_object then null; end $$;
do $$ begin create type public.estado_produtivo_reprodutivo_enum as enum ('vazia','prenhe','pre_parto_imediato','seca','recem_parida','lactacao','inteiro','castrado','reprodutor','terminacao'); exception when duplicate_object then null; end $$;
do $$ begin create type public.animal_life_stage_enum as enum ('cria_neonatal','cria_aleitamento','desmamado','recria','garrote','novilha','vaca_adulta','touro','boi_adulto','terminacao'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_reprodutivo_macho_enum as enum ('candidato','apto','suspenso','inativo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.modo_transicao_estagio_enum as enum ('automatico','manual','hibrido'); exception when duplicate_object then null; end $$;

create table public.fazendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  municipio text,
  timezone text not null default 'America/Sao_Paulo',
  metadata jsonb not null default '{}'::jsonb,
  estado public.estado_uf_enum,
  cep text,
  area_total_ha numeric(12,2) check (area_total_ha is null or area_total_ha > 0),
  tipo_producao public.tipo_producao_enum,
  sistema_manejo public.sistema_manejo_enum,
  benfeitorias jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  can_create_farm boolean not null default true,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme public.theme_enum not null default 'system',
  date_format text not null default 'dd/MM/yyyy',
  number_format text not null default 'pt-BR',
  notifications jsonb not null default '{"enabled":true,"agenda_reminders":true,"days_before":[1,7],"quiet_hours":null}'::jsonb,
  sync_prefs jsonb not null default '{"wifi_only":false,"background_sync":true,"max_batch_size":100}'::jsonb,
  active_fazenda_id uuid references public.fazendas(id) on delete set null,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_fazendas (
  user_id uuid not null references auth.users(id) on delete cascade,
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  role public.farm_role_enum not null default 'cowboy',
  is_primary boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, fazenda_id)
);

create unique index ux_user_fazendas_primary_active
on public.user_fazendas(user_id)
where is_primary and deleted_at is null;

create table public.farm_invites (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  email text,
  phone text,
  role public.farm_role_enum not null default 'cowboy',
  status public.farm_invite_status_enum not null default 'pending',
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ck_farm_invite_contact check (email is not null or phone is not null)
);

create or replace function public.has_membership(_fazenda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_fazendas uf
    where uf.fazenda_id = _fazenda_id
      and uf.user_id = auth.uid()
      and uf.deleted_at is null
  );
$$;

create or replace function public.role_in_fazenda(_fazenda_id uuid, _roles public.farm_role_enum[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_fazendas uf
    where uf.fazenda_id = _fazenda_id
      and uf.user_id = auth.uid()
      and uf.deleted_at is null
      and uf.role = any(_roles)
  );
$$;

create or replace function public.has_farm_role(_fazenda_id uuid, _roles public.farm_role_enum[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.role_in_fazenda(_fazenda_id, _roles); $$;

create table public.pastos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  nome text not null,
  area_ha numeric(12,2) check (area_ha is null or area_ha >= 0),
  capacidade_ua numeric(12,2) check (capacidade_ua is null or capacidade_ua >= 0),
  tipo_pasto public.tipo_pasto_enum not null default 'cultivado',
  infraestrutura jsonb not null default '{}'::jsonb,
  observacoes text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id)
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  nome text not null,
  status public.lote_status_enum not null default 'ativo',
  pasto_id uuid,
  touro_id uuid,
  observacoes text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint fk_lotes_pastos_fazenda foreign key (pasto_id, fazenda_id) references public.pastos(id, fazenda_id) on delete set null
);

create table public.animais (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  identificacao text not null,
  sexo public.sexo_enum not null,
  status public.animal_status_enum not null default 'ativo',
  lote_id uuid,
  data_nascimento date,
  data_entrada date,
  data_saida date,
  pai_id uuid,
  mae_id uuid,
  nome text,
  rfid text,
  especie text,
  origem public.origem_enum,
  raca text,
  papel_macho public.papel_macho_enum,
  habilitado_monta boolean not null default false,
  observacoes text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint chk_animais_especie check (especie is null or especie in ('bovino','bubalino')),
  constraint uq_animais_identificacao_active unique (fazenda_id, identificacao),
  constraint fk_animais_lotes_fazenda foreign key (lote_id, fazenda_id) references public.lotes(id, fazenda_id) on delete set null,
  constraint fk_animais_pai_fazenda foreign key (pai_id, fazenda_id) references public.animais(id, fazenda_id) on delete set null,
  constraint fk_animais_mae_fazenda foreign key (mae_id, fazenda_id) references public.animais(id, fazenda_id) on delete set null
);

alter table public.lotes
  add constraint fk_lotes_touro_fazenda foreign key (touro_id, fazenda_id) references public.animais(id, fazenda_id) on delete set null;

create table public.contrapartes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  tipo public.contraparte_tipo_enum not null default 'pessoa',
  nome text not null,
  documento text,
  telefone text,
  email text,
  endereco text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id)
);

create table public.animais_sociedade (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  animal_id uuid not null,
  contraparte_id uuid not null,
  percentual numeric(5,2) check (percentual is null or (percentual > 0 and percentual <= 100)),
  inicio date not null default current_date,
  fim date,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint fk_animais_sociedade_animal_fazenda foreign key (animal_id, fazenda_id) references public.animais(id, fazenda_id) on delete cascade,
  constraint fk_animais_sociedade_contraparte_fazenda foreign key (contraparte_id, fazenda_id) references public.contrapartes(id, fazenda_id) on delete cascade
);

create table public.categorias_zootecnicas (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  nome text not null,
  sexo public.sexo_enum,
  aplica_ambos boolean not null default false,
  idade_min_dias integer check (idade_min_dias is null or idade_min_dias >= 0),
  idade_max_dias integer check (idade_max_dias is null or idade_max_dias >= 0),
  ativa boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint ck_categorias_zootecnicas_idade_range check (idade_max_dias is null or idade_min_dias is null or idade_max_dias >= idade_min_dias)
);

create table public.produtos_veterinarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalogo_protocolos_oficiais (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  versao integer not null check (versao > 0),
  escopo text not null check (escopo in ('federal','estadual')),
  uf public.estado_uf_enum,
  aptidao text not null check (aptidao in ('corte','leite','misto','all')),
  sistema text not null check (sistema in ('extensivo','semi_intensivo','intensivo','all')),
  status_legal text not null check (status_legal in ('obrigatorio','recomendado','boa_pratica')),
  base_legal_json jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalogo_protocolos_oficiais_itens (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.catalogo_protocolos_oficiais(id) on delete cascade,
  area text not null check (area in ('vacinacao','parasitas','medicamentos','biosseguranca','nutricao','sustentabilidade','notificacao')),
  codigo text not null,
  categoria_animal text,
  gatilho_tipo text not null check (gatilho_tipo in ('idade','sexo','entrada','movimento','calendario','risco','uso_produto')),
  gatilho_json jsonb not null default '{}'::jsonb,
  frequencia_json jsonb not null default '{}'::jsonb,
  requires_vet boolean not null default false,
  requires_gta boolean not null default false,
  carencia_regra_json jsonb not null default '{}'::jsonb,
  gera_agenda boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, codigo)
);

create table public.catalogo_doencas_notificaveis (
  codigo text primary key,
  nome text not null,
  especie_alvo text,
  tipo_notificacao text not null,
  sinais_alerta_json jsonb not null default '{}'::jsonb,
  acao_imediata_json jsonb not null default '{}'::jsonb,
  base_legal_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fazenda_sanidade_config (
  fazenda_id uuid primary key references public.fazendas(id) on delete cascade,
  uf public.estado_uf_enum,
  aptidao text not null default 'all' check (aptidao in ('corte','leite','misto','all')),
  sistema text not null default 'all' check (sistema in ('extensivo','semi_intensivo','intensivo','all')),
  zona_raiva_risco text not null default 'baixo' check (zona_raiva_risco in ('baixo','medio','alto')),
  pressao_carrapato text not null default 'medio' check (pressao_carrapato in ('baixo','medio','alto')),
  pressao_helmintos text not null default 'medio' check (pressao_helmintos in ('baixo','medio','alto')),
  modo_calendario text not null default 'minimo_legal' check (modo_calendario in ('minimo_legal','tecnico_recomendado','completo')),
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.protocolos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id)
);

create table public.protocolos_sanitarios_itens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  protocolo_id uuid not null,
  protocol_item_id uuid not null default gen_random_uuid(),
  version integer not null default 1 check (version > 0),
  tipo public.sanitario_tipo_enum not null,
  produto text not null,
  intervalo_dias integer not null default 1 check (intervalo_dias > 0),
  dose_num integer check (dose_num is null or dose_num > 0),
  gera_agenda boolean not null default false,
  dedup_template text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  unique (fazenda_id, protocolo_id, protocol_item_id, version),
  constraint fk_protocolos_sanitarios_itens_protocolo_fazenda foreign key (protocolo_id, fazenda_id) references public.protocolos_sanitarios(id, fazenda_id) on delete cascade
);

create table public.agenda_itens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  dominio public.dominio_enum not null,
  tipo text not null,
  status public.agenda_status_enum not null default 'agendado',
  data_prevista date not null,
  animal_id uuid,
  lote_id uuid,
  dedup_key text,
  source_kind public.agenda_source_kind_enum not null default 'manual',
  source_ref jsonb,
  source_client_op_id uuid,
  source_tx_id uuid,
  source_evento_id uuid,
  protocol_item_version_id uuid,
  interval_days_applied integer check (interval_days_applied is null or interval_days_applied > 0),
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint ck_agenda_alvo check (animal_id is not null or lote_id is not null),
  constraint fk_agenda_animais_fazenda foreign key (animal_id, fazenda_id) references public.animais(id, fazenda_id) on delete cascade,
  constraint fk_agenda_lotes_fazenda foreign key (lote_id, fazenda_id) references public.lotes(id, fazenda_id) on delete cascade,
  constraint fk_agenda_protocol_item_fazenda foreign key (protocol_item_version_id, fazenda_id) references public.protocolos_sanitarios_itens(id, fazenda_id) on delete set null
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  dominio public.dominio_enum not null,
  occurred_at timestamptz not null,
  occurred_on date not null default current_date,
  animal_id uuid,
  lote_id uuid,
  source_task_id uuid,
  source_tx_id uuid,
  source_client_op_id uuid,
  corrige_evento_id uuid,
  observacoes text,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint fk_eventos_animais_fazenda foreign key (animal_id, fazenda_id) references public.animais(id, fazenda_id) on delete set null,
  constraint fk_eventos_lotes_fazenda foreign key (lote_id, fazenda_id) references public.lotes(id, fazenda_id) on delete set null,
  constraint fk_eventos_source_task_fazenda foreign key (source_task_id, fazenda_id) references public.agenda_itens(id, fazenda_id) on delete set null,
  constraint fk_eventos_corrige_fazenda foreign key (corrige_evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete set null
);

alter table public.agenda_itens
  add constraint fk_agenda_source_evento_fazenda foreign key (source_evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete set null;

create table public.eventos_sanitario (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.sanitario_tipo_enum not null,
  produto text not null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (evento_id, fazenda_id),
  constraint fk_eventos_sanitario_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete cascade
);

create table public.eventos_pesagem (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  peso_kg numeric(10,2) not null check (peso_kg > 0),
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (evento_id, fazenda_id),
  constraint fk_eventos_pesagem_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete cascade
);

create table public.eventos_nutricao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  alimento_nome text,
  quantidade_kg numeric(10,2),
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (evento_id, fazenda_id),
  constraint ck_evt_nutricao_quantidade_pos_nullable check (quantidade_kg is null or quantidade_kg > 0),
  constraint fk_eventos_nutricao_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete cascade
);

create table public.eventos_movimentacao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  from_lote_id uuid,
  to_lote_id uuid,
  from_pasto_id uuid,
  to_pasto_id uuid,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (evento_id, fazenda_id),
  constraint ck_evt_mov_destino_required check (to_lote_id is not null or to_pasto_id is not null),
  constraint ck_evt_mov_from_to_diff check ((from_lote_id is distinct from to_lote_id) or (from_pasto_id is distinct from to_pasto_id)),
  constraint fk_eventos_mov_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete cascade,
  constraint fk_eventos_mov_from_lote_fazenda foreign key (from_lote_id, fazenda_id) references public.lotes(id, fazenda_id) on delete set null,
  constraint fk_eventos_mov_to_lote_fazenda foreign key (to_lote_id, fazenda_id) references public.lotes(id, fazenda_id) on delete set null,
  constraint fk_eventos_mov_from_pasto_fazenda foreign key (from_pasto_id, fazenda_id) references public.pastos(id, fazenda_id) on delete set null,
  constraint fk_eventos_mov_to_pasto_fazenda foreign key (to_pasto_id, fazenda_id) references public.pastos(id, fazenda_id) on delete set null
);

create table public.eventos_reproducao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.repro_tipo_enum not null,
  macho_id uuid,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (evento_id, fazenda_id),
  constraint fk_eventos_reproducao_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete cascade,
  constraint fk_eventos_reproducao_macho_fazenda foreign key (macho_id, fazenda_id) references public.animais(id, fazenda_id) on delete set null
);

create table public.eventos_financeiro (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.financeiro_tipo_enum not null,
  valor_total numeric(14,2) not null,
  contraparte_id uuid,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (evento_id, fazenda_id),
  constraint ck_evt_fin_valor_total_pos check (valor_total > 0),
  constraint fk_eventos_financeiro_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id) on delete cascade,
  constraint fk_evt_fin_contraparte_fazenda foreign key (contraparte_id, fazenda_id) references public.contrapartes(id, fazenda_id) on delete set null
);

create table public.metrics_events (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  event_name text not null,
  status text not null default 'info' check (status in ('info','success','error')),
  route text,
  entity text,
  quantity integer,
  reason_code text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index ux_produtos_veterinarios_nome on public.produtos_veterinarios(lower(nome));
create unique index ux_agenda_dedup_active on public.agenda_itens(fazenda_id, dedup_key) where status = 'agendado' and deleted_at is null and dedup_key is not null;

create index idx_fazendas_deleted_at on public.fazendas(deleted_at);
create index idx_fazendas_client_op_id on public.fazendas(client_op_id);
create index idx_user_fazendas_fazenda_id on public.user_fazendas(fazenda_id);
create index idx_farm_invites_fazenda_id on public.farm_invites(fazenda_id);
create index idx_pastos_fazenda_deleted on public.pastos(fazenda_id, deleted_at);
create index idx_lotes_fazenda_pasto on public.lotes(fazenda_id, pasto_id);
create index idx_animais_fazenda_lote_status on public.animais(fazenda_id, lote_id, status);
create index idx_contrapartes_fazenda on public.contrapartes(fazenda_id, deleted_at);
create index idx_animais_sociedade_fazenda_animal on public.animais_sociedade(fazenda_id, animal_id);
create index idx_categorias_zootecnicas_fazenda on public.categorias_zootecnicas(fazenda_id, deleted_at);
create index idx_protocolos_sanitarios_fazenda on public.protocolos_sanitarios(fazenda_id, deleted_at);
create index idx_protocolos_sanitarios_itens_fazenda on public.protocolos_sanitarios_itens(fazenda_id, protocolo_id, deleted_at);
create index idx_agenda_fazenda_data_status on public.agenda_itens(fazenda_id, data_prevista, status);
create index idx_agenda_animal on public.agenda_itens(animal_id);
create index idx_agenda_lote on public.agenda_itens(lote_id);
create index idx_eventos_fazenda_dominio on public.eventos(fazenda_id, dominio);
create index idx_eventos_fazenda_occurred_at on public.eventos(fazenda_id, occurred_at desc);
create index idx_eventos_fazenda_occurred_on on public.eventos(fazenda_id, occurred_on desc);
create index idx_eventos_animal on public.eventos(animal_id);
create index idx_eventos_lote on public.eventos(lote_id);
create index idx_catalogo_protocolos_slug on public.catalogo_protocolos_oficiais(slug);
create index idx_catalogo_itens_codigo on public.catalogo_protocolos_oficiais_itens(codigo);
create index idx_catalogo_doencas_nome on public.catalogo_doencas_notificaveis(nome);
create index idx_metrics_events_fazenda_created on public.metrics_events(fazenda_id, created_at desc);

create or replace function public.render_sanitario_canonical_dedup_key(
  _scope_type text,
  _scope_id uuid,
  _family_code text,
  _item_code text,
  _regimen_version integer,
  _period_mode text,
  _period_key text,
  _jurisdiction text default null
)
returns text
language sql
immutable
as $$
  select concat_ws(':',
    'sanitario',
    lower(coalesce(_scope_type, 'animal')),
    _scope_id::text,
    lower(coalesce(nullif(_family_code, ''), 'unknown')),
    lower(coalesce(nullif(_item_code, ''), 'unknown')),
    'v' || greatest(coalesce(_regimen_version, 1), 1)::text,
    lower(coalesce(nullif(_period_mode, ''), 'unstructured')),
    coalesce(nullif(_period_key, ''), 'unknown'),
    nullif(upper(coalesce(_jurisdiction, '')), '')
  );
$$;

create or replace function public.sanitario_dedup_period_mode(_calendar_mode text)
returns text
language sql
immutable
as $$
  select case coalesce(_calendar_mode, 'legacy')
    when 'campaign' then 'campaign'
    when 'campanha' then 'campaign'
    when 'age_window' then 'window'
    when 'janela_etaria' then 'window'
    when 'rolling_interval' then 'interval'
    when 'rotina_recorrente' then 'interval'
    when 'immediate' then 'event'
    when 'clinical_protocol' then 'event'
    when 'procedimento_imediato' then 'event'
    else 'unstructured'
  end;
$$;

create or replace function public.render_dedup_key(
  _dedup_template text,
  _animal_id uuid,
  _protocolo_id uuid,
  _item_id uuid,
  _version integer,
  _data_prevista date
)
returns text
language sql
immutable
as $$
  -- Wrapper legado mantido por assinatura; ignora templates livres.
  select public.render_sanitario_canonical_dedup_key(
    'animal',
    _animal_id,
    coalesce(_protocolo_id::text, 'legacy'),
    coalesce(_item_id::text, 'legacy'),
    _version,
    'legacy',
    coalesce(_data_prevista::text, 'unknown'),
    null
  );
$$;

create or replace function public.sanitario_recompute_agenda_core(_fazenda_id uuid, _animal_id uuid default null, _as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not public.has_membership(_fazenda_id) then
    raise exception 'Forbidden';
  end if;

  with candidates as (
    select
      a.fazenda_id,
      a.id as animal_id,
      a.sexo,
      a.data_nascimento,
      ps.id as protocolo_id,
      psi.id as protocolo_item_id,
      psi.protocol_item_id as protocol_item_version_ref,
      psi.tipo,
      psi.version,
      psi.intervalo_dias,
      psi.payload,
      fsc.zona_raiva_risco,
      fsc.pressao_helmintos,
      fsc.pressao_carrapato,
      rule.family_code,
      rule.calendar_mode,
      rule.is_age_window,
      rule.sex_target,
      rule.age_min_days,
      rule.age_max_days,
      rule.has_explicit_agenda_activation,
      rule.rabies_risk_allowed,
      rule.helminth_risk_allowed,
      rule.tick_risk_allowed
    from public.animais a
    left join public.fazenda_sanidade_config fsc
      on fsc.fazenda_id = a.fazenda_id
     and fsc.deleted_at is null
    join public.protocolos_sanitarios ps
      on ps.fazenda_id = a.fazenda_id
     and ps.ativo
     and ps.deleted_at is null
    join public.protocolos_sanitarios_itens psi
      on psi.fazenda_id = ps.fazenda_id
     and psi.protocolo_id = ps.id
     and psi.gera_agenda
     and psi.deleted_at is null
    cross join lateral (
      select
        nullif(coalesce(
          psi.payload->>'family_code',
          psi.payload #>> '{regime_sanitario,family_code}'
        ), '') as family_code,
        lower(nullif(coalesce(
          psi.payload #>> '{calendario_base,mode}',
          psi.payload->>'calendario_mode',
          psi.payload->>'calendar_mode',
          psi.payload->>'mode'
        ), '')) as calendar_mode,
        upper(nullif(coalesce(
          psi.payload->>'sexo_alvo',
          psi.payload #>> '{gatilho_json,sexo_alvo}',
          psi.payload->>'sex_target',
          psi.payload->>'sexTarget'
        ), '')) as sex_target,
        nullif(coalesce(
          psi.payload->>'idade_min_dias',
          psi.payload #>> '{gatilho_json,age_start_days}',
          psi.payload #>> '{calendario_base,age_start_days}',
          psi.payload->>'age_start_days',
          psi.payload->>'ageStartDays'
        ), '') as age_min_days_raw,
        nullif(coalesce(
          psi.payload->>'idade_max_dias',
          psi.payload #>> '{gatilho_json,age_end_days}',
          psi.payload #>> '{calendario_base,age_end_days}',
          psi.payload->>'age_end_days',
          psi.payload->>'ageEndDays'
        ), '') as age_max_days_raw,
        lower(nullif(coalesce(
          psi.payload #>> '{agenda_activation,explicit}',
          psi.payload #>> '{agenda_activation,requires_explicit_activation}',
          psi.payload #>> '{gatilho_json,requires_explicit_activation}',
          psi.payload->>'requires_explicit_activation',
          psi.payload->>'explicit_activation',
          psi.payload->>'ativacao_operacional_explicita'
        ), '')) as explicit_activation_raw,
        coalesce(
          psi.payload #> '{agenda_activation,risk_values}',
          psi.payload #> '{gatilho_json,risk_values}'
        ) as risk_values_json
    ) raw
    cross join lateral (
      select
        raw.family_code,
        raw.calendar_mode,
        coalesce(raw.calendar_mode, '') in ('age_window', 'janela_etaria') as is_age_window,
        raw.sex_target,
        case
          when raw.age_min_days_raw ~ '^[0-9]+$' then raw.age_min_days_raw::integer
          else null
        end as age_min_days,
        case
          when raw.age_max_days_raw ~ '^[0-9]+$' then raw.age_max_days_raw::integer
          else null
        end as age_max_days,
        coalesce(raw.explicit_activation_raw, '') in ('true', '1', 'sim', 'yes') as has_explicit_agenda_activation,
        case
          when jsonb_typeof(raw.risk_values_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.risk_values_json) as rv(value)
            where rv.value = fsc.zona_raiva_risco
          )
          else false
        end as rabies_risk_allowed,
        case
          when jsonb_typeof(raw.risk_values_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.risk_values_json) as rv(value)
            where rv.value = fsc.pressao_helmintos
          )
          else false
        end as helminth_risk_allowed,
        case
          when jsonb_typeof(raw.risk_values_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.risk_values_json) as rv(value)
            where rv.value = fsc.pressao_carrapato
          )
          else false
        end as tick_risk_allowed
    ) rule
    where a.fazenda_id = _fazenda_id
      and a.deleted_at is null
      and a.status = 'ativo'
      and (_animal_id is null or a.id = _animal_id)
  ),
  eligible as (
    select
      *,
      case
        when is_age_window then _as_of
        else greatest(_as_of, coalesce(data_nascimento, _as_of) + intervalo_dias)
      end as due_date,
      case
        when is_age_window and age_min_days is not null then (data_nascimento + age_min_days)::text
        else greatest(_as_of, coalesce(data_nascimento, _as_of) + intervalo_dias)::text
      end as dedup_period_key
    from candidates
    where (
        sex_target is null
        or sex_target not in ('F', 'FEMEA', 'FEMININO', 'FEMALE')
        or sexo = 'F'::public.sexo_enum
      )
      and (
        not is_age_window
        or (
          data_nascimento is not null
          and (age_min_days is null or (_as_of - data_nascimento) >= age_min_days)
          and (age_max_days is null or (_as_of - data_nascimento) <= age_max_days)
        )
      )
      and (
        coalesce(family_code, '') <> 'raiva_herbivoros'
        or (
          zona_raiva_risco is not null
          and has_explicit_agenda_activation
          and rabies_risk_allowed
        )
      )
      and (
        coalesce(family_code, '') not in (
          'clostridioses',
          'leptospirose_ibr_bvd',
          'controle_parasitario',
          'controle_carrapato'
        )
        or has_explicit_agenda_activation
      )
      and (
        coalesce(family_code, '') <> 'controle_parasitario'
        or (
          pressao_helmintos is not null
          and helminth_risk_allowed
        )
      )
      and (
        coalesce(family_code, '') <> 'controle_carrapato'
        or (
          pressao_carrapato is not null
          and tick_risk_allowed
        )
      )
  ),
  planned as (
    select
      *,
      public.render_sanitario_canonical_dedup_key(
        'animal',
        animal_id,
        coalesce(family_code, protocolo_id::text),
        coalesce(payload->>'official_item_code', protocol_item_version_ref::text),
        version,
        public.sanitario_dedup_period_mode(calendar_mode),
        dedup_period_key,
        null
      ) as candidate_dedup_key
    from eligible
  )
  insert into public.agenda_itens (
    fazenda_id, dominio, tipo, status, data_prevista, animal_id, dedup_key,
    source_kind, source_ref, protocol_item_version_id, interval_days_applied,
    payload, client_id, client_recorded_at, server_received_at
  )
  select
    fazenda_id,
    'sanitario'::public.dominio_enum,
    tipo::text,
    'agendado'::public.agenda_status_enum,
    due_date,
    animal_id,
    candidate_dedup_key,
    'automatico'::public.agenda_source_kind_enum,
    jsonb_build_object('protocolo_id', protocolo_id, 'protocol_item_id', protocolo_item_id),
    protocolo_item_id,
    intervalo_dias,
    payload,
    'server',
    now(),
    now()
  from planned p
  where not exists (
    select 1
    from public.agenda_itens ai
    where ai.fazenda_id = p.fazenda_id
      and ai.dedup_key = p.candidate_dedup_key
      and ai.status = 'concluido'
      and ai.deleted_at is null
      and ai.source_evento_id is not null
      and exists (
        select 1
        from public.eventos e
        join public.eventos_sanitario es
          on es.evento_id = e.id
         and es.fazenda_id = e.fazenda_id
        where e.id = ai.source_evento_id
          and e.fazenda_id = ai.fazenda_id
          and e.deleted_at is null
          and es.deleted_at is null
      )
  )
  and not exists (
    select 1
    from public.eventos e
    join public.eventos_sanitario es
      on es.evento_id = e.id
     and es.fazenda_id = e.fazenda_id
    where e.fazenda_id = p.fazenda_id
      and e.animal_id = p.animal_id
      and e.dominio = 'sanitario'
      and e.deleted_at is null
      and es.deleted_at is null
      and es.payload #>> '{sanitary_completion,sanitary_completion_key}' = p.candidate_dedup_key
  )
  on conflict (fazenda_id, dedup_key)
  where status = 'agendado' and deleted_at is null and dedup_key is not null
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.sanitario_recompute_agenda_for_animal(_animal_id uuid, _fazenda_id uuid, _as_of date default current_date)
returns integer
language sql
security definer
set search_path = public
as $$ select public.sanitario_recompute_agenda_core(_fazenda_id, _animal_id, _as_of); $$;

create or replace function public.sanitario_recompute_agenda_for_fazenda(_fazenda_id uuid, _as_of date default current_date)
returns integer
language sql
security definer
set search_path = public
as $$ select public.sanitario_recompute_agenda_core(_fazenda_id, null, _as_of); $$;

create or replace function public.sanitario_complete_agenda_with_event(
  _agenda_item_id uuid,
  _occurred_at timestamptz default now(),
  _tipo public.sanitario_tipo_enum default null,
  _produto text default null,
  _observacoes text default null,
  _sanitario_payload jsonb default '{}'::jsonb,
  _client_id text default 'server',
  _client_op_id uuid default gen_random_uuid(),
  _client_tx_id uuid default null,
  _client_recorded_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agenda public.agenda_itens%rowtype;
  v_evento_id uuid := gen_random_uuid();
  v_tipo public.sanitario_tipo_enum;
  v_produto text;
  v_protocol_item_version integer;
  v_calendar_mode text;
  v_period_mode text;
  v_window_start text;
  v_enriched_payload jsonb;
begin
  select * into v_agenda
  from public.agenda_itens
  where id = _agenda_item_id and dominio = 'sanitario' and deleted_at is null
  for update;

  if not found then
    raise exception 'Agenda sanitaria nao encontrada';
  end if;
  if not public.has_membership(v_agenda.fazenda_id) then
    raise exception 'Forbidden';
  end if;

  v_tipo := coalesce(_tipo, nullif(v_agenda.tipo, '')::public.sanitario_tipo_enum);
  v_produto := coalesce(nullif(_produto, ''), v_agenda.payload->>'produto', v_agenda.tipo);

  select psi.version into v_protocol_item_version
  from public.protocolos_sanitarios_itens psi
  where psi.id = v_agenda.protocol_item_version_id
    and psi.fazenda_id = v_agenda.fazenda_id
    and psi.deleted_at is null;

  v_calendar_mode := nullif(coalesce(
    v_agenda.payload #>> '{calendario_base,mode}',
    v_agenda.payload->>'calendario_mode',
    v_agenda.payload->>'calendar_mode',
    v_agenda.payload->>'mode'
  ), '');
  v_period_mode := coalesce(
    nullif(v_agenda.payload->>'period_mode', ''),
    case when v_calendar_mode is not null then public.sanitario_dedup_period_mode(v_calendar_mode) end
  );
  v_window_start := coalesce(
    nullif(v_agenda.payload->>'window_start', ''),
    case
      when v_period_mode = 'window'
       and v_agenda.dedup_key is not null
       and split_part(v_agenda.dedup_key, ':', 7) = 'window'
      then nullif(split_part(v_agenda.dedup_key, ':', 8), '')
    end
  );
  v_enriched_payload :=
    coalesce(_sanitario_payload, '{}'::jsonb) ||
    jsonb_build_object(
      'sanitary_completion',
      jsonb_build_object(
        'schema_version', 1,
        'sanitary_completion_key', v_agenda.dedup_key,
        'agenda_dedup_key', v_agenda.dedup_key,
        'subject_type', case when v_agenda.animal_id is not null then 'animal' end,
        'animal_id', v_agenda.animal_id,
        'family_code', coalesce(v_agenda.payload->>'family_code', v_agenda.payload #>> '{regime_sanitario,family_code}'),
        'official_item_code', v_agenda.payload->>'official_item_code',
        'protocol_item_version_id', v_agenda.protocol_item_version_id,
        'protocol_item_version', coalesce(
          v_protocol_item_version,
          case when nullif(v_agenda.payload->>'protocol_item_version', '') ~ '^[0-9]+$' then (v_agenda.payload->>'protocol_item_version')::integer end,
          case when nullif(v_agenda.payload->>'regimen_version', '') ~ '^[0-9]+$' then (v_agenda.payload->>'regimen_version')::integer end
        ),
        'period_mode', v_period_mode,
        'window_start', v_window_start,
        'source_agenda_item_id', v_agenda.id
      )
    );

  insert into public.eventos (
    id, fazenda_id, dominio, occurred_at, animal_id, lote_id, source_task_id,
    source_tx_id, source_client_op_id, observacoes, payload, client_id,
    client_op_id, client_tx_id, client_recorded_at, server_received_at
  ) values (
    v_evento_id, v_agenda.fazenda_id, 'sanitario', _occurred_at,
    v_agenda.animal_id, v_agenda.lote_id, v_agenda.id,
    _client_tx_id, _client_op_id, _observacoes,
    v_enriched_payload,
    _client_id, _client_op_id, _client_tx_id, _client_recorded_at, now()
  );

  insert into public.eventos_sanitario (
    evento_id, fazenda_id, tipo, produto, payload, client_id,
    client_op_id, client_tx_id, client_recorded_at, server_received_at
  ) values (
    v_evento_id, v_agenda.fazenda_id, v_tipo, v_produto,
    v_enriched_payload,
    _client_id, _client_op_id, _client_tx_id, _client_recorded_at, now()
  );

  update public.agenda_itens
  set status = 'concluido',
      source_evento_id = v_evento_id,
      updated_at = now()
  where id = v_agenda.id;

  perform public.sanitario_recompute_agenda_core(v_agenda.fazenda_id, v_agenda.animal_id, (_occurred_at at time zone 'America/Sao_Paulo')::date);
  return v_evento_id;
end;
$$;

create or replace function public.materialize_standard_sanitary_protocols(_fazenda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_membership(_fazenda_id) then
    raise exception 'Forbidden';
  end if;
  -- Standard library materialization remains app-driven in the current baseline.
  return;
end;
$$;

create or replace view public.vw_sanitario_pendencias
with (security_invoker = true)
as
select
  ai.id as agenda_item_id,
  ai.fazenda_id,
  ai.animal_id,
  a.identificacao as animal_identificacao,
  a.nome as animal_nome,
  ai.data_prevista,
  (current_date - ai.data_prevista) as dias_em_atraso,
  ai.tipo as agenda_tipo,
  psi.tipo as sanitario_tipo,
  coalesce(psi.produto, ai.payload->>'produto') as produto,
  ps.id as protocolo_id,
  ps.nome as protocolo_nome,
  coalesce(psi.dose_num, 0) as dose_num,
  psi.intervalo_dias
from public.agenda_itens ai
left join public.animais a on a.id = ai.animal_id and a.fazenda_id = ai.fazenda_id
left join public.protocolos_sanitarios_itens psi on psi.id = ai.protocol_item_version_id and psi.fazenda_id = ai.fazenda_id
left join public.protocolos_sanitarios ps on ps.id = psi.protocolo_id and ps.fazenda_id = psi.fazenda_id
where ai.dominio = 'sanitario'
  and ai.status = 'agendado'
  and ai.deleted_at is null
  and ai.data_prevista <= current_date;

create or replace view public.vw_sanitario_upcoming
with (security_invoker = true)
as
select
  ai.id as agenda_item_id,
  ai.fazenda_id,
  ai.animal_id,
  a.identificacao as animal_identificacao,
  a.nome as animal_nome,
  ai.data_prevista,
  (ai.data_prevista - current_date) as dias_para_vencimento,
  psi.tipo as sanitario_tipo,
  coalesce(psi.produto, ai.payload->>'produto') as produto,
  ps.id as protocolo_id,
  ps.nome as protocolo_nome,
  coalesce(psi.dose_num, 0) as dose_num
from public.agenda_itens ai
left join public.animais a on a.id = ai.animal_id and a.fazenda_id = ai.fazenda_id
left join public.protocolos_sanitarios_itens psi on psi.id = ai.protocol_item_version_id and psi.fazenda_id = ai.fazenda_id
left join public.protocolos_sanitarios ps on ps.id = psi.protocolo_id and ps.fazenda_id = psi.fazenda_id
where ai.dominio = 'sanitario'
  and ai.status = 'agendado'
  and ai.deleted_at is null
  and ai.data_prevista > current_date;

create or replace view public.vw_sanitario_historico
with (security_invoker = true)
as
select
  e.id as evento_id,
  e.fazenda_id,
  e.animal_id,
  a.identificacao as animal_identificacao,
  a.nome as animal_nome,
  e.occurred_at,
  e.occurred_on,
  e.source_task_id as agenda_item_id,
  es.tipo as sanitario_tipo,
  es.produto,
  ps.id as protocolo_id,
  ps.nome as protocolo_nome,
  coalesce(psi.dose_num, 0) as dose_num
from public.eventos e
join public.eventos_sanitario es on es.evento_id = e.id and es.fazenda_id = e.fazenda_id
left join public.animais a on a.id = e.animal_id and a.fazenda_id = e.fazenda_id
left join public.agenda_itens ai on ai.id = e.source_task_id and ai.fazenda_id = e.fazenda_id
left join public.protocolos_sanitarios_itens psi on psi.id = ai.protocol_item_version_id and psi.fazenda_id = ai.fazenda_id
left join public.protocolos_sanitarios ps on ps.id = psi.protocolo_id and ps.fazenda_id = psi.fazenda_id
where e.dominio = 'sanitario'
  and e.deleted_at is null
  and es.deleted_at is null;

create or replace view public.vw_repro_status_animal
with (security_invoker = true)
as
select distinct on (e.fazenda_id, e.animal_id)
  e.animal_id,
  e.fazenda_id,
  e.occurred_at as last_event_date,
  er.tipo::text as last_event_type,
  case
    when er.tipo = 'diagnostico'
     and coalesce(er.payload ->> 'resultado', er.payload ->> 'diagnostico_resultado') = 'positivo'
      then 'PRENHA'
    when er.tipo = 'parto' then 'PARIDA'
    when er.tipo = 'aborto' then 'VAZIA'
    else upper(er.tipo::text)
  end as status_estimado
from public.eventos e
join public.eventos_reproducao er
  on er.evento_id = e.id
 and er.fazenda_id = e.fazenda_id
where e.dominio = 'reproducao'
  and e.animal_id is not null
  and e.deleted_at is null
  and er.deleted_at is null
order by e.fazenda_id, e.animal_id, e.occurred_at desc;

create or replace function public.can_create_farm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select can_create_farm from public.user_profiles where user_id = auth.uid() and deleted_at is null), true);
$$;

create or replace function public.create_fazenda(
  _nome text,
  _codigo text default null,
  _municipio text default null,
  _estado public.estado_uf_enum default null,
  _cep text default null,
  _area_total_ha numeric default null,
  _tipo_producao public.tipo_producao_enum default null,
  _sistema_manejo public.sistema_manejo_enum default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fazenda_id uuid;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  if not public.can_create_farm() then raise exception 'Forbidden'; end if;

  insert into public.fazendas(nome, codigo, municipio, estado, cep, area_total_ha, tipo_producao, sistema_manejo, created_by)
  values (_nome, _codigo, _municipio, _estado, _cep, _area_total_ha, _tipo_producao, _sistema_manejo, auth.uid())
  returning id into v_fazenda_id;

  insert into public.user_fazendas(user_id, fazenda_id, role, is_primary, accepted_at)
  values (auth.uid(), v_fazenda_id, 'owner', true, now());

  insert into public.fazenda_sanidade_config(fazenda_id, uf, aptidao, sistema)
  values (
    v_fazenda_id,
    _estado,
    case when _tipo_producao = 'mista' then 'misto' when _tipo_producao is null then 'all' else _tipo_producao::text end,
    case when _sistema_manejo = 'pastagem' then 'extensivo' when _sistema_manejo = 'semi_confinamento' then 'semi_intensivo' when _sistema_manejo = 'confinamento' then 'intensivo' else 'all' end
  )
  on conflict (fazenda_id) do nothing;

  return v_fazenda_id;
end;
$$;

create or replace function public.create_invite(_fazenda_id uuid, _email text default null, _phone text default null, _role public.farm_role_enum default 'cowboy')
returns public.farm_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.farm_invites;
begin
  if not public.role_in_fazenda(_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then
    raise exception 'Forbidden';
  end if;
  if _role = 'owner' and not public.role_in_fazenda(_fazenda_id, array['owner']::public.farm_role_enum[]) then
    raise exception 'Only owners can invite owners';
  end if;

  insert into public.farm_invites(fazenda_id, invited_by, email, phone, role)
  values (_fazenda_id, auth.uid(), nullif(_email, ''), nullif(_phone, ''), _role)
  returning * into v_invite;
  return v_invite;
end;
$$;

create or replace function public.get_invite_preview(_token uuid)
returns table (
  fazenda_nome text,
  role public.farm_role_enum,
  inviter_nome text,
  expires_at timestamptz,
  status public.farm_invite_status_enum,
  is_valid boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select f.nome, i.role, coalesce(up.display_name, 'Usuario'), i.expires_at, i.status,
         (i.status = 'pending' and i.expires_at > now() and i.deleted_at is null)
  from public.farm_invites i
  join public.fazendas f on f.id = i.fazenda_id
  left join public.user_profiles up on up.user_id = i.invited_by
  where i.token = _token;
$$;

create or replace function public.accept_invite(_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.farm_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  select * into v_invite from public.farm_invites where token = _token for update;
  if not found or v_invite.status <> 'pending' or v_invite.expires_at <= now() or v_invite.deleted_at is not null then
    raise exception 'Invite expired or invalid';
  end if;
  insert into public.user_fazendas(user_id, fazenda_id, role, accepted_at, invited_by)
  values (auth.uid(), v_invite.fazenda_id, v_invite.role, now(), v_invite.invited_by)
  on conflict (user_id, fazenda_id) do update
    set role = excluded.role, accepted_at = now(), deleted_at = null, updated_at = now();
  update public.farm_invites set status = 'accepted', updated_at = now() where id = v_invite.id;
end;
$$;

create or replace function public.reject_invite(_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.farm_invites set status = 'rejected', updated_at = now() where token = _token and status = 'pending';
end;
$$;

create or replace function public.cancel_invite(_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fazenda_id uuid;
begin
  select fazenda_id into v_fazenda_id from public.farm_invites where id = _invite_id;
  if not public.role_in_fazenda(v_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then
    raise exception 'Forbidden';
  end if;
  update public.farm_invites set status = 'cancelled', deleted_at = now(), updated_at = now() where id = _invite_id;
end;
$$;

create or replace function public.admin_set_member_role(_fazenda_id uuid, _target_user_id uuid, _new_role public.farm_role_enum)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.role_in_fazenda(_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then raise exception 'Forbidden'; end if;
  if _new_role = 'owner' and not public.role_in_fazenda(_fazenda_id, array['owner']::public.farm_role_enum[]) then raise exception 'Only owners can assign owner'; end if;
  update public.user_fazendas set role = _new_role, updated_at = now()
  where fazenda_id = _fazenda_id and user_id = _target_user_id and deleted_at is null;
end;
$$;

create or replace function public.admin_remove_member(_fazenda_id uuid, _target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.role_in_fazenda(_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then raise exception 'Forbidden'; end if;
  update public.user_fazendas set deleted_at = now(), updated_at = now()
  where fazenda_id = _fazenda_id and user_id = _target_user_id;
end;
$$;

create or replace function public.get_user_emails(user_ids uuid[])
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.email
  from auth.users u
  where u.id = any(user_ids);
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fazendas','user_profiles','user_settings','user_fazendas','farm_invites',
    'pastos','lotes','animais','contrapartes','animais_sociedade','categorias_zootecnicas',
    'fazenda_sanidade_config','protocolos_sanitarios','protocolos_sanitarios_itens',
    'agenda_itens','eventos','eventos_sanitario','eventos_pesagem','eventos_nutricao',
    'eventos_movimentacao','eventos_reproducao','eventos_financeiro','metrics_events',
    'produtos_veterinarios','catalogo_protocolos_oficiais','catalogo_protocolos_oficiais_itens',
    'catalogo_doencas_notificaveis'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy fazendas_select_member on public.fazendas for select using (public.has_membership(id));
create policy fazendas_insert_auth on public.fazendas for insert with check (created_by = auth.uid());
create policy fazendas_update_owner_manager on public.fazendas for update using (public.role_in_fazenda(id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(id, array['owner','manager']::public.farm_role_enum[]));

create policy user_profiles_select_related on public.user_profiles for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.user_fazendas a
    join public.user_fazendas b on b.fazenda_id = a.fazenda_id and b.user_id = auth.uid() and b.deleted_at is null
    where a.user_id = user_profiles.user_id and a.deleted_at is null
  )
);
create policy user_profiles_insert_self on public.user_profiles for insert with check (user_id = auth.uid());
create policy user_profiles_update_self on public.user_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_settings_self on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_fazendas_select_member on public.user_fazendas for select using (
  user_id = auth.uid() or public.has_membership(fazenda_id)
);

create policy farm_invites_select_manager on public.farm_invites for select using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));

create policy catalogo_protocolos_select_auth on public.catalogo_protocolos_oficiais for select to authenticated using (true);
create policy catalogo_protocolos_itens_select_auth on public.catalogo_protocolos_oficiais_itens for select to authenticated using (true);
create policy catalogo_doencas_select_auth on public.catalogo_doencas_notificaveis for select to authenticated using (true);
create policy produtos_veterinarios_select_auth on public.produtos_veterinarios for select to authenticated using (true);

create policy metrics_select_member on public.metrics_events for select using (public.has_membership(fazenda_id));
create policy metrics_insert_member on public.metrics_events for insert with check (public.has_membership(fazenda_id));

create policy pastos_select_member on public.pastos for select using (public.has_membership(fazenda_id));
create policy pastos_write_manager on public.pastos for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy lotes_select_member on public.lotes for select using (public.has_membership(fazenda_id));
create policy lotes_write_manager on public.lotes for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy animais_select_member on public.animais for select using (public.has_membership(fazenda_id));
create policy animais_write_member on public.animais for all using (public.has_membership(fazenda_id)) with check (public.has_membership(fazenda_id));
create policy contrapartes_select_member on public.contrapartes for select using (public.has_membership(fazenda_id));
create policy contrapartes_write_manager on public.contrapartes for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy animais_sociedade_select_member on public.animais_sociedade for select using (public.has_membership(fazenda_id));
create policy animais_sociedade_write_manager on public.animais_sociedade for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy categorias_select_member on public.categorias_zootecnicas for select using (public.has_membership(fazenda_id));
create policy categorias_write_manager on public.categorias_zootecnicas for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy config_select_member on public.fazenda_sanidade_config for select using (public.has_membership(fazenda_id));
create policy config_write_manager on public.fazenda_sanidade_config for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy protocolos_select_member on public.protocolos_sanitarios for select using (public.has_membership(fazenda_id));
create policy protocolos_write_manager on public.protocolos_sanitarios for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy protocolo_itens_select_member on public.protocolos_sanitarios_itens for select using (public.has_membership(fazenda_id));
create policy protocolo_itens_write_manager on public.protocolos_sanitarios_itens for all using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy agenda_select_member on public.agenda_itens for select using (public.has_membership(fazenda_id));
create policy agenda_write_member on public.agenda_itens for all using (public.has_membership(fazenda_id)) with check (public.has_membership(fazenda_id));
create policy eventos_select_member on public.eventos for select using (public.has_membership(fazenda_id));
create policy eventos_insert_member on public.eventos for insert with check (public.has_membership(fazenda_id));
create policy eventos_soft_delete_manager on public.eventos for update using (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])) with check (public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));

create policy eventos_sanitario_select_member on public.eventos_sanitario for select using (public.has_membership(fazenda_id));
create policy eventos_sanitario_insert_member on public.eventos_sanitario for insert with check (public.has_membership(fazenda_id));
create policy eventos_pesagem_select_member on public.eventos_pesagem for select using (public.has_membership(fazenda_id));
create policy eventos_pesagem_insert_member on public.eventos_pesagem for insert with check (public.has_membership(fazenda_id));
create policy eventos_nutricao_select_member on public.eventos_nutricao for select using (public.has_membership(fazenda_id));
create policy eventos_nutricao_insert_member on public.eventos_nutricao for insert with check (public.has_membership(fazenda_id));
create policy eventos_movimentacao_select_member on public.eventos_movimentacao for select using (public.has_membership(fazenda_id));
create policy eventos_movimentacao_insert_member on public.eventos_movimentacao for insert with check (public.has_membership(fazenda_id));
create policy eventos_reproducao_select_member on public.eventos_reproducao for select using (public.has_membership(fazenda_id));
create policy eventos_reproducao_insert_member on public.eventos_reproducao for insert with check (public.has_membership(fazenda_id));
create policy eventos_financeiro_select_member on public.eventos_financeiro for select using (public.has_membership(fazenda_id));
create policy eventos_financeiro_insert_member on public.eventos_financeiro for insert with check (public.has_membership(fazenda_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'fazendas','user_profiles','user_settings','user_fazendas',
    'pastos','lotes','animais','contrapartes','animais_sociedade','categorias_zootecnicas',
    'fazenda_sanidade_config','protocolos_sanitarios','protocolos_sanitarios_itens',
    'agenda_itens','eventos','eventos_sanitario','eventos_pesagem','eventos_nutricao',
    'eventos_movimentacao','eventos_reproducao','eventos_financeiro'
  ] loop
    execute format('create unique index if not exists ux_%I_client_op_id on public.%I(client_op_id)', t, t);
    execute format('create index if not exists idx_%I_client_tx_id on public.%I(client_tx_id)', t, t);
    execute format('create index if not exists idx_%I_deleted_at on public.%I(deleted_at)', t, t);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fazendas','user_profiles','user_settings','user_fazendas','farm_invites',
    'pastos','lotes','animais','contrapartes','animais_sociedade','categorias_zootecnicas',
    'fazenda_sanidade_config','protocolos_sanitarios','protocolos_sanitarios_itens',
    'agenda_itens','produtos_veterinarios','catalogo_protocolos_oficiais',
    'catalogo_protocolos_oficiais_itens','catalogo_doencas_notificaveis'
  ] loop
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['eventos','eventos_sanitario','eventos_pesagem','eventos_nutricao','eventos_movimentacao','eventos_reproducao','eventos_financeiro'] loop
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger trg_%I_prevent_business_update before update on public.%I for each row execute function public.prevent_business_update()', t, t);
  end loop;
end $$;

create trigger trg_eventos_set_occurred_on
before insert on public.eventos
for each row execute function public.set_event_occurred_on();

grant usage on schema public to anon, authenticated, service_role;
grant select on public.catalogo_protocolos_oficiais, public.catalogo_protocolos_oficiais_itens, public.catalogo_doencas_notificaveis, public.produtos_veterinarios to authenticated;
grant execute on function public.sanitario_complete_agenda_with_event(uuid, timestamptz, public.sanitario_tipo_enum, text, text, jsonb, text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.sanitario_recompute_agenda_for_fazenda(uuid, date) to authenticated;
grant execute on function public.sanitario_recompute_agenda_for_animal(uuid, uuid, date) to authenticated;
grant execute on function public.materialize_standard_sanitary_protocols(uuid) to authenticated;
