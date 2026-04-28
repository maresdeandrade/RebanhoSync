-- 0001_init.sql
-- =========================================================
-- Gestão Pecuária - MVP Schema (offline-first + Two Rails)
-- =========================================================

-- Extensions
create extension if not exists pgcrypto;

-- =========================================================
-- ENUMS (mínimos e compatíveis com o MVP)
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'farm_role_enum') then
    create type public.farm_role_enum as enum ('cowboy','manager','owner');
  end if;

  if not exists (select 1 from pg_type where typname = 'sexo_enum') then
    create type public.sexo_enum as enum ('M','F');
  end if;

  if not exists (select 1 from pg_type where typname = 'animal_status_enum') then
    create type public.animal_status_enum as enum ('ativo','vendido','morto');
  end if;

  if not exists (select 1 from pg_type where typname = 'lote_status_enum') then
    create type public.lote_status_enum as enum ('ativo','inativo');
  end if;

  if not exists (select 1 from pg_type where typname = 'dominio_enum') then
    create type public.dominio_enum as enum ('sanitario','pesagem','nutricao','movimentacao','reproducao','financeiro');
  end if;

  if not exists (select 1 from pg_type where typname = 'agenda_status_enum') then
    create type public.agenda_status_enum as enum ('agendado','concluido','cancelado');
  end if;

  if not exists (select 1 from pg_type where typname = 'agenda_source_kind_enum') then
    create type public.agenda_source_kind_enum as enum ('manual','automatico');
  end if;

  if not exists (select 1 from pg_type where typname = 'sanitario_tipo_enum') then
    create type public.sanitario_tipo_enum as enum ('vacinacao','vermifugacao','medicamento');
  end if;

  if not exists (select 1 from pg_type where typname = 'repro_tipo_enum') then
    create type public.repro_tipo_enum as enum ('cobertura','IA','diagnostico','parto');
  end if;

  if not exists (select 1 from pg_type where typname = 'financeiro_tipo_enum') then
    create type public.financeiro_tipo_enum as enum ('compra','venda');
  end if;

  if not exists (select 1 from pg_type where typname = 'contraparte_tipo_enum') then
    create type public.contraparte_tipo_enum as enum ('pessoa','empresa');
  end if;

  if not exists (select 1 from pg_type where typname = 'papel_macho_enum') then
    create type public.papel_macho_enum as enum ('reprodutor','rufiao');
  end if;

  if not exists (select 1 from pg_type where typname = 'theme_enum') then
    create type public.theme_enum as enum ('system','light','dark');
  end if;
end $$;

-- =========================================================
-- Helper: updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =========================================================
-- Helper: append-only guard for event tables (block business updates)
-- Allows only: deleted_at, updated_at, server_received_at
-- =========================================================
create or replace function public.prevent_business_update()
returns trigger language plpgsql as $$
declare
  new_stripped jsonb;
  old_stripped jsonb;
begin
  new_stripped := to_jsonb(new) - 'deleted_at' - 'updated_at' - 'server_received_at';
  old_stripped := to_jsonb(old) - 'deleted_at' - 'updated_at' - 'server_received_at';

  if new_stripped <> old_stripped then
    raise exception 'Append-only violation on %. Updates to business columns are not allowed.', tg_table_name;
  end if;

  return new;
end $$;

-- =========================================================
-- FAZENDAS (tenant root)
-- =========================================================
create table if not exists public.fazendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text null,
  municipio text null,
  timezone text not null default 'America/Sao_Paulo',
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid null references auth.users(id),

  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid null,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_fazendas_updated_at
before update on public.fazendas
for each row execute function public.set_updated_at();

create unique index if not exists ux_fazendas_op
on public.fazendas(client_op_id)
where deleted_at is null;

-- =========================================================
-- USER PROFILES
-- =========================================================
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  display_name text null,
  phone text null,
  avatar_url text null,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',

  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid null,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- =========================================================
