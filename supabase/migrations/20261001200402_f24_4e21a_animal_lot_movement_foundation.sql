-- F24.4E2.1A: Animal -> Lote server foundation. Forward-only; no semantic backfill.
-- No Edge/client integration or dependency executor in this increment.
-- The guard is the ONLY movement_version incrementer. RPC writes lote/head, never version.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'rebanhosync_movement_executor') then
    create role rebanhosync_movement_executor nologin noinherit nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'rebanhosync_movement_executor'
    and (rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreaterole))
    or exists (select 1 from pg_catalog.pg_auth_members m
      join pg_catalog.pg_roles r on r.oid = m.roleid
      join pg_catalog.pg_roles member_role on member_role.oid = m.member
      where r.rolname = 'rebanhosync_movement_executor'
        and member_role.rolname not in ('postgres', 'supabase_admin')) then
    raise exception using errcode = '42501', message = 'MOVEMENT_EXECUTOR_ROLE_NOT_PRIVATE';
  end if;
end;
$$;
-- Only the trusted migration administrator can assume this role. No API role membership.
grant rebanhosync_movement_executor to postgres;
grant usage, create on schema public to rebanhosync_movement_executor;
grant usage on schema extensions to rebanhosync_movement_executor;
grant execute on function public.has_membership(uuid),
  public.role_in_fazenda(uuid, public.farm_role_enum[]) to rebanhosync_movement_executor;

-- auth schema is owned by the platform; postgres cannot delegate its USAGE grant.
-- A narrow accessor evaluates the actual JWT context, never a client-supplied actor.
create function public.animal_lot_movement_actor_uid_v1()
returns uuid language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid();
$$;
revoke all on function public.animal_lot_movement_actor_uid_v1() from public, anon, authenticated, service_role;
grant execute on function public.animal_lot_movement_actor_uid_v1() to rebanhosync_movement_executor;

alter table public.animais
  add column movement_version bigint not null default 0,
  add column movement_head_event_id uuid,
  add constraint chk_animais_movement_version_nonnegative check (movement_version >= 0),
  add constraint fk_animais_movement_head_farm foreign key (movement_head_event_id, fazenda_id)
    references public.eventos(id, fazenda_id);

create table public.animal_lot_movement_receipts (
  fazenda_id uuid not null references public.fazendas(id),
  command_type text not null default 'apply_movement_operation'
    check (command_type = 'apply_movement_operation'),
  event_id uuid not null,
  animal_id uuid not null,
  client_tx_id uuid not null,
  client_op_id uuid not null,
  command_digest text not null check (command_digest ~ '^[0-9a-f]{64}$'),
  command_input jsonb not null,
  result text not null check (result in ('STATE_APPLIED', 'HISTORY_ONLY', 'HISTORY_CONFLICT',
    'PENDING_CAUSAL_DEPENDENCY', 'PROJECTION_CONFLICT')),
  effect_classification text not null,
  reason_code text,
  movement_version_before bigint not null,
  movement_version_after bigint not null,
  head_before uuid,
  head_after uuid,
  animal_revision_before bigint not null,
  animal_revision_after bigint not null,
  from_lote_id uuid,
  to_lote_id uuid not null,
  predecessor_event_id uuid,
  predecessor_command_digest text check (predecessor_command_digest ~ '^[0-9a-f]{64}$'),
  actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  receipt jsonb not null,
  primary key (fazenda_id, command_type, event_id),
  unique (fazenda_id, client_op_id),
  constraint fk_movement_receipt_event foreign key (event_id, fazenda_id)
    references public.eventos(id, fazenda_id),
  constraint fk_movement_receipt_animal foreign key (animal_id, fazenda_id)
    references public.animais(id, fazenda_id),
  constraint fk_movement_receipt_from foreign key (from_lote_id, fazenda_id)
    references public.lotes(id, fazenda_id),
  constraint fk_movement_receipt_to foreign key (to_lote_id, fazenda_id)
    references public.lotes(id, fazenda_id),
  check ((predecessor_event_id is null) = (predecessor_command_digest is null)),
  check (effect_classification = result),
  check (movement_version_after >= movement_version_before)
);
-- A missing predecessor cannot have an FK. The indexed receipt is durable dependency work.
create index idx_animal_lot_movement_pending_parent on public.animal_lot_movement_receipts
  (fazenda_id, predecessor_event_id) where result = 'PENDING_CAUSAL_DEPENDENCY';
