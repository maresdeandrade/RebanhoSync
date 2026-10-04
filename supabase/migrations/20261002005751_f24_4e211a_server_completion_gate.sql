-- F24.4E2.1A.1. Forward-only completion of the locally applied foundation.
-- No history/receipt rewrite, backfill, client integration or remote data operation.
grant create on schema public to rebanhosync_movement_executor;
create table public.animal_lot_movement_effect_decisions (
  fazenda_id uuid not null,
  command_type text not null default 'apply_movement_operation' check (command_type='apply_movement_operation'),
  event_id uuid not null,
  result text not null check (result in ('STATE_APPLIED','PROJECTION_CONFLICT','HISTORY_CONFLICT')),
  reason_code text,
  movement_version_before bigint not null,
  movement_version_after bigint not null,
  head_before uuid,
  head_after uuid,
  resolver_actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (fazenda_id,command_type,event_id),
  foreign key (fazenda_id,command_type,event_id)
    references public.animal_lot_movement_receipts(fazenda_id,command_type,event_id),
  check (movement_version_after >= movement_version_before),
  check ((result='STATE_APPLIED' and movement_version_after=movement_version_before+1 and head_after=event_id)
    or (result<>'STATE_APPLIED' and movement_version_after=movement_version_before and head_after is not distinct from head_before))
);
alter table public.animal_lot_movement_effect_decisions enable row level security;
create policy movement_effect_decisions_read on public.animal_lot_movement_effect_decisions
  for select to authenticated,rebanhosync_movement_executor using (public.has_membership(fazenda_id));
create policy movement_effect_decisions_insert on public.animal_lot_movement_effect_decisions
  for insert to rebanhosync_movement_executor with check (public.has_membership(fazenda_id)
    and resolver_actor_id=public.animal_lot_movement_actor_uid_v1());
revoke all on public.animal_lot_movement_effect_decisions from public,anon,authenticated,service_role;
grant select on public.animal_lot_movement_effect_decisions to authenticated;
grant select,insert on public.animal_lot_movement_effect_decisions to rebanhosync_movement_executor;
create trigger trg_movement_effect_decision_immutable before update or delete
  on public.animal_lot_movement_effect_decisions for each row
  execute function public.guard_movement_receipt_immutable();

create view public.animal_lot_movement_effective_results with (security_invoker=true) as
select r.*, coalesce(d.result,r.result) as effective_result,
  case when d.event_id is not null then d.reason_code else r.reason_code end as effective_reason_code,
  coalesce(d.movement_version_after,r.movement_version_after) as effective_movement_version_after,
  case when d.event_id is not null then d.head_after else r.head_after end as effective_head_after
from public.animal_lot_movement_receipts r left join public.animal_lot_movement_effect_decisions d
  using (fazenda_id,command_type,event_id);
revoke all on public.animal_lot_movement_effective_results from public,anon,authenticated,service_role;
grant select on public.animal_lot_movement_effective_results to authenticated,rebanhosync_movement_executor;

-- A normalized authorized REJECTED command has no valid factual Event to reference.
-- Keep its terminal technical identity separately so existing children cannot wait forever.
create table public.animal_lot_movement_command_rejections (
  fazenda_id uuid not null references public.fazendas(id),
  event_id uuid not null,
  animal_id uuid not null,
  client_op_id uuid not null,
  command_digest text not null check (command_digest ~ '^[0-9a-f]{64}$'),
  command_input jsonb not null,
  receipt jsonb not null,
  primary key(fazenda_id,event_id), unique(fazenda_id,client_op_id)
);
alter table public.animal_lot_movement_command_rejections enable row level security;
create policy movement_rejections_read on public.animal_lot_movement_command_rejections
  for select to authenticated,rebanhosync_movement_executor using (public.has_membership(fazenda_id));
create policy movement_rejections_insert on public.animal_lot_movement_command_rejections
  for insert to rebanhosync_movement_executor with check (public.has_membership(fazenda_id));
revoke all on public.animal_lot_movement_command_rejections from public,anon,authenticated,service_role;
grant select on public.animal_lot_movement_command_rejections to authenticated;
grant select,insert on public.animal_lot_movement_command_rejections to rebanhosync_movement_executor;
create trigger trg_movement_command_rejection_immutable before update or delete
  on public.animal_lot_movement_command_rejections for each row execute function public.guard_movement_receipt_immutable();

