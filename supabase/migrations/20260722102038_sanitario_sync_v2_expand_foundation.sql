-- ADR-0007 / primeiro incremento do Sync Remoto Sanitario v2.
-- Migration exclusivamente expand: nenhuma chamada e conectada ao sync-batch neste incremento.

do $$
begin
  create type public.sanitario_sync_v2_event_nature_enum as enum (
    'primary_execution',
    'correction',
    'standalone_fact'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_sync_v2_agenda_input as (
    id uuid,
    dedup_key text,
    client_id text,
    client_tx_id uuid,
    client_recorded_at timestamptz,
    source_demand_key text,
    preview_group_id text,
    protocolo_id uuid,
    protocol_item_version_id uuid,
    protocol_item_snapshot jsonb,
    janela_inicio date,
    janela_fim date,
    data_programada date,
    lote_id uuid,
    produto_snapshot jsonb,
    produto_classe text,
    acao_sanitaria text,
    metadata jsonb
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_sync_v2_event_input as (
    id uuid,
    source_sanitario_agenda_v2_id uuid,
    natureza public.sanitario_sync_v2_event_nature_enum,
    occurred_at timestamptz,
    animal_id uuid,
    lote_id uuid,
    corrige_evento_id uuid,
    observacoes text,
    payload jsonb,
    client_id text,
    client_tx_id uuid,
    client_recorded_at timestamptz
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_sync_v2_detail_input as (
    tipo public.sanitario_tipo_enum,
    produto_sanitario_v2_id uuid,
    insumo_id uuid,
    estoque_lote_id uuid,
    produto_nome_snapshot text,
    produto_snapshot jsonb,
    estoque_lote_codigo_snapshot text,
    lote_fabricante text,
    validade_produto date,
    dose_quantidade numeric,
    dose_unidade text,
    via_aplicacao text,
    responsavel_nome text,
    responsavel_tipo text,
    carencia_carne_dias integer,
    carencia_leite_dias integer,
    carencia_carne_ate date,
    carencia_leite_ate date,
    custo_unitario_snapshot numeric,
    custo_total_snapshot numeric,
    payload jsonb
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_sync_v2_event_animal_input as (
    id uuid,
    animal_id uuid
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_sync_v2_closure_input as (
    id uuid,
    agenda_id uuid,
    closure_type public.sanitario_agenda_closure_v2_type_enum,
    dedup_key text,
    client_id text,
    client_tx_id uuid,
    client_recorded_at timestamptz,
    closed_at timestamptz,
    reason text,
    partial_payload jsonb,
    metadata jsonb
  );
exception when duplicate_object then null;
end $$;

alter table public.sanitario_agenda_v2
  add column if not exists revision bigint not null default 0,
  add column if not exists contract_version integer,
  add column if not exists domain_op_id uuid;

alter table public.sanitario_agenda_v2
  add constraint ck_sanitario_agenda_v2_revision_non_negative
  check (revision >= 0) not valid;

alter table public.sanitario_agenda_v2
  validate constraint ck_sanitario_agenda_v2_revision_non_negative;

drop index if exists public.ux_sanitario_agenda_v2_client_op_active;
create unique index ux_sanitario_agenda_v2_client_op
  on public.sanitario_agenda_v2(fazenda_id, client_op_id);
create unique index ux_sanitario_agenda_v2_domain_op
  on public.sanitario_agenda_v2(fazenda_id, domain_op_id)
  where domain_op_id is not null;

alter table public.sanitario_agenda_closures_v2
  add column if not exists contract_version integer,
  add column if not exists domain_op_id uuid;

drop index if exists public.ux_sanitario_agenda_closures_v2_client_op_active;
create unique index ux_sanitario_agenda_closures_v2_client_op
  on public.sanitario_agenda_closures_v2(fazenda_id, client_op_id);
create unique index ux_sanitario_agenda_closures_v2_domain_op
  on public.sanitario_agenda_closures_v2(fazenda_id, domain_op_id)
  where domain_op_id is not null;

alter table public.eventos
  add column if not exists source_sanitario_agenda_v2_id uuid,
  add column if not exists sanitario_sync_v2_nature public.sanitario_sync_v2_event_nature_enum,
  add column if not exists sanitario_contract_version integer,
  add column if not exists domain_op_id uuid;

alter table public.eventos
  add constraint fk_eventos_source_sanitario_agenda_v2_fazenda
    foreign key (source_sanitario_agenda_v2_id, fazenda_id)
    references public.sanitario_agenda_v2(id, fazenda_id)
    on delete restrict,
  add constraint ck_eventos_sanitario_sync_v2_shape check (
    sanitario_contract_version is null
    or (
      dominio = 'sanitario'::public.dominio_enum
      and domain_op_id is not null
      and sanitario_sync_v2_nature is not null
      and (
        (sanitario_sync_v2_nature = 'correction'::public.sanitario_sync_v2_event_nature_enum and corrige_evento_id is not null)
        or (sanitario_sync_v2_nature <> 'correction'::public.sanitario_sync_v2_event_nature_enum and corrige_evento_id is null)
      )
      and (
        sanitario_sync_v2_nature <> 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
        or corrige_evento_id is null
      )
    )
  ),
  add constraint ck_eventos_external_documented_evidence check (
    coalesce(payload ->> 'entry_history_source', payload ->> 'source') is distinct from 'external_documented'
    or nullif(btrim(coalesce(payload ->> 'evidence_reference', payload ->> 'evidenceReference', '')), '') is not null
  ) not valid;

create unique index ux_eventos_domain_op_id
  on public.eventos(fazenda_id, domain_op_id)
  where domain_op_id is not null;
create unique index ux_eventos_sanitario_agenda_primary_execution
  on public.eventos(fazenda_id, source_sanitario_agenda_v2_id)
  where source_sanitario_agenda_v2_id is not null
    and sanitario_sync_v2_nature = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
    and corrige_evento_id is null
    and deleted_at is null;

alter table public.eventos_sanitario
  add column if not exists produto_sanitario_v2_id uuid,
  add column if not exists insumo_id uuid,
  add column if not exists produto_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists sanitario_contract_version integer,
  add column if not exists domain_op_id uuid;

alter table public.eventos_sanitario
  add constraint fk_eventos_sanitario_produto_v2
    foreign key (produto_sanitario_v2_id)
    references public.sanitario_produtos_v2(id)
    on delete restrict,
  add constraint fk_eventos_sanitario_insumo_fazenda
    foreign key (insumo_id, fazenda_id)
    references public.insumos(id, fazenda_id)
    on delete restrict,
  add constraint fk_eventos_sanitario_lote_insumo_fazenda
    foreign key (estoque_lote_id, insumo_id, fazenda_id)
    references public.insumo_lotes(id, insumo_id, fazenda_id)
    on delete restrict
    not valid,
  add constraint ck_eventos_sanitario_v2_legacy_product_read_only check (
    sanitario_contract_version is null or produto_veterinario_id is null
  ),
  add constraint ck_eventos_sanitario_v2_product_snapshot check (
    jsonb_typeof(produto_snapshot) = 'object'
  ),
  add constraint ck_eventos_sanitario_v2_stock_product_coherence check (
    sanitario_contract_version is null
    or estoque_lote_id is null
    or insumo_id is not null
  );

create unique index ux_eventos_sanitario_domain_op_id
  on public.eventos_sanitario(fazenda_id, domain_op_id)
  where domain_op_id is not null;
create index ix_eventos_sanitario_produto_v2
  on public.eventos_sanitario(produto_sanitario_v2_id)
  where produto_sanitario_v2_id is not null;
create index ix_eventos_sanitario_insumo
  on public.eventos_sanitario(fazenda_id, insumo_id)
  where insumo_id is not null;

create table if not exists public.eventos_animais (
  id uuid primary key,
  fazenda_id uuid not null,
  evento_id uuid not null,
  animal_id uuid not null,
  created_at timestamptz not null default now(),
  unique (id, fazenda_id),
  constraint ux_eventos_animais_fact unique (fazenda_id, evento_id, animal_id),
  constraint fk_eventos_animais_evento_fazenda
    foreign key (evento_id, fazenda_id)
    references public.eventos(id, fazenda_id)
    on delete restrict,
  constraint fk_eventos_animais_animal_fazenda
    foreign key (animal_id, fazenda_id)
    references public.animais(id, fazenda_id)
    on delete restrict
);

create index if not exists ix_eventos_animais_animal
  on public.eventos_animais(fazenda_id, animal_id, evento_id);

alter table public.eventos_animais enable row level security;

create policy eventos_animais_select_member
  on public.eventos_animais
  for select
  to authenticated
  using (public.has_membership(fazenda_id));

revoke all on table public.eventos_animais from public, anon, authenticated;
grant select on table public.eventos_animais to authenticated;

alter table public.insumo_movimentacoes
  add column if not exists domain_op_id uuid;

drop index if exists public.ux_insumo_movimentacoes_consumo_sanitario_evento;
create unique index ux_insumo_movimentacoes_source_lote_tipo
  on public.insumo_movimentacoes(fazenda_id, source_evento_id, insumo_lote_id, tipo)
  where source_evento_id is not null and deleted_at is null;
create index ix_insumo_movimentacoes_domain_op
  on public.insumo_movimentacoes(fazenda_id, domain_op_id)
  where domain_op_id is not null;

create table if not exists public.sanitario_sync_v2_gates (
  fazenda_id uuid primary key references public.fazendas(id) on delete cascade,
  enabled boolean not null default false,
  minimum_contract_version integer not null default 2,
  maximum_contract_version integer not null default 2,
  allowed_user_ids uuid[] not null default '{}'::uuid[],
  allowed_client_ids text[] not null default '{}'::text[],
  rollout_percentage smallint not null default 100,
  valid_from timestamptz,
  valid_until timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_sanitario_sync_v2_gate_versions check (
    minimum_contract_version > 0
    and maximum_contract_version >= minimum_contract_version
  ),
  constraint ck_sanitario_sync_v2_gate_rollout check (
    rollout_percentage between 0 and 100
  ),
  constraint ck_sanitario_sync_v2_gate_validity check (
    valid_from is null or valid_until is null or valid_from <= valid_until
  )
);

create table if not exists public.sanitario_sync_v2_operations (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  operation_kind text not null,
  entity_id uuid not null,
  client_op_id uuid not null,
  domain_op_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  contract_version integer not null,
  request_fingerprint text not null,
  canonical_result jsonb not null,
  executor_role name not null default current_user,
  created_at timestamptz not null default now(),
  unique (fazenda_id, client_op_id),
  unique (fazenda_id, operation_kind, domain_op_id),
  constraint ck_sanitario_sync_v2_operation_kind check (
    operation_kind in ('agenda_create', 'agenda_targets_replace', 'factual_core', 'administrative_closure')
  ),
  constraint ck_sanitario_sync_v2_result_object check (jsonb_typeof(canonical_result) = 'object')
);

alter table public.sanitario_sync_v2_gates enable row level security;
alter table public.sanitario_sync_v2_operations enable row level security;
revoke all on table public.sanitario_sync_v2_gates from public, anon, authenticated;
revoke all on table public.sanitario_sync_v2_operations from public, anon, authenticated;
grant select, insert, update, delete on table public.sanitario_sync_v2_gates to service_role;
grant select, insert on table public.sanitario_sync_v2_operations to service_role;

drop trigger if exists trg_sanitario_sync_v2_gates_updated_at on public.sanitario_sync_v2_gates;
create trigger trg_sanitario_sync_v2_gates_updated_at
  before update on public.sanitario_sync_v2_gates
  for each row execute function public.set_updated_at();

create or replace function public.prevent_eventos_animais_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  raise exception 'SANITARIO_EVENT_ANIMAL_APPEND_ONLY'
    using errcode = '23514', constraint = 'ck_eventos_animais_append_only';
end;
$$;

drop trigger if exists trg_eventos_animais_append_only on public.eventos_animais;
create trigger trg_eventos_animais_append_only
  before update or delete on public.eventos_animais
  for each row execute function public.prevent_eventos_animais_mutation();

create or replace function public.guard_sanitario_sync_v2_internal_writes()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_internal boolean := coalesce(current_setting('rebanhosync.sanitario_sync_v2_internal', true), '') = 'on';
begin
  if tg_table_name = 'sanitario_agenda_v2' and tg_op = 'UPDATE' then
    if (new.status, new.revision, new.execution_evento_id)
       is distinct from
       (old.status, old.revision, old.execution_evento_id)
       and coalesce(new.contract_version, old.contract_version) is not null
       and not v_internal then
      raise exception 'SANITARIO_AGENDA_TRANSITION_REQUIRES_INTERNAL_FUNCTION'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'sanitario_agenda_v2' and tg_op = 'INSERT' then
    if new.contract_version is not null and new.execution_evento_id is not null then
      raise exception 'SANITARIO_AGENDA_EXECUTION_EVENT_IS_LEGACY_READ_ONLY'
        using errcode = '42501';
    end if;
    if new.contract_version is not null and not v_internal then
      raise exception 'SANITARIO_AGENDA_CREATE_REQUIRES_INTERNAL_FUNCTION'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'sanitario_agenda_closures_v2' then
    if new.contract_version is not null and not v_internal then
      raise exception 'SANITARIO_CLOSURE_REQUIRES_INTERNAL_FUNCTION'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'eventos' and new.sanitario_contract_version is not null then
    if not v_internal then
      raise exception 'SANITARIO_FACTUAL_CORE_REQUIRES_INTERNAL_FUNCTION'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'eventos_sanitario' and new.sanitario_contract_version is not null then
    if not v_internal then
      raise exception 'SANITARIO_FACTUAL_DETAIL_REQUIRES_INTERNAL_FUNCTION'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_sanitario_agenda_v2_internal on public.sanitario_agenda_v2;
create trigger trg_guard_sanitario_agenda_v2_internal
  before insert or update on public.sanitario_agenda_v2
  for each row execute function public.guard_sanitario_sync_v2_internal_writes();
drop trigger if exists trg_guard_sanitario_closure_v2_internal on public.sanitario_agenda_closures_v2;
create trigger trg_guard_sanitario_closure_v2_internal
  before insert on public.sanitario_agenda_closures_v2
  for each row execute function public.guard_sanitario_sync_v2_internal_writes();
drop trigger if exists trg_guard_sanitario_event_v2_internal on public.eventos;
create trigger trg_guard_sanitario_event_v2_internal
  before insert on public.eventos
  for each row execute function public.guard_sanitario_sync_v2_internal_writes();
drop trigger if exists trg_guard_sanitario_detail_v2_internal on public.eventos_sanitario;
create trigger trg_guard_sanitario_detail_v2_internal
  before insert on public.eventos_sanitario
  for each row execute function public.guard_sanitario_sync_v2_internal_writes();

create or replace function public.internal_sanitario_sync_v2_authorize(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_id text,
  operation_kind text,
  allowed_roles public.farm_role_enum[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_gate public.sanitario_sync_v2_gates%rowtype;
  v_role public.farm_role_enum;
begin
  if current_user <> 'service_role' then
    raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if actor_user_id is null or fazenda_id is null or contract_version is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  if operation_kind not in ('agenda_create', 'agenda_targets_replace', 'factual_core', 'administrative_closure') then
    raise exception 'SANITARIO_OPERATION_NOT_ALLOWLISTED' using errcode = '42501';
  end if;
  -- user_fazendas.user_id possui FK autoritativa para auth.users; consultar a
  -- superficie publica evita ampliar SELECT de service_role sobre auth.users.
  if not exists (
    select 1 from public.user_fazendas actor_membership
    where actor_membership.user_id = actor_user_id
  ) then
    raise exception 'SANITARIO_ACTOR_NOT_FOUND' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.fazendas f
    where f.id = fazenda_id and f.deleted_at is null
  ) then
    raise exception 'SANITARIO_FARM_NOT_FOUND' using errcode = '23503';
  end if;
  select uf.role
    into v_role
    from public.user_fazendas uf
   where uf.user_id = actor_user_id
     and uf.fazenda_id = fazenda_id
     and uf.deleted_at is null;
  if v_role is null then
    raise exception 'SANITARIO_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if allowed_roles is null or not (v_role = any(allowed_roles)) then
    raise exception 'SANITARIO_ROLE_NOT_ALLOWED' using errcode = '42501';
  end if;
  select g.* into v_gate
    from public.sanitario_sync_v2_gates g
   where g.fazenda_id = fazenda_id;
  if not found or not v_gate.enabled then
    raise exception 'SANITARIO_SYNC_DISABLED' using errcode = '42501';
  end if;
  if contract_version < v_gate.minimum_contract_version
     or contract_version > v_gate.maximum_contract_version then
    raise exception 'SANITARIO_CLIENT_CONTRACT_OUTDATED' using errcode = '22023';
  end if;
  if (v_gate.valid_from is not null and now() < v_gate.valid_from)
     or (v_gate.valid_until is not null and now() >= v_gate.valid_until) then
    raise exception 'SANITARIO_SYNC_NOT_ENABLED_FOR_FARM' using errcode = '42501';
  end if;
  if cardinality(v_gate.allowed_user_ids) > 0
     and not (actor_user_id = any(v_gate.allowed_user_ids)) then
    raise exception 'SANITARIO_SYNC_NOT_ENABLED_FOR_FARM' using errcode = '42501';
  end if;
  if cardinality(v_gate.allowed_client_ids) > 0
     and not (client_id = any(v_gate.allowed_client_ids)) then
    raise exception 'SANITARIO_SYNC_NOT_ENABLED_FOR_FARM' using errcode = '42501';
  end if;
  if abs(pg_catalog.hashtextextended(actor_user_id::text, 0) % 100) >= v_gate.rollout_percentage then
    raise exception 'SANITARIO_SYNC_NOT_ENABLED_FOR_FARM' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.internal_sanitario_sync_v2_existing_result(
  fazenda_id uuid,
  operation_kind text,
  entity_id uuid,
  client_op_id uuid,
  domain_op_id uuid,
  request_fingerprint text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_op public.sanitario_sync_v2_operations%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(fazenda_id::text || ':' || domain_op_id::text, 0)
  );
  select o.* into v_op
    from public.sanitario_sync_v2_operations o
   where o.fazenda_id = fazenda_id
     and (o.client_op_id = client_op_id
       or (o.operation_kind = operation_kind and o.domain_op_id = domain_op_id))
   order by (o.client_op_id = client_op_id) desc
   limit 1;
  if not found then
    return null;
  end if;
  if v_op.operation_kind <> operation_kind
     or v_op.entity_id <> entity_id
     or v_op.client_op_id <> client_op_id
     or v_op.domain_op_id <> domain_op_id
     or v_op.request_fingerprint <> request_fingerprint then
    raise exception 'SANITARIO_IDEMPOTENCY_CONFLICT' using errcode = '23505';
  end if;
  return v_op.canonical_result;
end;
$$;

create or replace function public.internal_sanitario_sync_v2_create_agenda(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  payload public.sanitario_sync_v2_agenda_input,
  animal_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, payload.client_id,
    'agenda_create', array['owner','manager']::public.farm_role_enum[]
  );
  if client_op_id is null or domain_op_id is null or payload.id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  v_count := coalesce(cardinality(animal_ids), 0);
  if v_count = 0 or v_count > 500
     or pg_column_size(pg_catalog.jsonb_build_object('payload', to_jsonb(payload), 'animal_ids', to_jsonb(animal_ids))) > 1048576 then
    raise exception 'SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED' using errcode = '54000';
  end if;
  if (select count(distinct x) from unnest(animal_ids) x) <> v_count or array_position(animal_ids, null) is not null then
    raise exception 'SANITARIO_AGENDA_TARGETS_INVALID' using errcode = '22023';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'payload', to_jsonb(payload), 'animal_ids', to_jsonb(animal_ids)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'agenda_create', payload.id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.animais a where a.fazenda_id = fazenda_id and a.id = any(animal_ids) and a.deleted_at is null) <> v_count then
    raise exception 'SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING' using errcode = '23503';
  end if;
  perform pg_catalog.set_config('statement_timeout', '10s', true);
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  insert into public.sanitario_agenda_v2(
    id, fazenda_id, status, revision, contract_version, domain_op_id, dedup_key,
    client_id, client_op_id, client_tx_id, client_recorded_at, source_demand_key,
    preview_group_id, protocolo_id, protocol_item_version_id, protocol_item_snapshot,
    janela_inicio, janela_fim, data_programada, lote_id, produto_snapshot,
    produto_classe, acao_sanitaria, metadata
  ) values (
    payload.id, fazenda_id, 'programada', 0, contract_version, domain_op_id, payload.dedup_key,
    payload.client_id, client_op_id, payload.client_tx_id, payload.client_recorded_at,
    payload.source_demand_key, payload.preview_group_id, payload.protocolo_id,
    payload.protocol_item_version_id, coalesce(payload.protocol_item_snapshot, '{}'::jsonb),
    payload.janela_inicio, payload.janela_fim, payload.data_programada, payload.lote_id,
    coalesce(payload.produto_snapshot, '{}'::jsonb), payload.produto_classe,
    payload.acao_sanitaria, coalesce(payload.metadata, '{}'::jsonb)
  );
  insert into public.sanitario_agenda_animais_v2(agenda_id, fazenda_id, animal_id)
  select payload.id, fazenda_id, x from unnest(animal_ids) x;
  v_result := pg_catalog.jsonb_build_object(
    'agenda_id', payload.id, 'status', 'programada', 'revision', 0,
    'animal_ids', to_jsonb(animal_ids), 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'agenda_create', payload.id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;

create or replace function public.internal_sanitario_sync_v2_replace_agenda_animals(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  expected_revision bigint,
  agenda_id uuid,
  client_id text,
  animal_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_agenda public.sanitario_agenda_v2%rowtype;
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, client_id,
    'agenda_targets_replace', array['owner','manager']::public.farm_role_enum[]
  );
  if expected_revision is null then
    raise exception 'SANITARIO_EXPECTED_REVISION_REQUIRED' using errcode = '22004';
  end if;
  if client_op_id is null or domain_op_id is null or agenda_id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  v_count := coalesce(cardinality(animal_ids), 0);
  if v_count = 0 or v_count > 500
     or pg_column_size(pg_catalog.jsonb_build_object('agenda_id', agenda_id, 'animal_ids', to_jsonb(animal_ids))) > 1048576 then
    raise exception 'SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED' using errcode = '54000';
  end if;
  if (select count(distinct x) from unnest(animal_ids) x) <> v_count or array_position(animal_ids, null) is not null then
    raise exception 'SANITARIO_AGENDA_TARGETS_INVALID' using errcode = '22023';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'expected_revision', expected_revision,
    'agenda_id', agenda_id, 'client_id', client_id, 'animal_ids', to_jsonb(animal_ids)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'agenda_targets_replace', agenda_id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  select a.* into v_agenda from public.sanitario_agenda_v2 a
   where a.id = agenda_id and a.fazenda_id = fazenda_id for update;
  if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode = '23503'; end if;
  if v_agenda.revision <> expected_revision then
    raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = '40001';
  end if;
  if v_agenda.status <> 'programada'::public.sanitario_agenda_v2_status_enum then
    raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode = '55000';
  end if;
  if (select count(*) from public.animais a where a.fazenda_id = fazenda_id and a.id = any(animal_ids) and a.deleted_at is null) <> v_count then
    raise exception 'SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING' using errcode = '23503';
  end if;
  perform pg_catalog.set_config('statement_timeout', '10s', true);
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  delete from public.sanitario_agenda_animais_v2 aa
   where aa.agenda_id = agenda_id and aa.fazenda_id = fazenda_id;
  insert into public.sanitario_agenda_animais_v2(agenda_id, fazenda_id, animal_id)
  select agenda_id, fazenda_id, x from unnest(animal_ids) x;
  update public.sanitario_agenda_v2 a
     set revision = a.revision + 1
   where a.id = agenda_id and a.fazenda_id = fazenda_id;
  v_result := pg_catalog.jsonb_build_object(
    'agenda_id', agenda_id, 'status', 'programada', 'revision', expected_revision + 1,
    'animal_ids', to_jsonb(animal_ids), 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'agenda_targets_replace', agenda_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;

create or replace function public.internal_sanitario_sync_v2_apply_factual_core(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  expected_revision bigint,
  event_payload public.sanitario_sync_v2_event_input,
  detail_payload public.sanitario_sync_v2_detail_input,
  event_animals public.sanitario_sync_v2_event_animal_input[]
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_agenda public.sanitario_agenda_v2%rowtype;
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
  v_animal_ids uuid[];
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, event_payload.client_id,
    'factual_core', array['owner','manager','cowboy']::public.farm_role_enum[]
  );
  if client_op_id is null or domain_op_id is null or event_payload.id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  if event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
     and event_payload.source_sanitario_agenda_v2_id is not null
     and expected_revision is null then
    raise exception 'SANITARIO_EXPECTED_REVISION_REQUIRED' using errcode = '22004';
  end if;
  v_count := coalesce(cardinality(event_animals), 0);
  if v_count = 0 or v_count > 500
     or pg_column_size(pg_catalog.jsonb_build_object(
       'event', to_jsonb(event_payload), 'detail', to_jsonb(detail_payload), 'animals', to_jsonb(event_animals)
     )) > 1048576 then
    raise exception 'SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED' using errcode = '54000';
  end if;
  select array_agg((x).animal_id order by (x).animal_id) into v_animal_ids from unnest(event_animals) x;
  if (select count(distinct (x).id) from unnest(event_animals) x) <> v_count
     or (select count(distinct (x).animal_id) from unnest(event_animals) x) <> v_count
     or exists (select 1 from unnest(event_animals) x where (x).id is null or (x).animal_id is null) then
    raise exception 'SANITARIO_EVENT_ANIMALS_INVALID' using errcode = '22023';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'expected_revision', expected_revision,
    'event', to_jsonb(event_payload), 'detail', to_jsonb(detail_payload), 'animals', to_jsonb(event_animals)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'factual_core', event_payload.id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.animais a where a.fazenda_id = fazenda_id and a.id = any(v_animal_ids) and a.deleted_at is null) <> v_count then
    raise exception 'SANITARIO_EVENT_ANIMAL_CROSS_FARM_OR_MISSING' using errcode = '23503';
  end if;
  if event_payload.source_sanitario_agenda_v2_id is not null
     and event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum then
    select a.* into v_agenda from public.sanitario_agenda_v2 a
     where a.id = event_payload.source_sanitario_agenda_v2_id and a.fazenda_id = fazenda_id for update;
    if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode = '23503'; end if;
    if v_agenda.revision <> expected_revision then
      raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = '40001';
    end if;
    if v_agenda.status <> 'programada'::public.sanitario_agenda_v2_status_enum then
      raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode = '55000';
    end if;
    if exists (
      (select aa.animal_id from public.sanitario_agenda_animais_v2 aa
        where aa.agenda_id = v_agenda.id and aa.fazenda_id = fazenda_id)
      except
      (select unnest(v_animal_ids))
    ) or exists (
      (select unnest(v_animal_ids))
      except
      (select aa.animal_id from public.sanitario_agenda_animais_v2 aa
        where aa.agenda_id = v_agenda.id and aa.fazenda_id = fazenda_id)
    ) then
      raise exception 'SANITARIO_EVENT_ANIMALS_MUST_MATCH_AGENDA' using errcode = '22023';
    end if;
  elsif event_payload.source_sanitario_agenda_v2_id is not null
        and event_payload.natureza <> 'correction'::public.sanitario_sync_v2_event_nature_enum then
    raise exception 'SANITARIO_AGENDA_SOURCE_REQUIRES_PRIMARY_EXECUTION' using errcode = '22023';
  end if;
  if event_payload.natureza = 'correction'::public.sanitario_sync_v2_event_nature_enum
     and not exists (
       select 1 from public.eventos e
       where e.id = event_payload.corrige_evento_id and e.fazenda_id = fazenda_id
         and e.dominio = 'sanitario'::public.dominio_enum and e.deleted_at is null
     ) then
    raise exception 'SANITARIO_CORRECTED_EVENT_NOT_FOUND' using errcode = '23503';
  end if;
  perform pg_catalog.set_config('statement_timeout', '10s', true);
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  insert into public.eventos(
    id, fazenda_id, dominio, occurred_at, animal_id, lote_id,
    source_sanitario_agenda_v2_id, corrige_evento_id, observacoes, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at,
    sanitario_sync_v2_nature, sanitario_contract_version, domain_op_id
  ) values (
    event_payload.id, fazenda_id, 'sanitario', event_payload.occurred_at,
    event_payload.animal_id, event_payload.lote_id,
    event_payload.source_sanitario_agenda_v2_id, event_payload.corrige_evento_id,
    event_payload.observacoes, coalesce(event_payload.payload, '{}'::jsonb),
    event_payload.client_id, client_op_id, event_payload.client_tx_id,
    event_payload.client_recorded_at, event_payload.natureza, contract_version, domain_op_id
  );
  insert into public.eventos_sanitario(
    evento_id, fazenda_id, tipo, produto, payload, client_id, client_op_id,
    client_tx_id, client_recorded_at, produto_sanitario_v2_id, insumo_id,
    produto_nome_snapshot, produto_snapshot, estoque_lote_id,
    estoque_lote_codigo_snapshot, lote_fabricante, validade_produto,
    dose_quantidade, dose_unidade, via_aplicacao, responsavel_nome, responsavel_tipo,
    carencia_carne_dias, carencia_leite_dias, carencia_carne_ate, carencia_leite_ate,
    custo_unitario_snapshot, custo_total_snapshot, sanitario_contract_version, domain_op_id
  ) values (
    event_payload.id, fazenda_id, detail_payload.tipo,
    coalesce(nullif(btrim(detail_payload.produto_nome_snapshot), ''), 'Produto sanitario v2'),
    coalesce(detail_payload.payload, '{}'::jsonb), event_payload.client_id, client_op_id,
    event_payload.client_tx_id, event_payload.client_recorded_at,
    detail_payload.produto_sanitario_v2_id, detail_payload.insumo_id,
    detail_payload.produto_nome_snapshot, coalesce(detail_payload.produto_snapshot, '{}'::jsonb),
    detail_payload.estoque_lote_id, detail_payload.estoque_lote_codigo_snapshot,
    detail_payload.lote_fabricante, detail_payload.validade_produto,
    detail_payload.dose_quantidade, detail_payload.dose_unidade, detail_payload.via_aplicacao,
    detail_payload.responsavel_nome, detail_payload.responsavel_tipo,
    detail_payload.carencia_carne_dias, detail_payload.carencia_leite_dias,
    detail_payload.carencia_carne_ate, detail_payload.carencia_leite_ate,
    detail_payload.custo_unitario_snapshot, detail_payload.custo_total_snapshot,
    contract_version, domain_op_id
  );
  insert into public.eventos_animais(id, fazenda_id, evento_id, animal_id)
  select (x).id, fazenda_id, event_payload.id, (x).animal_id from unnest(event_animals) x;
  if event_payload.source_sanitario_agenda_v2_id is not null
     and event_payload.natureza = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum then
    update public.sanitario_agenda_animais_v2 aa
       set planned_status = 'executado', execution_evento_id = event_payload.id
     where aa.agenda_id = event_payload.source_sanitario_agenda_v2_id
       and aa.fazenda_id = fazenda_id;
    update public.sanitario_agenda_v2 a
       set status = 'fechada', revision = a.revision + 1
     where a.id = event_payload.source_sanitario_agenda_v2_id
       and a.fazenda_id = fazenda_id;
  end if;
  v_result := pg_catalog.jsonb_build_object(
    'evento_id', event_payload.id,
    'agenda_id', event_payload.source_sanitario_agenda_v2_id,
    'agenda_status', case when event_payload.source_sanitario_agenda_v2_id is null then null else 'fechada' end,
    'revision', case when event_payload.source_sanitario_agenda_v2_id is null then null else expected_revision + 1 end,
    'animal_ids', to_jsonb(v_animal_ids), 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'factual_core', event_payload.id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;

create or replace function public.internal_sanitario_sync_v2_close_agenda(
  actor_user_id uuid,
  fazenda_id uuid,
  contract_version integer,
  client_op_id uuid,
  domain_op_id uuid,
  expected_revision bigint,
  payload public.sanitario_sync_v2_closure_input
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
#variable_conflict use_variable
declare
  v_agenda public.sanitario_agenda_v2%rowtype;
  v_status public.sanitario_agenda_v2_status_enum;
  v_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
begin
  perform public.internal_sanitario_sync_v2_authorize(
    actor_user_id, fazenda_id, contract_version, payload.client_id,
    'administrative_closure', array['owner','manager']::public.farm_role_enum[]
  );
  if expected_revision is null then
    raise exception 'SANITARIO_EXPECTED_REVISION_REQUIRED' using errcode = '22004';
  end if;
  if client_op_id is null or domain_op_id is null or payload.id is null or payload.agenda_id is null then
    raise exception 'SANITARIO_SYNC_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  if payload.closure_type not in (
    'cancelled'::public.sanitario_agenda_closure_v2_type_enum,
    'dismissed'::public.sanitario_agenda_closure_v2_type_enum
  ) then
    raise exception 'SANITARIO_ADMINISTRATIVE_CLOSURE_TYPE_INVALID' using errcode = '22023';
  end if;
  v_status := case payload.closure_type
    when 'cancelled'::public.sanitario_agenda_closure_v2_type_enum then 'cancelada'::public.sanitario_agenda_v2_status_enum
    else 'dispensada'::public.sanitario_agenda_v2_status_enum
  end;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'contract_version', contract_version, 'expected_revision', expected_revision, 'payload', to_jsonb(payload)
  )::text);
  v_existing := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, 'administrative_closure', payload.id, client_op_id, domain_op_id, v_fingerprint
  );
  if v_existing is not null then return v_existing; end if;
  select a.* into v_agenda from public.sanitario_agenda_v2 a
   where a.id = payload.agenda_id and a.fazenda_id = fazenda_id for update;
  if not found then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode = '23503'; end if;
  if v_agenda.revision <> expected_revision then
    raise exception 'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = '40001';
  end if;
  if v_agenda.status <> 'programada'::public.sanitario_agenda_v2_status_enum
     or exists (
       select 1 from public.eventos e
       where e.fazenda_id = fazenda_id
         and e.source_sanitario_agenda_v2_id = payload.agenda_id
         and e.sanitario_sync_v2_nature = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
         and e.deleted_at is null
     ) then
    raise exception 'SANITARIO_AGENDA_NOT_EXECUTABLE' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('rebanhosync.sanitario_sync_v2_internal', 'on', true);
  insert into public.sanitario_agenda_closures_v2(
    id, fazenda_id, agenda_id, closure_type, dedup_key, client_id, client_op_id,
    client_tx_id, client_recorded_at, closed_at, closed_by, execution_evento_id,
    reason, partial_payload, metadata, contract_version, domain_op_id
  ) values (
    payload.id, fazenda_id, payload.agenda_id, payload.closure_type, payload.dedup_key,
    payload.client_id, client_op_id, payload.client_tx_id, payload.client_recorded_at,
    payload.closed_at, actor_user_id, null, payload.reason,
    coalesce(payload.partial_payload, '{}'::jsonb), coalesce(payload.metadata, '{}'::jsonb),
    contract_version, domain_op_id
  );
  update public.sanitario_agenda_v2 a
     set status = v_status, revision = a.revision + 1
   where a.id = payload.agenda_id and a.fazenda_id = fazenda_id;
  v_result := pg_catalog.jsonb_build_object(
    'closure_id', payload.id, 'agenda_id', payload.agenda_id,
    'status', v_status, 'revision', expected_revision + 1, 'replayed', false
  );
  insert into public.sanitario_sync_v2_operations(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id,
    actor_user_id, contract_version, request_fingerprint, canonical_result
  ) values (
    fazenda_id, 'administrative_closure', payload.id, client_op_id, domain_op_id,
    actor_user_id, contract_version, v_fingerprint, v_result
  );
  return v_result;
end;
$$;

revoke execute on function public.prevent_eventos_animais_mutation() from public, anon, authenticated;
revoke execute on function public.guard_sanitario_sync_v2_internal_writes() from public, anon, authenticated;
revoke execute on function public.internal_sanitario_sync_v2_authorize(uuid, uuid, integer, text, text, public.farm_role_enum[]) from public, anon, authenticated;
revoke execute on function public.internal_sanitario_sync_v2_existing_result(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.internal_sanitario_sync_v2_create_agenda(uuid, uuid, integer, uuid, uuid, public.sanitario_sync_v2_agenda_input, uuid[]) from public, anon, authenticated;
revoke execute on function public.internal_sanitario_sync_v2_replace_agenda_animals(uuid, uuid, integer, uuid, uuid, bigint, uuid, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.internal_sanitario_sync_v2_apply_factual_core(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_event_input, public.sanitario_sync_v2_detail_input, public.sanitario_sync_v2_event_animal_input[]) from public, anon, authenticated;
revoke execute on function public.internal_sanitario_sync_v2_close_agenda(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_closure_input) from public, anon, authenticated;

grant execute on function public.prevent_eventos_animais_mutation() to service_role;
grant execute on function public.guard_sanitario_sync_v2_internal_writes() to service_role;
grant execute on function public.internal_sanitario_sync_v2_authorize(uuid, uuid, integer, text, text, public.farm_role_enum[]) to service_role;
grant execute on function public.internal_sanitario_sync_v2_existing_result(uuid, text, uuid, uuid, uuid, text) to service_role;
grant execute on function public.internal_sanitario_sync_v2_create_agenda(uuid, uuid, integer, uuid, uuid, public.sanitario_sync_v2_agenda_input, uuid[]) to service_role;
grant execute on function public.internal_sanitario_sync_v2_replace_agenda_animals(uuid, uuid, integer, uuid, uuid, bigint, uuid, text, uuid[]) to service_role;
grant execute on function public.internal_sanitario_sync_v2_apply_factual_core(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_event_input, public.sanitario_sync_v2_detail_input, public.sanitario_sync_v2_event_animal_input[]) to service_role;
grant execute on function public.internal_sanitario_sync_v2_close_agenda(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_closure_input) to service_role;

revoke usage on type public.sanitario_sync_v2_event_nature_enum from public, anon;
revoke usage on type public.sanitario_sync_v2_agenda_input from public, anon, authenticated;
revoke usage on type public.sanitario_sync_v2_event_input from public, anon, authenticated;
revoke usage on type public.sanitario_sync_v2_detail_input from public, anon, authenticated;
revoke usage on type public.sanitario_sync_v2_event_animal_input from public, anon, authenticated;
revoke usage on type public.sanitario_sync_v2_closure_input from public, anon, authenticated;
grant usage on type public.sanitario_sync_v2_event_nature_enum to service_role;
grant usage on type public.sanitario_sync_v2_event_nature_enum to authenticated;
grant usage on type public.sanitario_sync_v2_agenda_input to service_role;
grant usage on type public.sanitario_sync_v2_event_input to service_role;
grant usage on type public.sanitario_sync_v2_detail_input to service_role;
grant usage on type public.sanitario_sync_v2_event_animal_input to service_role;
grant usage on type public.sanitario_sync_v2_closure_input to service_role;

comment on table public.eventos_animais is
  'Relacao factual append-only Evento-Animal; payload.animal_ids nao substitui esta fonte.';
comment on table public.sanitario_sync_v2_gates is
  'Gate autoritativo persistido do push sanitario v2. Nasce sem linhas e falha fechado.';
comment on table public.sanitario_sync_v2_operations is
  'Ledger interno de idempotencia do Sync Sanitario v2 por client_op_id e domain_op_id.';
comment on column public.sanitario_agenda_v2.execution_evento_id is
  'Legado somente leitura. No contrato v2, eventos.source_sanitario_agenda_v2_id e a unica FK factual canonica.';
comment on column public.eventos_sanitario.produto_veterinario_id is
  'Referencia legada somente para leitura de eventos antigos; novas escritas v2 devem manter NULL.';
comment on function public.internal_sanitario_sync_v2_create_agenda(uuid, uuid, integer, uuid, uuid, public.sanitario_sync_v2_agenda_input, uuid[]) is
  'Interna, SECURITY INVOKER e exclusiva de service_role: cria agenda e conjunto completo de animais atomicamente.';
comment on function public.internal_sanitario_sync_v2_apply_factual_core(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_event_input, public.sanitario_sync_v2_detail_input, public.sanitario_sync_v2_event_animal_input[]) is
  'Interna, SECURITY INVOKER e exclusiva de service_role: persiste nucleo factual e fecha agenda sob revision.';
comment on function public.internal_sanitario_sync_v2_close_agenda(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_closure_input) is
  'Interna, SECURITY INVOKER e exclusiva de service_role: closure administrativa e transicao atomicas.';