alter table public.animal_lot_movement_receipts enable row level security;
create policy animal_lot_movement_receipts_read on public.animal_lot_movement_receipts
  for select to authenticated, rebanhosync_movement_executor
  using (public.has_membership(fazenda_id));
create policy animal_lot_movement_receipts_insert on public.animal_lot_movement_receipts
  for insert to rebanhosync_movement_executor
  with check (public.has_membership(fazenda_id) and actor_id = public.animal_lot_movement_actor_uid_v1());
revoke all on public.animal_lot_movement_receipts from public, anon, authenticated, service_role;
grant select on public.animal_lot_movement_receipts to authenticated;
grant select, insert on public.animal_lot_movement_receipts to rebanhosync_movement_executor;
grant select on public.animais, public.lotes, public.eventos, public.eventos_movimentacao,
  public.agenda_itens to rebanhosync_movement_executor;
grant update (lote_id, movement_head_event_id, client_id, client_op_id, client_tx_id,
  client_recorded_at) on public.animais to rebanhosync_movement_executor;
-- PostgreSQL row-lock privilege; the RPC never updates lots.
grant update (status) on public.lotes to rebanhosync_movement_executor;
create policy lotes_movement_lock on public.lotes for update to rebanhosync_movement_executor
  using (public.has_membership(fazenda_id)) with check (false);
grant insert on public.eventos, public.eventos_movimentacao to rebanhosync_movement_executor;

create function public.guard_animal_movement_projection()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception using errcode = '42501', message = 'MOVEMENT_HARD_DELETE_FORBIDDEN';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.movement_version <> 0 or new.movement_head_event_id is not null then
      raise exception using errcode = '42501', message = 'MOVEMENT_METADATA_SERVER_OWNED';
    end if;
    -- Initial cadastro/import/purchase location is a technical checkpoint, not a movement.
    return new;
  end if;
  if new.id is distinct from old.id or new.fazenda_id is distinct from old.fazenda_id then
    raise exception using errcode = '42501', message = 'MOVEMENT_SUBJECT_IMMUTABLE';
  end if;
  if new.movement_version is distinct from old.movement_version then
    raise exception using errcode = '42501', message = 'MOVEMENT_METADATA_SERVER_OWNED';
  end if;
  if new.movement_head_event_id is distinct from old.movement_head_event_id
     and current_user <> 'rebanhosync_movement_executor' then
    raise exception using errcode = '42501', message = 'MOVEMENT_HEAD_SERVER_OWNED';
  end if;
  if new.lote_id is distinct from old.lote_id
     and current_user <> 'rebanhosync_movement_executor'
     -- Existing exits may clear location; cannot assign a new operational destination.
     and not (new.lote_id is null and (new.status <> 'ativo' or new.deleted_at is not null)) then
    raise exception using errcode = '42501', message = 'MOVEMENT_COMMAND_REQUIRED';
  end if;
  if new.lote_id is distinct from old.lote_id or new.status is distinct from old.status
     or new.deleted_at is distinct from old.deleted_at
     or new.movement_head_event_id is distinct from old.movement_head_event_id then
    new.movement_version := old.movement_version + 1;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_animal_movement_projection() from public, anon, authenticated, service_role;
create trigger trg_animais_movement_projection_guard before insert or update or delete
  on public.animais for each row execute function public.guard_animal_movement_projection();

create function public.guard_movement_receipt_immutable()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = '42501', message = 'MOVEMENT_RECEIPT_IMMUTABLE';
end;
$$;
revoke all on function public.guard_movement_receipt_immutable() from public, anon, authenticated, service_role;
create trigger trg_animal_lot_movement_receipt_immutable before update or delete
  on public.animal_lot_movement_receipts for each row
  execute function public.guard_movement_receipt_immutable();

-- Protect command-managed facts, including metadata tombstones, without changing other domains.
create function public.guard_movement_fact_immutable()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_event_id uuid;
begin
  if tg_table_name = 'eventos' then v_event_id := old.id;
  else v_event_id := old.evento_id; end if;
  if exists (select 1 from public.animal_lot_movement_receipts where event_id = v_event_id) then
    raise exception using errcode = '42501', message = 'MOVEMENT_FACT_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_movement_fact_immutable() from public, anon, authenticated, service_role;
create trigger trg_eventos_movement_fact_immutable before update or delete on public.eventos
  for each row execute function public.guard_movement_fact_immutable();
create trigger trg_eventos_movimentacao_fact_immutable before update or delete on public.eventos_movimentacao
  for each row execute function public.guard_movement_fact_immutable();