-- A predecessor can arrive under a different tenant/subject after a valid child fact
-- was accepted pending. Terminalize only that invalid dependency subtree. No state
-- writes or foreign data are exposed, and no child-farm membership is fabricated.
create function public.terminalize_invalid_movement_dependencies_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if public.animal_lot_movement_actor_uid_v1() is null or not public.has_membership(new.fazenda_id) then
    raise exception using errcode='42501',message='MOVEMENT_FORBIDDEN';
  end if;
  with recursive invalid as (
    select r.fazenda_id,r.event_id from public.animal_lot_movement_receipts r
    where r.predecessor_event_id=new.event_id and r.result='PENDING_CAUSAL_DEPENDENCY'
      and (r.fazenda_id<>new.fazenda_id or r.animal_id<>new.animal_id)
      and not exists(select 1 from public.animal_lot_movement_effect_decisions d
        where d.fazenda_id=r.fazenda_id and d.event_id=r.event_id)
    union
    select r.fazenda_id,r.event_id from public.animal_lot_movement_receipts r
      join invalid i on r.fazenda_id=i.fazenda_id and r.predecessor_event_id=i.event_id
    where r.result='PENDING_CAUSAL_DEPENDENCY'
      and not exists(select 1 from public.animal_lot_movement_effect_decisions d
        where d.fazenda_id=r.fazenda_id and d.event_id=r.event_id)
  )
  insert into public.animal_lot_movement_effect_decisions (fazenda_id,event_id,result,reason_code,
    movement_version_before,movement_version_after,head_before,head_after,resolver_actor_id)
  select r.fazenda_id,r.event_id,'PROJECTION_CONFLICT','PREDECESSOR_TENANT_OR_SUBJECT_INVALID',
    a.movement_version,a.movement_version,a.movement_head_event_id,a.movement_head_event_id,
    public.animal_lot_movement_actor_uid_v1()
  from invalid i join public.animal_lot_movement_receipts r using(fazenda_id,event_id)
    join public.animais a on a.fazenda_id=r.fazenda_id and a.id=r.animal_id
  on conflict(fazenda_id,command_type,event_id) do nothing;
  return new;
end;
$$;
revoke all on function public.terminalize_invalid_movement_dependencies_v1() from public,anon,authenticated,service_role;
create trigger trg_movement_receipt_invalid_dependency after insert on public.animal_lot_movement_receipts
  for each row execute function public.terminalize_invalid_movement_dependencies_v1();
create trigger trg_movement_rejection_invalid_dependency after insert on public.animal_lot_movement_command_rejections
  for each row execute function public.terminalize_invalid_movement_dependencies_v1();

create function public.animal_lot_movement_predecessor_effect_v1(p_farm uuid,p_event uuid)
returns table (animal_id uuid,command_digest text,to_lote_id uuid,effective_result text,
  effective_movement_version_after bigint,effective_head_after uuid)
language sql stable set search_path=pg_catalog as $$
  select e.animal_id,e.command_digest,e.to_lote_id,e.effective_result,e.effective_movement_version_after,e.effective_head_after
  from public.animal_lot_movement_effective_results e where e.fazenda_id=p_farm and e.event_id=p_event
  union all
  select r.animal_id,r.command_digest,(r.command_input->>'to_lote_id')::uuid,'REJECTED',null::bigint,null::uuid
  from public.animal_lot_movement_command_rejections r where r.fazenda_id=p_farm and r.event_id=p_event;
$$;
revoke all on function public.animal_lot_movement_predecessor_effect_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.animal_lot_movement_predecessor_effect_v1(uuid,uuid) to rebanhosync_movement_executor;