-- USER SETTINGS
-- =========================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,

  theme public.theme_enum not null default 'system',
  date_format text not null default 'DD/MM/YYYY',
  number_format text not null default 'pt-BR',

  notifications jsonb not null default '{
    "enabled": true,
    "agenda_reminders": true,
    "days_before": [7,3,1],
    "quiet_hours": {"start":"22:00","end":"06:00"}
  }'::jsonb,

  sync_prefs jsonb not null default '{
    "wifi_only": false,
    "background_sync": true,
    "max_batch_size": 500
  }'::jsonb,

  active_fazenda_id uuid null references public.fazendas(id) on delete set null,

  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid null,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- MEMBERSHIP (SSoT)
-- =========================================================
create table if not exists public.user_fazendas (
  user_id uuid not null references auth.users(id) on delete cascade,
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  role public.farm_role_enum not null,
  is_primary boolean not null default false,

  invited_by uuid null references auth.users(id),
  accepted_at timestamptz null,

  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid null,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, fazenda_id)
);

create trigger trg_user_fazendas_updated_at
before update on public.user_fazendas
for each row execute function public.set_updated_at();

create unique index if not exists ux_user_fazendas_active
on public.user_fazendas(fazenda_id, user_id)
where deleted_at is null;

-- =========================================================
-- STATE TABLES: pastos, lotes, animais, contrapartes, protocolos
-- =========================================================
create table if not exists public.pastos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,
  area_ha numeric(12,2) null,
  capacidade_ua numeric(12,2) null,
  benfeitorias jsonb not null default '{}'::jsonb,
  observacoes text null,
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

create trigger trg_pastos_updated_at
before update on public.pastos
for each row execute function public.set_updated_at();

create unique index if not exists ux_pastos_id_fazenda
on public.pastos(id, fazenda_id);

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,
  status public.lote_status_enum not null default 'ativo',

  pasto_id uuid null,
  touro_id uuid null,

  observacoes text null,
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

create trigger trg_lotes_updated_at
before update on public.lotes
for each row execute function public.set_updated_at();

create unique index if not exists ux_lotes_id_fazenda
on public.lotes(id, fazenda_id);

alter table public.lotes
  add constraint fk_lotes_pasto
  foreign key (pasto_id, fazenda_id)
  references public.pastos(id, fazenda_id)
  deferrable initially deferred;

create table if not exists public.animais (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  identificacao text not null,
  rfid text null,
  nome text null,

  sexo public.sexo_enum not null,
  status public.animal_status_enum not null default 'ativo',

  data_nascimento date null,
  data_entrada date null,
  data_saida date null,

  lote_id uuid null,

  pai_id uuid null,
  mae_id uuid null,

  papel_macho public.papel_macho_enum null,
  habilitado_monta boolean not null default false,

  observacoes text null,
  payload jsonb not null default '{}'::jsonb,

  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_femea_sem_atributos_macho
    check (
      sexo = 'M'
      or (habilitado_monta = false and papel_macho is null)
    )
);

create trigger trg_animais_updated_at
before update on public.animais
for each row execute function public.set_updated_at();

create unique index if not exists ux_animais_id_fazenda
on public.animais(id, fazenda_id);

create index if not exists ix_animais_identificacao
on public.animais(fazenda_id, identificacao)
where deleted_at is null;

alter table public.animais
  add constraint fk_animais_lote
  foreign key (lote_id, fazenda_id)
  references public.lotes(id, fazenda_id)
  deferrable initially deferred;

alter table public.animais
  add constraint fk_animais_pai
  foreign key (pai_id, fazenda_id)
  references public.animais(id, fazenda_id)
  deferrable initially deferred;

alter table public.animais
  add constraint fk_animais_mae
  foreign key (mae_id, fazenda_id)
  references public.animais(id, fazenda_id)
  deferrable initially deferred;

alter table public.lotes
  add constraint fk_lotes_touro
  foreign key (touro_id, fazenda_id)
  references public.animais(id, fazenda_id)
  deferrable initially deferred;

-- Contrapartes
create table if not exists public.contrapartes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  tipo public.contraparte_tipo_enum not null default 'pessoa',
  nome text not null,
  documento text null,
  telefone text null,
  email text null,
  endereco text null,
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

create trigger trg_contrapartes_updated_at
before update on public.contrapartes
for each row execute function public.set_updated_at();

create unique index if not exists ux_contrapartes_id_fazenda
on public.contrapartes(id, fazenda_id);