-- Deterministic UTF-8 canonicalization, object keys in C order, numeric scale normalized.
create function public.movement_command_canonical_json_v1(p_value jsonb)
returns text language sql immutable strict set search_path = pg_catalog as $$
  select case jsonb_typeof(p_value)
    when 'object' then (select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' ||
      public.movement_command_canonical_json_v1(value), ',' order by key collate "C"), '') || '}'
      from jsonb_each(p_value))
    when 'array' then (select '[' || coalesce(string_agg(public.movement_command_canonical_json_v1(value),
      ',' order by ordinality), '') || ']' from jsonb_array_elements(p_value) with ordinality)
    when 'number' then trim_scale((p_value #>> '{}')::numeric)::text
    else p_value::text end;
$$;

create function public.normalize_animal_lot_movement_v1(p_command jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare
  v_farm uuid; v_animal uuid; v_event uuid; v_op uuid; v_tx uuid;
  v_from uuid; v_to uuid; v_time timestamptz; v_mode text; v_base jsonb;
  v_parent uuid; v_head uuid; v_version bigint; v_task uuid;
begin
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text) > 65536 then
    raise exception using errcode = '22023', message = 'MOVEMENT_INPUT_INVALID';
  end if;
  if exists (select 1 from jsonb_object_keys(p_command) k where k not in
    ('contract_version','fazenda_id','subject_type','subject_id','event_id','client_op_id','client_tx_id',
     'movement_mode','from_lote_id','to_lote_id','occurred_at','movement_base','source_task_id',
     'corrige_evento_id','observacoes','payload','detail_payload')) then
    raise exception using errcode = '22023', message = 'MOVEMENT_UNKNOWN_FIELD';
  end if;
  if p_command->'contract_version' is distinct from '1'::jsonb
     or p_command->>'subject_type' is distinct from 'animal'
     or p_command->>'movement_mode' is null
     or p_command->>'movement_mode' not in ('operational','history_only') then
    raise exception using errcode = '22023', message = 'MOVEMENT_CONTRACT_INVALID';
  end if;
  if exists (select 1 from unnest(array['fazenda_id','subject_id','event_id','client_op_id',
    'client_tx_id','to_lote_id','occurred_at']) k
    where jsonb_typeof(p_command->k) is distinct from 'string')
    or not p_command ? 'from_lote_id'
    or jsonb_typeof(p_command->'from_lote_id') not in ('string','null')
    or coalesce(jsonb_typeof(p_command->'payload'), 'object') <> 'object'
    or coalesce(jsonb_typeof(p_command->'detail_payload'), 'object') <> 'object'
    or (p_command->>'observacoes' is not null and jsonb_typeof(p_command->'observacoes') <> 'string') then
    raise exception using errcode = '22023', message = 'MOVEMENT_FIELDS_INVALID';
  end if;
  if p_command->>'corrige_evento_id' is not null then
    raise exception using errcode = '22023', message = 'MOVEMENT_CORRECTION_NOT_SUPPORTED';
  end if;
  v_farm := (p_command->>'fazenda_id')::uuid; v_animal := (p_command->>'subject_id')::uuid;
  v_event := (p_command->>'event_id')::uuid; v_op := (p_command->>'client_op_id')::uuid;
  v_tx := (p_command->>'client_tx_id')::uuid; v_from := (p_command->>'from_lote_id')::uuid;
  v_to := (p_command->>'to_lote_id')::uuid; v_task := (p_command->>'source_task_id')::uuid;
  if v_from is not distinct from v_to then
    raise exception using errcode = '22023', message = 'MOVEMENT_NO_TRANSITION';
  end if;
  if p_command->>'occurred_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception using errcode = '22023', message = 'MOVEMENT_FACTUAL_TIME_INVALID';
  end if;
  v_time := (p_command->>'occurred_at')::timestamptz;
  v_mode := p_command->>'movement_mode'; v_base := p_command->'movement_base';
  if v_mode = 'history_only' then
    if v_base is not null and v_base <> 'null'::jsonb then
      raise exception using errcode = '22023', message = 'MOVEMENT_HISTORY_SELECTOR_INVALID';
    end if;
    v_base := 'null'::jsonb;
  elsif jsonb_typeof(v_base) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'MOVEMENT_SELECTOR_REQUIRED';
  elsif v_base->>'kind' = 'snapshot' then
    if (select count(*) from jsonb_object_keys(v_base)) <> 3
       or not v_base ?& array['kind','movement_version','head_event_id']
       or jsonb_typeof(v_base->'movement_version') is distinct from 'string'
       or v_base->>'movement_version' !~ '^(0|[1-9][0-9]*)$'
       or jsonb_typeof(v_base->'head_event_id') not in ('null','string') then
      raise exception using errcode = '22023', message = 'MOVEMENT_SNAPSHOT_INVALID';
    end if;
    v_version := (v_base->>'movement_version')::bigint;
    v_head := (v_base->>'head_event_id')::uuid;
    v_base := jsonb_build_object('kind','snapshot','movement_version',v_version::text,'head_event_id',v_head);
  elsif v_base->>'kind' = 'after_movement' then
    if (select count(*) from jsonb_object_keys(v_base)) <> 3
       or not v_base ?& array['kind','event_id','command_digest']
       or jsonb_typeof(v_base->'event_id') is distinct from 'string'
       or coalesce(v_base->>'command_digest','') !~ '^[0-9a-f]{64}$' then
      raise exception using errcode = '22023', message = 'MOVEMENT_PREDECESSOR_INVALID';
    end if;
    v_parent := (v_base->>'event_id')::uuid;
    if v_parent = v_event then
      raise exception using errcode = '22023', message = 'MOVEMENT_SELF_PREDECESSOR';
    end if;
    v_base := jsonb_build_object('kind','after_movement','event_id',v_parent,
      'command_digest',v_base->>'command_digest');
  else
    raise exception using errcode = '22023', message = 'MOVEMENT_SELECTOR_INVALID';
  end if;
  return jsonb_build_object('contract_version',1,'fazenda_id',v_farm,'subject_type','animal',
    'subject_id',v_animal,'event_id',v_event,'client_op_id',v_op,'client_tx_id',v_tx,
    'movement_mode',v_mode,'from_lote_id',v_from,'to_lote_id',v_to,
    'occurred_at',to_char(v_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'movement_base',v_base,'source_task_id',v_task,'corrige_evento_id',null,
    'observacoes',p_command->>'observacoes','payload',coalesce(p_command->'payload','{}'::jsonb),
    'detail_payload',coalesce(p_command->'detail_payload','{}'::jsonb));
end;
$$;

create function public.animal_lot_movement_command_digest_v1(p_command jsonb)
returns text language sql immutable strict set search_path = pg_catalog as $$
  select encode(extensions.digest(convert_to(public.movement_command_canonical_json_v1(
    public.normalize_animal_lot_movement_v1(p_command)), 'UTF8'), 'sha256'), 'hex');
$$;
revoke all on function public.movement_command_canonical_json_v1(jsonb),
  public.normalize_animal_lot_movement_v1(jsonb), public.animal_lot_movement_command_digest_v1(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.movement_command_canonical_json_v1(jsonb),
  public.normalize_animal_lot_movement_v1(jsonb), public.animal_lot_movement_command_digest_v1(jsonb)
  to authenticated, rebanhosync_movement_executor;

create function public.apply_animal_lot_movement_v1(p_command jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_input jsonb; v_digest text; v_actor uuid := public.animal_lot_movement_actor_uid_v1();
  v_farm uuid; v_animal_id uuid; v_event uuid; v_op uuid; v_tx uuid;
  v_from uuid; v_to uuid; v_parent_id uuid; v_parent_digest text;
  v_animal public.animais%rowtype; v_after public.animais%rowtype;
  v_parent public.animal_lot_movement_receipts%rowtype;
  v_previous public.animal_lot_movement_receipts%rowtype;
  v_dest public.lotes%rowtype; v_expected bigint; v_head uuid;
  v_result text := 'STATE_APPLIED'; v_reason text; v_receipt jsonb; v_created timestamptz;
begin
  -- Authorize before ledger lookup. Never accept an actor ID supplied by the client.
  begin v_farm := (p_command->>'fazenda_id')::uuid;
  exception when data_exception then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_INPUT_INVALID');
  end;
  if v_actor is null or not public.has_membership(v_farm) then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_FORBIDDEN');
  end if;
  begin
    v_input := public.normalize_animal_lot_movement_v1(p_command);
    v_digest := public.animal_lot_movement_command_digest_v1(v_input);
  exception when data_exception then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_INPUT_INVALID');
  end;
  v_animal_id := (v_input->>'subject_id')::uuid; v_event := (v_input->>'event_id')::uuid;
  v_op := (v_input->>'client_op_id')::uuid; v_tx := (v_input->>'client_tx_id')::uuid;
  v_from := (v_input->>'from_lote_id')::uuid; v_to := (v_input->>'to_lote_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(v_farm::text || ':animal-lot:' || v_event::text, 0));
  select * into v_previous from public.animal_lot_movement_receipts
    where fazenda_id = v_farm and command_type = 'apply_movement_operation' and event_id = v_event;
  if found then
    if v_previous.command_digest <> v_digest then
      return jsonb_build_object('status','CONFLICT','reason_code','IDENTITY_DIVERGENCE');
    end if;
    return v_previous.receipt || jsonb_build_object('replayed',true);
  end if;
  if exists (select 1 from public.animal_lot_movement_receipts
    where fazenda_id = v_farm and client_op_id = v_op)
    or exists (select 1 from public.eventos where id = v_event) then
    return jsonb_build_object('status','CONFLICT','reason_code','IDENTITY_DIVERGENCE');
  end if;
  -- Lock lots in a stable order BEFORE the animal, compatible with commercial lot locks.
  perform id from public.lotes where fazenda_id = v_farm and id in (v_from, v_to)
    order by id for share;
  select * into v_dest from public.lotes where id = v_to and fazenda_id = v_farm;
  if not found or (v_from is not null and not exists
    (select 1 from public.lotes where id = v_from and fazenda_id = v_farm)) then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_LOT_INVALID');
  end if;
  if v_input->>'source_task_id' is not null and not exists
    (select 1 from public.agenda_itens where id = (v_input->>'source_task_id')::uuid and fazenda_id = v_farm) then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_TASK_INVALID');
  end if;
  select * into v_animal from public.animais where id = v_animal_id and fazenda_id = v_farm for update;
  if not found then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_ANIMAL_INVALID');
  end if;
  if v_input->>'movement_mode' = 'history_only' then v_result := 'HISTORY_ONLY';
  elsif v_input->'movement_base'->>'kind' = 'snapshot' then
    v_expected := (v_input->'movement_base'->>'movement_version')::bigint;
    v_head := (v_input->'movement_base'->>'head_event_id')::uuid;
    if v_head is not null and not exists (select 1 from public.animal_lot_movement_receipts
      where fazenda_id = v_farm and event_id = v_head and animal_id = v_animal_id and result = 'STATE_APPLIED') then
      return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_HEAD_INVALID');
    end if;
  else
    v_parent_id := (v_input->'movement_base'->>'event_id')::uuid;
    v_parent_digest := v_input->'movement_base'->>'command_digest';
    select * into v_parent from public.animal_lot_movement_receipts
      where fazenda_id = v_farm and event_id = v_parent_id;
    if not found then
      v_result := 'PENDING_CAUSAL_DEPENDENCY'; v_reason := 'PREDECESSOR_MISSING';
    elsif v_parent.animal_id <> v_animal_id or v_parent.command_digest <> v_parent_digest
      or v_parent.to_lote_id is distinct from v_from then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'PREDECESSOR_IDENTITY_OR_ORIGIN_DIVERGENCE';
    elsif v_parent.result = 'PENDING_CAUSAL_DEPENDENCY' then
      v_result := 'PENDING_CAUSAL_DEPENDENCY'; v_reason := 'PREDECESSOR_PENDING';
    elsif v_parent.result <> 'STATE_APPLIED' then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'PREDECESSOR_NOT_STATE_APPLIED';
    else
      v_expected := v_parent.movement_version_after; v_head := v_parent.head_after;
    end if;
    if exists (
      with recursive chain as (
        select event_id, predecessor_event_id from public.animal_lot_movement_receipts
          where fazenda_id = v_farm and event_id = v_parent_id
        union
        select r.event_id, r.predecessor_event_id from public.animal_lot_movement_receipts r
          join chain c on r.event_id = c.predecessor_event_id where r.fazenda_id = v_farm
      ) select 1 from chain where event_id = v_event or predecessor_event_id = v_event
    ) then v_result := 'HISTORY_CONFLICT'; v_reason := 'CAUSAL_CYCLE'; end if;
  end if;
  if v_result = 'STATE_APPLIED' then
    if v_animal.status <> 'ativo' or v_animal.deleted_at is not null then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'ANIMAL_NOT_ELIGIBLE';
    elsif v_dest.status <> 'ativo' or v_dest.deleted_at is not null then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'DESTINATION_NOT_ELIGIBLE';
    elsif v_animal.movement_version <> v_expected
      or v_animal.movement_head_event_id is distinct from v_head
      or v_animal.lote_id is distinct from v_from then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'MOVEMENT_LOCATION_CONFLICT';
    end if;
  end if;
  insert into public.eventos (id, fazenda_id, dominio, occurred_at, occurred_on, animal_id,
    lote_id, source_task_id, source_tx_id, source_client_op_id, observacoes, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at)
  values (v_event, v_farm, 'movimentacao', (v_input->>'occurred_at')::timestamptz,
    ((v_input->>'occurred_at')::timestamptz at time zone 'UTC')::date, v_animal_id, v_from,
    (v_input->>'source_task_id')::uuid, v_tx, v_op, v_input->>'observacoes', v_input->'payload',
    'movement-command-v1', v_op, v_tx, (v_input->>'occurred_at')::timestamptz);
  insert into public.eventos_movimentacao (evento_id, fazenda_id, from_lote_id, to_lote_id,
    payload, client_id, client_op_id, client_tx_id, client_recorded_at)
  values (v_event, v_farm, v_from, v_to, v_input->'detail_payload', 'movement-command-v1',
    v_op, v_tx, (v_input->>'occurred_at')::timestamptz);
  v_after := v_animal;
  if v_result = 'STATE_APPLIED' then
    update public.animais set lote_id = v_to, movement_head_event_id = v_event,
      client_id = 'movement-command-v1', client_op_id = v_op, client_tx_id = v_tx,
      client_recorded_at = (v_input->>'occurred_at')::timestamptz
    where id = v_animal_id and fazenda_id = v_farm and movement_version = v_expected
      and movement_head_event_id is not distinct from v_head and lote_id is not distinct from v_from
      and status = 'ativo' and deleted_at is null returning * into v_after;
    if not found then
      raise exception using errcode = '40001', message = 'MOVEMENT_LOCKED_CAS_CHANGED';
    end if;
  end if;
  v_created := clock_timestamp();
  v_receipt := jsonb_build_object('status',v_result,'reason_code',v_reason,'event_id',v_event,
    'fazenda_id',v_farm,'animal_id',v_animal_id,'command_digest',v_digest,'client_op_id',v_op,
    'client_tx_id',v_tx,'movement_version_before',v_animal.movement_version::text,
    'movement_version_after',v_after.movement_version::text,'head_before',v_animal.movement_head_event_id,
    'head_after',v_after.movement_head_event_id,'animal_revision_before',v_animal.revision::text,
    'animal_revision_after',v_after.revision::text,'created_at',v_created,'actor_id',v_actor,'replayed',false);
  insert into public.animal_lot_movement_receipts (fazenda_id, event_id, animal_id, client_tx_id,
    client_op_id, command_digest, command_input, result, effect_classification, reason_code,
    movement_version_before, movement_version_after, head_before, head_after,
    animal_revision_before, animal_revision_after, from_lote_id, to_lote_id,
    predecessor_event_id, predecessor_command_digest, actor_id, created_at, receipt)
  values (v_farm, v_event, v_animal_id, v_tx, v_op, v_digest, v_input, v_result, v_result, v_reason,
    v_animal.movement_version, v_after.movement_version, v_animal.movement_head_event_id,
    v_after.movement_head_event_id, v_animal.revision, v_after.revision, v_from, v_to,
    v_parent_id, v_parent_digest, v_actor, v_created, v_receipt);
  return v_receipt;
exception
  -- This block rolls back ALL earlier fact/state/receipt writes on structural constraints.
  -- Infrastructure/serialization errors propagate; they never become a durable business conflict.
  when unique_violation then
    return jsonb_build_object('status','CONFLICT','reason_code','IDENTITY_DIVERGENCE');
  when foreign_key_violation or check_violation or not_null_violation or data_exception then
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_INPUT_INVALID');
end;
$$;
alter function public.apply_animal_lot_movement_v1(jsonb) owner to rebanhosync_movement_executor;
revoke create on schema public from rebanhosync_movement_executor;
revoke all on function public.apply_animal_lot_movement_v1(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.apply_animal_lot_movement_v1(jsonb) to authenticated;

comment on column public.animais.movement_version is
  'Server projection-validity token. Only guard_animal_movement_projection increments; no client clock authority.';
comment on column public.animais.movement_head_event_id is
  'Last accepted movement provenance; eligibility invalidation does not fabricate another movement.';
comment on table public.animal_lot_movement_receipts is
  'Immutable technical effect receipts, not factual history. Indexed pending dependencies await a future server executor.';