-- Narrow identity rejection only. No foreign receipt, animal, digest or state is exposed.
create function public.movement_predecessor_cross_farm_v1(p_farm uuid,p_event uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select public.has_membership(p_farm) and exists
    (select 1 from public.eventos where id=p_event and fazenda_id<>p_farm
      union all select 1 from public.animal_lot_movement_command_rejections where event_id=p_event and fazenda_id<>p_farm);
$$;
revoke all on function public.movement_predecessor_cross_farm_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.movement_predecessor_cross_farm_v1(uuid,uuid) to rebanhosync_movement_executor;

create function public.lock_animal_lot_movement_work_v1(p_farm uuid,p_animal uuid,p_extra_lots uuid[])
returns void language plpgsql set search_path=pg_catalog as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_farm::text||':movement-subject:'||p_animal::text,0));
  -- Lock the entire durable pending lot set BEFORE the animal, including reverse chains.
  -- UUID order is only a lock order; it never determines factual precedence.
  perform l.id from public.lotes l where l.fazenda_id=p_farm and l.id in (
    select unnest(p_extra_lots)
    union select r.from_lote_id from public.animal_lot_movement_receipts r
      where r.fazenda_id=p_farm and r.animal_id=p_animal and r.result='PENDING_CAUSAL_DEPENDENCY'
        and not exists(select 1 from public.animal_lot_movement_effect_decisions d where d.fazenda_id=r.fazenda_id and d.event_id=r.event_id)
    union select r.to_lote_id from public.animal_lot_movement_receipts r
      where r.fazenda_id=p_farm and r.animal_id=p_animal and r.result='PENDING_CAUSAL_DEPENDENCY'
        and not exists(select 1 from public.animal_lot_movement_effect_decisions d where d.fazenda_id=r.fazenda_id and d.event_id=r.event_id)
  ) order by l.id for share;