-- Protocolos sanitários
create table if not exists public.protocolos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  nome text not null,
  descricao text null,
  ativo boolean not null default true,
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

create trigger trg_protocolos_sanitarios_updated_at
before update on public.protocolos_sanitarios
for each row execute function public.set_updated_at();

create unique index if not exists ux_protocolos_sanitarios_id_fazenda
on public.protocolos_sanitarios(id, fazenda_id);

-- Itens de Protocolo
create table if not exists public.protocolos_sanitarios_itens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  protocolo_id uuid not null,
  protocol_item_id uuid not null,
  version int not null check (version > 0),

  tipo public.sanitario_tipo_enum not null,
  produto text not null,
  intervalo_dias int not null check (intervalo_dias > 0),
  dose_num int null check (dose_num is null or dose_num > 0),
  gera_agenda boolean not null default true,

  dedup_template text null,
  payload jsonb not null default '{}'::jsonb,

  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_proto_item_protocolo
    foreign key (protocolo_id, fazenda_id)
    references public.protocolos_sanitarios(id, fazenda_id)
    deferrable initially deferred
);

create trigger trg_protocolos_sanitarios_itens_updated_at
before update on public.protocolos_sanitarios_itens
for each row execute function public.set_updated_at();

-- =========================================================
-- AGENDA (Two Rails: mutável)
-- =========================================================
create table if not exists public.agenda_itens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  dominio public.dominio_enum not null,
  tipo text not null,
  status public.agenda_status_enum not null default 'agendado',
  data_prevista date not null,

  animal_id uuid null,
  lote_id uuid null,

  dedup_key text null,
  source_kind public.agenda_source_kind_enum not null default 'manual',
  source_ref jsonb null,

  source_client_op_id uuid null,
  source_tx_id uuid null,
  source_evento_id uuid null,

  protocol_item_version_id uuid null,
  interval_days_applied int null,

  payload jsonb not null default '{}'::jsonb,

  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ck_agenda_alvo
    check (animal_id is not null or lote_id is not null),

  constraint ck_agenda_dedup_automatico
    check (source_kind = 'manual' or dedup_key is not null)
);

create trigger trg_agenda_itens_updated_at
before update on public.agenda_itens
for each row execute function public.set_updated_at();

create unique index if not exists ux_agenda_dedup_active
on public.agenda_itens(fazenda_id, dedup_key)
where status = 'agendado' and deleted_at is null and dedup_key is not null;

alter table public.agenda_itens
  add constraint fk_agenda_animal
  foreign key (animal_id, fazenda_id)
  references public.animais(id, fazenda_id)
  deferrable initially deferred;

alter table public.agenda_itens
  add constraint fk_agenda_lote
  foreign key (lote_id, fazenda_id)
  references public.lotes(id, fazenda_id)
  deferrable initially deferred;

-- =========================================================
-- EVENTOS (Two Rails: append-only)
-- =========================================================
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete restrict,

  dominio public.dominio_enum not null,

  occurred_at timestamptz not null,
  occurred_on date generated always as ((occurred_at at time zone 'UTC')::date) stored,

  animal_id uuid null,
  lote_id uuid null,

  source_task_id uuid null,
  source_tx_id uuid null,
  source_client_op_id uuid null,

  corrige_evento_id uuid null,

  observacoes text null,
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

create trigger trg_eventos_updated_at
before update on public.eventos
for each row execute function public.set_updated_at();

create trigger trg_eventos_append_only
before update on public.eventos
for each row execute function public.prevent_business_update();

create unique index if not exists ux_eventos_id_fazenda
on public.eventos(id, fazenda_id);

alter table public.eventos
  add constraint fk_eventos_animal
  foreign key (animal_id, fazenda_id)
  references public.animais(id, fazenda_id)
  deferrable initially deferred;

alter table public.eventos
  add constraint fk_eventos_lote
  foreign key (lote_id, fazenda_id)
  references public.lotes(id, fazenda_id)
  deferrable initially deferred;