end;
$$;
revoke all on function public.lock_animal_lot_movement_work_v1(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.lock_animal_lot_movement_work_v1(uuid,uuid,uuid[]) to rebanhosync_movement_executor;

create function public.resolve_animal_lot_movement_pending_v1(p_farm uuid,p_animal uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_child public.animal_lot_movement_receipts%rowtype; v_parent record;
  v_animal public.animais%rowtype; v_after public.animais%rowtype;
  v_result text; v_reason text; v_progress boolean;
begin
  if public.animal_lot_movement_actor_uid_v1() is null or not public.has_membership(p_farm) then
    raise exception using errcode='42501',message='MOVEMENT_FORBIDDEN';
  end if;
  perform public.lock_animal_lot_movement_work_v1(p_farm,p_animal,array[]::uuid[]);
  select * into v_animal from public.animais where fazenda_id=p_farm and id=p_animal for update;
  if not found then return; end if;
  loop
    v_progress:=false;
    -- No clock/UUID ordering as winner authority: each candidate competes with original CAS.
    for v_child in select r.* from public.animal_lot_movement_receipts r
      where r.fazenda_id=p_farm and r.animal_id=p_animal and r.result='PENDING_CAUSAL_DEPENDENCY'
        and not exists (select 1 from public.animal_lot_movement_effect_decisions d
          where d.fazenda_id=r.fazenda_id and d.event_id=r.event_id)
    loop
      select * into v_parent from public.animal_lot_movement_predecessor_effect_v1(p_farm,v_child.predecessor_event_id);
      if not found or v_parent.effective_result='PENDING_CAUSAL_DEPENDENCY' then continue; end if;
      v_result:='STATE_APPLIED'; v_reason:=null; v_after:=v_animal;
      if v_parent.animal_id<>p_animal or v_parent.command_digest<>v_child.predecessor_command_digest
        or v_parent.to_lote_id is distinct from v_child.from_lote_id then
        v_result:='PROJECTION_CONFLICT'; v_reason:='PREDECESSOR_IDENTITY_OR_ORIGIN_DIVERGENCE';
      elsif v_parent.effective_result<>'STATE_APPLIED' then
        v_result:='PROJECTION_CONFLICT'; v_reason:='PREDECESSOR_NOT_STATE_APPLIED';
      elsif v_animal.status<>'ativo' or v_animal.deleted_at is not null then
        v_result:='PROJECTION_CONFLICT'; v_reason:='ANIMAL_NOT_ELIGIBLE';
      elsif not exists (select 1 from public.lotes where fazenda_id=p_farm and id=v_child.to_lote_id
        and status='ativo' and deleted_at is null) then
        v_result:='PROJECTION_CONFLICT'; v_reason:='DESTINATION_NOT_ELIGIBLE';
      elsif v_animal.movement_version<>v_parent.effective_movement_version_after
        or v_animal.movement_head_event_id is distinct from v_parent.effective_head_after
        or v_animal.lote_id is distinct from v_child.from_lote_id then
        v_result:='PROJECTION_CONFLICT'; v_reason:='MOVEMENT_LOCATION_CONFLICT';
      end if;
      if v_result='STATE_APPLIED' then
        update public.animais set lote_id=v_child.to_lote_id,movement_head_event_id=v_child.event_id,
          client_id='movement-command-v1',client_op_id=v_child.client_op_id,client_tx_id=v_child.client_tx_id,
          client_recorded_at=(v_child.command_input->>'occurred_at')::timestamptz
        where id=p_animal and fazenda_id=p_farm
          and movement_version=v_parent.effective_movement_version_after
          and movement_head_event_id is not distinct from v_parent.effective_head_after
          and lote_id is not distinct from v_child.from_lote_id and status='ativo' and deleted_at is null
        returning * into v_after;
        if not found then raise exception using errcode='40001',message='MOVEMENT_LOCKED_CAS_CHANGED'; end if;
      end if;
      insert into public.animal_lot_movement_effect_decisions (fazenda_id,event_id,result,reason_code,
        movement_version_before,movement_version_after,head_before,head_after,resolver_actor_id)
      values (p_farm,v_child.event_id,v_result,v_reason,v_animal.movement_version,v_after.movement_version,
        v_animal.movement_head_event_id,v_after.movement_head_event_id,public.animal_lot_movement_actor_uid_v1());
      v_animal:=v_after; v_progress:=true;
    end loop;
    exit when not v_progress;
  end loop;
end;
$$;
alter function public.resolve_animal_lot_movement_pending_v1(uuid,uuid) owner to rebanhosync_movement_executor;
revoke all on function public.resolve_animal_lot_movement_pending_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.resolve_animal_lot_movement_pending_v1(uuid,uuid) to rebanhosync_movement_executor;

create function public.reject_animal_lot_movement_v1(p_input jsonb,p_reason text)
returns jsonb language plpgsql set search_path=pg_catalog as $$
declare v_farm uuid:=(p_input->>'fazenda_id')::uuid; v_receipt jsonb;
begin
  if public.animal_lot_movement_actor_uid_v1() is null or not public.has_membership(v_farm) then
    raise exception using errcode='42501',message='MOVEMENT_FORBIDDEN';
  end if;
  v_receipt:=jsonb_build_object('status','REJECTED','reason_code',p_reason,'event_id',p_input->>'event_id',
    'fazenda_id',v_farm,'animal_id',p_input->>'subject_id','command_digest',public.animal_lot_movement_command_digest_v1(p_input),
    'replayed',false);
  insert into public.animal_lot_movement_command_rejections(fazenda_id,event_id,animal_id,client_op_id,command_digest,command_input,receipt)
  values(v_farm,(p_input->>'event_id')::uuid,(p_input->>'subject_id')::uuid,(p_input->>'client_op_id')::uuid,
    public.animal_lot_movement_command_digest_v1(p_input),p_input,v_receipt);
  perform public.resolve_animal_lot_movement_pending_v1(v_farm,(p_input->>'subject_id')::uuid);
  return v_receipt;
end;
$$;
revoke all on function public.reject_animal_lot_movement_v1(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.reject_animal_lot_movement_v1(jsonb,text) to rebanhosync_movement_executor;

create or replace function public.apply_animal_lot_movement_v1(p_command jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_input jsonb; v_digest text; v_actor uuid := public.animal_lot_movement_actor_uid_v1();
  v_farm uuid; v_animal_id uuid; v_event uuid; v_op uuid; v_tx uuid;
  v_from uuid; v_to uuid; v_parent_id uuid; v_parent_digest text;
  v_animal public.animais%rowtype; v_after public.animais%rowtype;
  v_rejected public.animal_lot_movement_command_rejections%rowtype;
  v_parent record;
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
  select * into v_rejected from public.animal_lot_movement_command_rejections
    where fazenda_id=v_farm and event_id=v_event;
  if found then
    if v_rejected.command_digest<>v_digest then
      return jsonb_build_object('status','CONFLICT','reason_code','IDENTITY_DIVERGENCE');
    end if;
    return v_rejected.receipt || jsonb_build_object('replayed',true);
  end if;
  if exists (select 1 from public.animal_lot_movement_command_rejections
    where fazenda_id=v_farm and client_op_id=v_op)
    or exists (select 1 from public.animal_lot_movement_receipts
    where fazenda_id = v_farm and client_op_id = v_op)
    or exists (select 1 from public.eventos where id = v_event) then
    return jsonb_build_object('status','CONFLICT','reason_code','IDENTITY_DIVERGENCE');
  end if;
  -- Serialize movement commands for this subject before discovering durable work.
  -- This namespaced lock is NOT the commercial animal advisory lock.
  perform public.lock_animal_lot_movement_work_v1(v_farm, v_animal_id, array[v_from,v_to]);
  select * into v_dest from public.lotes where id = v_to and fazenda_id = v_farm;
  if not found or (v_from is not null and not exists
    (select 1 from public.lotes where id = v_from and fazenda_id = v_farm)) then
    return public.reject_animal_lot_movement_v1(v_input,'MOVEMENT_LOT_INVALID');
  end if;
  if v_input->>'source_task_id' is not null and not exists
    (select 1 from public.agenda_itens where id = (v_input->>'source_task_id')::uuid and fazenda_id = v_farm) then
    return public.reject_animal_lot_movement_v1(v_input,'MOVEMENT_TASK_INVALID');
  end if;
  select * into v_animal from public.animais where id = v_animal_id and fazenda_id = v_farm for update;
  if not found then
    return public.reject_animal_lot_movement_v1(v_input,'MOVEMENT_ANIMAL_INVALID');
  end if;
  if v_input->>'movement_mode' = 'history_only' then v_result := 'HISTORY_ONLY';
  elsif v_input->'movement_base'->>'kind' = 'snapshot' then
    v_expected := (v_input->'movement_base'->>'movement_version')::bigint;
    v_head := (v_input->'movement_base'->>'head_event_id')::uuid;
    if v_head is not null and not exists (select 1 from public.animal_lot_movement_effective_results
      where fazenda_id = v_farm and event_id = v_head and animal_id = v_animal_id and effective_result = 'STATE_APPLIED') then
      return public.reject_animal_lot_movement_v1(v_input,'MOVEMENT_HEAD_INVALID');
    end if;
  else
    v_parent_id := (v_input->'movement_base'->>'event_id')::uuid;
    v_parent_digest := v_input->'movement_base'->>'command_digest';
    if public.movement_predecessor_cross_farm_v1(v_farm, v_parent_id) then
      return public.reject_animal_lot_movement_v1(v_input,'MOVEMENT_PREDECESSOR_CROSS_FARM');
    end if;
    select * into v_parent from public.animal_lot_movement_predecessor_effect_v1(v_farm,v_parent_id);
    if not found then
      v_result := 'PENDING_CAUSAL_DEPENDENCY'; v_reason := 'PREDECESSOR_MISSING';
    elsif v_parent.animal_id <> v_animal_id or v_parent.command_digest <> v_parent_digest
      or v_parent.to_lote_id is distinct from v_from then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'PREDECESSOR_IDENTITY_OR_ORIGIN_DIVERGENCE';
    elsif v_parent.effective_result = 'PENDING_CAUSAL_DEPENDENCY' then
      v_result := 'PENDING_CAUSAL_DEPENDENCY'; v_reason := 'PREDECESSOR_PENDING';
    elsif v_parent.effective_result <> 'STATE_APPLIED' then
      v_result := 'PROJECTION_CONFLICT'; v_reason := 'PREDECESSOR_NOT_STATE_APPLIED';
    else
      v_expected := v_parent.effective_movement_version_after; v_head := v_parent.effective_head_after;
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
  perform public.resolve_animal_lot_movement_pending_v1(v_farm, v_animal_id);
  return v_receipt;
exception
  -- This block rolls back ALL earlier fact/state/receipt writes on structural constraints.
  -- Infrastructure/serialization errors propagate; they never become a durable business conflict.
  when unique_violation then
    return jsonb_build_object('status','CONFLICT','reason_code','IDENTITY_DIVERGENCE');
  when foreign_key_violation or check_violation or not_null_violation or data_exception then
    if v_input is not null then return public.reject_animal_lot_movement_v1(v_input,'MOVEMENT_INPUT_INVALID'); end if;
    return jsonb_build_object('status','REJECTED','reason_code','MOVEMENT_INPUT_INVALID');
end;
$$;
alter function public.apply_animal_lot_movement_v1(jsonb) owner to rebanhosync_movement_executor;
revoke create on schema public from rebanhosync_movement_executor;
revoke all on function public.apply_animal_lot_movement_v1(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.apply_animal_lot_movement_v1(jsonb) to authenticated;


comment on table public.animal_lot_movement_effect_decisions is 'One append-only terminal projection decision per originally pending command; original facts and receipts remain immutable.';
comment on table public.animal_lot_movement_receipts is 'Immutable original execution results; pending effects resolved transactionally by server using persisted selectors.';