-- Detalhes de Eventos (1:1)
create table if not exists public.eventos_sanitario (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.sanitario_tipo_enum not null,
  produto text not null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_sanitario_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
create trigger trg_evt_sanitario_append_only before update on public.eventos_sanitario for each row execute function public.prevent_business_update();

create table if not exists public.eventos_pesagem (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  peso_kg numeric(10,2) not null check (peso_kg > 0),
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_pesagem_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
create trigger trg_evt_pesagem_append_only before update on public.eventos_pesagem for each row execute function public.prevent_business_update();

create table if not exists public.eventos_nutricao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  alimento_nome text null,
  quantidade_kg numeric(12,3) null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_nutricao_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
create trigger trg_evt_nutricao_append_only before update on public.eventos_nutricao for each row execute function public.prevent_business_update();

create table if not exists public.eventos_movimentacao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  from_lote_id uuid null,
  to_lote_id uuid null,
  from_pasto_id uuid null,
  to_pasto_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_mov_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
create trigger trg_evt_mov_append_only before update on public.eventos_movimentacao for each row execute function public.prevent_business_update();

create table if not exists public.eventos_reproducao (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.repro_tipo_enum not null,
  macho_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_repro_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
create trigger trg_evt_repro_append_only before update on public.eventos_reproducao for each row execute function public.prevent_business_update();

create table if not exists public.eventos_financeiro (
  evento_id uuid primary key,
  fazenda_id uuid not null,
  tipo public.financeiro_tipo_enum not null,
  valor_total numeric(14,2) not null,
  contraparte_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  client_id text not null,
  client_op_id uuid not null,
  client_tx_id uuid null,
  client_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_evt_fin_evento_fazenda foreign key (evento_id, fazenda_id) references public.eventos(id, fazenda_id)
);
create trigger trg_evt_fin_append_only before update on public.eventos_financeiro for each row execute function public.prevent_business_update();

-- =========================================================
-- VIEWS (ativos)
-- =========================================================
create or replace view public.vw_animais_active as select * from public.animais where deleted_at is null;
create or replace view public.vw_lotes_active as select * from public.lotes where deleted_at is null;
create or replace view public.vw_pastos_active as select * from public.pastos where deleted_at is null;
create or replace view public.vw_agenda_active as select * from public.agenda_itens where deleted_at is null and status = 'agendado';

-- =========================================================
-- RLS HELPERS & POLICIES
-- =========================================================
create or replace function public.has_membership(_fazenda_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_fazendas uf
    where uf.user_id = auth.uid() and uf.fazenda_id = _fazenda_id and uf.deleted_at is null
  );
$$;

create or replace function public.role_in_fazenda(_fazenda_id uuid)
returns public.farm_role_enum language sql stable as $$
  select uf.role from public.user_fazendas uf
  where uf.user_id = auth.uid() and uf.fazenda_id = _fazenda_id and uf.deleted_at is null limit 1;
$$;

-- Enable RLS
alter table public.fazendas enable row level security;
alter table public.user_fazendas enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.pastos enable row level security;
alter table public.lotes enable row level security;
alter table public.animais enable row level security;
alter table public.agenda_itens enable row level security;
alter table public.eventos enable row level security;

-- Policies (Exemplos principais)
create policy "fazendas_select_by_membership" on public.fazendas for select using (public.has_membership(id));
create policy "user_profiles_self" on public.user_profiles for all using (user_id = auth.uid());
create policy "animais_select_by_membership" on public.animais for select using (public.has_membership(fazenda_id));
create policy "animais_insert_manager" on public.animais for insert with check (public.has_membership(fazenda_id) and public.role_in_fazenda(fazenda_id) in ('owner','manager'));

-- =========================================================
-- RPC: Membership Management
-- =========================================================
create or replace function public.admin_set_member_role(_fazenda_id uuid, _user_id uuid, _role public.farm_role_enum, _is_primary boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.role_in_fazenda(_fazenda_id) is distinct from 'owner' then
    raise exception 'Only owner can manage members';
  end if;
  insert into public.user_fazendas(user_id, fazenda_id, role, is_primary, accepted_at, deleted_at)
  values (_user_id, _fazenda_id, _role, _is_primary, now(), null)
  on conflict (user_id, fazenda_id) do update set role = excluded.role, is_primary = excluded.is_primary, updated_at = now(), deleted_at = null;
end $$;