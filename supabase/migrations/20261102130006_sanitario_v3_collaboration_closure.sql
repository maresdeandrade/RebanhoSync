-- Additive operational collaboration. No gate activation or historical backfill.
begin;
alter table public.sanitario_agenda_v2
 add column operational_revision bigint not null default 0,
 add column closing_barrier jsonb,
 add column result_revision bigint not null default 0;
alter table public.sanitario_sync_v2_operations drop constraint ck_sanitario_sync_v2_operation_kind;
alter table public.sanitario_sync_v2_operations add constraint ck_sanitario_sync_v2_operation_kind check
 (operation_kind in ('agenda_create','agenda_targets_replace','factual_core','administrative_closure','automation_plan','agenda_schedule','collaboration'));

create table public.sanitario_participacoes (
 id uuid primary key, fazenda_id uuid not null, agenda_id uuid not null,
 actor_user_id uuid not null references auth.users(id), client_id text not null,
 final_sequence bigint check(final_sequence between 0 and 100000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,fazenda_id,agenda_id),
 foreign key(agenda_id,fazenda_id) references public.sanitario_agenda_v2(id,fazenda_id)
);
create table public.sanitario_participacao_operacoes (
 id uuid primary key, fazenda_id uuid not null, agenda_id uuid not null, participation_id uuid,
 sequence bigint not null check(sequence between 1 and 100000),
 declaration jsonb not null, outcome text not null check(outcome in ('confirmed','collision','late','dependency')),
 evento_id uuid, resolution jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(participation_id,sequence), unique(id,fazenda_id,agenda_id),
 foreign key(participation_id,fazenda_id,agenda_id) references public.sanitario_participacoes(id,fazenda_id,agenda_id),
 foreign key(evento_id,fazenda_id) references public.eventos(id,fazenda_id)
);
create table public.sanitario_agenda_resultados (
 id uuid primary key, fazenda_id uuid not null, agenda_id uuid not null,
 revision bigint not null, previous_result_id uuid,
 snapshot jsonb not null, actor_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(agenda_id,revision), unique(id,fazenda_id,agenda_id),
 foreign key(agenda_id,fazenda_id) references public.sanitario_agenda_v2(id,fazenda_id),
 foreign key(previous_result_id,fazenda_id,agenda_id) references public.sanitario_agenda_resultados(id,fazenda_id,agenda_id)
);
create table public.sanitario_continuidade_solicitacoes (
 id uuid primary key, fazenda_id uuid not null, agenda_id uuid not null, result_id uuid not null,
 actor_user_id uuid not null references auth.users(id), animals jsonb not null,
 reason text not null check(btrim(reason)<>''),
 decision text check(decision in ('approved','rejected')), decision_reason text,
 decided_by uuid references auth.users(id), continuation_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(result_id,fazenda_id,agenda_id) references public.sanitario_agenda_resultados(id,fazenda_id,agenda_id),
 foreign key(continuation_id,fazenda_id) references public.sanitario_agenda_v2(id,fazenda_id),
 check(decision is null or (decided_by is not null and nullif(btrim(decision_reason),'') is not null)),
 check((decision='approved' and continuation_id is not null) or (decision is distinct from 'approved' and continuation_id is null))
);
create unique index sanitario_continuidade_one_per_result on public.sanitario_continuidade_solicitacoes(result_id) where decision='approved';

do $$ declare t text; begin
 foreach t in array array['sanitario_participacoes','sanitario_participacao_operacoes','sanitario_agenda_resultados','sanitario_continuidade_solicitacoes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy member_select on public.%I for select to authenticated using(public.has_membership(fazenda_id))',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;
-- Snapshots and declarations cannot be overwritten through another application path.
create function public.guard_sanitario_collaboration_write() returns trigger language plpgsql security invoker
 set search_path=pg_catalog,public as $$ begin
 if current_user<>'service_role' or current_setting('rebanhosync.sanitario_v3_farm',true) is distinct from new.fazenda_id::text
  or nullif(current_setting('rebanhosync.sanitario_v3_actor',true),'') is null then
  raise exception 'SANITARIO_SINGLE_ADMISSION_REQUIRED' using errcode='42501'; end if;
 if tg_op='UPDATE' and (tg_table_name='sanitario_agenda_resultados' or
   (tg_table_name='sanitario_participacao_operacoes' and (to_jsonb(new)-array['resolution','updated_at'])<>(to_jsonb(old)-array['resolution','updated_at']))) then
  raise exception 'SANITARIO_EVIDENCE_IMMUTABLE' using errcode='23514'; end if;
 return new; end $$;
do $$ declare t text; begin
 foreach t in array array['sanitario_participacoes','sanitario_participacao_operacoes','sanitario_agenda_resultados','sanitario_continuidade_solicitacoes'] loop
  execute format('create trigger collaboration_write before insert or update on public.%I for each row execute function public.guard_sanitario_collaboration_write()',t);
 end loop;
end $$;

-- Keep the integrated implementation; the public admission remains the only Edge route.
alter function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) rename to internal_sanitario_admit_v3_implementation;
-- All primary writes, including explicit reconciliation, retain the same factual writer,
-- inventory transaction and operation ledger. Qualification creates a new linked Event;
-- the divergent original declaration is never edited.
-- Every textual edit must match exactly once. Missing or repeated anchors abort
-- this entire migration (including the admission rename), rather than partially patching SQL.
create function pg_temp.sanitario_v3_replace_once(source text, anchor text, replacement text)
 returns text language plpgsql as $$
declare matches integer;
begin
 matches:=(length(source)-length(replace(source,anchor,'')))/nullif(length(anchor),0);
 if matches is distinct from 1 then
  raise exception 'SANITARIO_FUNCTION_BASELINE_MISMATCH: expected one SQL anchor, found %',matches;
 end if;
 return replace(source,anchor,replacement);
end $$;
do $$ declare d text; begin
 d:=pg_get_functiondef('public.internal_sanitario_sync_v2_apply_factual_core(uuid,uuid,integer,uuid,uuid,bigint,public.sanitario_sync_v2_event_input,public.sanitario_sync_v2_detail_input,public.sanitario_sync_v2_event_animal_input[])'::regprocedure);
 d:=pg_temp.sanitario_v3_replace_once(d,$old$if v_agenda.status <> 'programada' or v_agenda.deleted_at is not null then$old$,
  $new$if (v_agenda.status <> 'programada' and current_setting('rebanhosync.sanitario_reconcile',true) is distinct from v_agenda.id::text) or v_agenda.deleted_at is not null then$new$);
 d:=pg_temp.sanitario_v3_replace_once(d,'and s.animal_id=any(v_animal_ids);',$new$and s.animal_id=any(v_animal_ids) and current_setting('rebanhosync.sanitario_additional',true) is distinct from v_agenda.id::text;$new$);
 d:=pg_temp.sanitario_v3_replace_once(d,'v_claim := public.internal_sanitario_claim_atendimento',$new$if not exists(select 1 from public.sanitario_atendimentos s where s.fazenda_id=fazenda_id and s.obrigacao_origem_agenda_id=v_agenda.obrigacao_origem_agenda_id and s.animal_id=v_id) then$new$||chr(10)||'v_claim := public.internal_sanitario_claim_atendimento');
 d:=pg_temp.sanitario_v3_replace_once(d,$old$raise exception 'SANITARIO_CLAIM_ATOMICITY_FAILED'; end if;$old$,$new$raise exception 'SANITARIO_CLAIM_ATOMICITY_FAILED'; end if; end if;$new$);
 d:=pg_temp.sanitario_v3_replace_once(d,$old$set planned_status='executado',execution_evento_id=event_payload.id$old$,$new$set planned_status='executado',execution_evento_id=event_payload.id,not_executed_reason=null$new$);
 d:=pg_temp.sanitario_v3_replace_once(d,$old$and aa.animal_id=any(v_animal_ids);$old$,$new$and aa.animal_id=any(v_animal_ids) and aa.planned_status<>'executado';$new$);
 execute d;
end $$;

-- The ordinary closure still rejects factual execution. This narrow, audited
-- cancellation accepts only explicitly resolved collision evidence, never confirmed Events.
do $$ declare d text; marker text:='and e.deleted_at is null'; begin
 d:=pg_get_functiondef('public.internal_sanitario_sync_v2_close_agenda(uuid,uuid,integer,uuid,uuid,bigint,public.sanitario_sync_v2_closure_input)'::regprocedure);
 d:=pg_temp.sanitario_v3_replace_once(d,marker,$new$and e.deleted_at is null and not (
   coalesce(current_setting('rebanhosync.sanitario_cancel_continuation',true),'')=payload.agenda_id::text
   and e.sanitario_v3_confirmation='collision'
   and exists(select 1 from public.sanitario_participacao_operacoes resolved where resolved.evento_id=e.id and resolved.fazenda_id=fazenda_id and resolved.resolution is not null))$new$);
 execute d;
end $$;

-- Only the decision transaction may assign a continuation root at INSERT.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.guard_sanitario_sync_v2_internal_writes()'::regprocedure);
 d:=pg_temp.sanitario_v3_replace_once(d,'new.obrigacao_origem_agenda_id := new.id;',
  $new$new.obrigacao_origem_agenda_id := coalesce(nullif(current_setting('rebanhosync.sanitario_continuation_root',true),'')::uuid,new.id);$new$);
 execute d;
end $$;

-- Clear only the mutable dispute projection after an explicit audited decision.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.guard_sanitario_atendimento_factual()'::regprocedure);
 d:=pg_temp.sanitario_v3_replace_once(d,'and new.em_disputa and not old.em_disputa',
 $new$and ((new.em_disputa and not old.em_disputa) or (not new.em_disputa and old.em_disputa and current_setting('rebanhosync.sanitario_resolution',true)=new.fazenda_id::text))$new$);
 execute d;
end $$;

drop function pg_temp.sanitario_v3_replace_once(text,text,text);

create function public.internal_sanitario_result_snapshot(farm uuid, agenda uuid) returns jsonb
 language sql security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('agenda',to_jsonb(a)-array['closing_barrier','updated_at'],
 'outcome',(select case when count(*) filter(where aa.planned_status='executado')=count(*) then 'total' when count(*) filter(where aa.planned_status='executado')=0 then 'without_execution' else 'partial' end from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=agenda and aa.fazenda_id=farm),
 'participants',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.sanitario_participacoes p where p.fazenda_id=farm and p.agenda_id=agenda),'[]'),
 'operations',coalesce((select jsonb_agg(to_jsonb(o) order by o.participation_id,o.sequence) from public.sanitario_participacao_operacoes o where o.fazenda_id=farm and o.agenda_id=agenda),'[]'),
 'animals',coalesce((select jsonb_agg(to_jsonb(aa) order by aa.animal_id) from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=agenda and aa.fazenda_id=farm),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('evento_id',e.id,'confirmation',e.sanitario_v3_confirmation,'animals',(select jsonb_agg(ea.animal_id order by ea.animal_id) from public.eventos_animais ea where ea.evento_id=e.id and ea.fazenda_id=farm)) order by e.id) from public.eventos e where e.source_sanitario_agenda_v2_id=agenda and e.fazenda_id=farm),'[]'))
 from public.sanitario_agenda_v2 a where a.id=agenda and a.fazenda_id=farm
 $$;

create function public.internal_sanitario_admit_v3(actor_user_id uuid,fazenda_id uuid,command text,operation_args jsonb,receipt_only boolean default false)
 returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
#variable_conflict use_variable
declare
 a jsonb:=operation_args; p jsonb:=a->'payload'; act text:=p->>'action';
 ag public.sanitario_agenda_v2%rowtype; participant public.sanitario_participacoes%rowtype;
 evidence public.sanitario_participacao_operacoes%rowtype; req public.sanitario_continuidade_solicitacoes%rowtype;
 agenda_id uuid; participant_id uuid; seq bigint; client text; actor_role public.farm_role_enum;
 op uuid:=(a->>'client_op_id')::uuid; dom uuid:=(a->>'domain_op_id')::uuid;
 fingerprint text; old_result jsonb; result jsonb; snap jsonb; current_result public.sanitario_agenda_resultados%rowtype;
 ids uuid[]; target uuid; remaining integer; event_args jsonb; new_agenda uuid; v_event uuid;
begin
 if current_user<>'service_role' then raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 select uf.role into actor_role from public.user_fazendas uf join public.fazendas f on f.id=uf.fazenda_id and f.deleted_at is null
 where uf.user_id=actor_user_id and uf.fazenda_id=fazenda_id and uf.deleted_at is null;
 if actor_role is null then raise exception 'SANITARIO_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 if a->>'actor_user_id' is distinct from actor_user_id::text or a->>'fazenda_id' is distinct from fazenda_id::text then
  raise exception 'SANITARIO_FAZENDA_CONTEXT_MISMATCH' using errcode='42501'; end if;
 if command='manage_agenda' then
  agenda_id:=(p->>'agenda_id')::uuid; client:=a->>'client_id';
  if act is null or act not in ('participate','complete','prepare_close','confirm_close','cancel_preparation','cancel_continuation','resolve','reconcile_late','request_continuation','decide_continuation') then
   raise exception 'SANITARIO_ACTION_INVALID' using errcode='22023'; end if;
  if actor_role='cowboy' and act not in ('participate','complete','request_continuation') then raise exception 'SANITARIO_ROLE_NOT_ALLOWED' using errcode='42501'; end if;
 elsif command='apply_factual_core' and a->'event_payload'->>'source_sanitario_agenda_v2_id' is not null then
  agenda_id:=(a->'event_payload'->>'source_sanitario_agenda_v2_id')::uuid; client:=a->'event_payload'->>'client_id';
 else
  -- Recover an immutable receipt before applying any new-write barrier.
  old_result:=public.internal_sanitario_admit_v3_implementation(actor_user_id,fazenda_id,command,a,true);
  if receipt_only then return old_result; end if;
  if old_result->>'outcome'='found' then return old_result->'canonical_result'; end if;
  -- Planning and administrative legacy commands share the same agenda row barrier.
  agenda_id:=coalesce(a->>'agenda_id',case when command='close_agenda' then a->'payload'->>'agenda_id' end)::uuid;
  if agenda_id is not null then
   select g.* into ag from public.sanitario_agenda_v2 g where g.id=agenda_id and g.fazenda_id=fazenda_id for update;
   if ag.closing_barrier is not null or exists(select 1 from public.sanitario_participacoes s where s.agenda_id=agenda_id and s.fazenda_id=fazenda_id) then
    raise exception 'SANITARIO_OPERATIONAL_AGENDA_REQUIRES_REVIEW' using errcode='55000'; end if;
  end if;
  return public.internal_sanitario_admit_v3_implementation(actor_user_id,fazenda_id,command,a,receipt_only);
 end if;
 if agenda_id is null or op is null or dom is null or nullif(btrim(client),'') is null then raise exception 'SANITARIO_REQUIRED_ARGUMENT_MISSING' using errcode='22004'; end if;
 fingerprint:=public.internal_sanitario_v3_fingerprint(actor_user_id,fazenda_id,command,a);
 -- This lookup also takes the original immutable operation lock, before phase checks.
 old_result:=public.internal_sanitario_sync_v2_existing_result(fazenda_id,case when command='manage_agenda' then 'collaboration' else 'factual_core' end,
  case when command='manage_agenda' then agenda_id else (a->'event_payload'->>'id')::uuid end,op,dom,fingerprint);
 if old_result is not null then
  if receipt_only then return jsonb_build_object('outcome','found','canonical_result',old_result); end if; return old_result;
 end if;
 if receipt_only then return jsonb_build_object('outcome','absent'); end if;
 if (a->>'contract_version')::integer is distinct from 3 then raise exception 'SANITARIO_CLIENT_CONTRACT_OUTDATED' using errcode='22023'; end if;
 perform set_config('rebanhosync.sanitario_v3_farm',fazenda_id::text,true);
 perform set_config('rebanhosync.sanitario_v3_actor',actor_user_id::text,true);
 perform set_config('rebanhosync.sanitario_v3_fingerprint',fingerprint,true);
 -- Reuse the integrated gate/role/rollout authorization, never UI authority.
 perform public.internal_sanitario_sync_v2_authorize(actor_user_id,fazenda_id,3,client,'factual_core',array['owner','manager','cowboy']::public.farm_role_enum[]);
 select g.* into ag from public.sanitario_agenda_v2 g where g.id=agenda_id and g.fazenda_id=fazenda_id and g.deleted_at is null for update;
 if not found or ag.obrigacao_origem_agenda_id is null then raise exception 'SANITARIO_AGENDA_NOT_FOUND' using errcode='23503'; end if;
 if command='apply_factual_core' or act in ('participate','complete') then
  participant_id:=case when command='apply_factual_core' then (a->'event_payload'->'payload'->>'participation_id')::uuid else (p->>'participation_id')::uuid end;
  -- Already durable, pre-upgrade envelopes are preserved verbatim and admitted as
  -- a stable single-operation segment, without inventing a device final sequence.
  if participant_id is null and command='apply_factual_core' then participant_id:=dom; end if;
  if participant_id is null then raise exception 'SANITARIO_PARTICIPATION_REQUIRED' using errcode='22023'; end if;
  select s.* into participant from public.sanitario_participacoes s where s.id=participant_id;
  if found and (participant.fazenda_id,participant.agenda_id,participant.actor_user_id,participant.client_id) is distinct from (fazenda_id,agenda_id,actor_user_id,client) then
   raise exception 'SANITARIO_PARTICIPATION_SCOPE_MISMATCH' using errcode='42501'; end if;
  if not found then
   if ag.status<>'programada' and command='manage_agenda' then raise exception 'SANITARIO_AGENDA_CLOSED' using errcode='55000'; end if;
   insert into public.sanitario_participacoes(id,fazenda_id,agenda_id,actor_user_id,client_id) values(participant_id,fazenda_id,agenda_id,actor_user_id,client) returning * into participant;
  end if;
 end if;
 if pg_column_size(a)>1048576 then raise exception 'SANITARIO_PAYLOAD_LIMIT_EXCEEDED' using errcode='54000'; end if;
 if command='apply_factual_core' then
  if a->'event_payload'->>'natureza' is distinct from 'primary_execution' or a->'event_payload'->'payload'->>'sanitario_v3_progressive' is distinct from 'true'
   or jsonb_typeof(a->'event_animals') is distinct from 'array' or jsonb_array_length(a->'event_animals') not between 1 and 500
   or (select count(distinct x->>'animal_id') from jsonb_array_elements(a->'event_animals') x)<>jsonb_array_length(a->'event_animals')
   or (select count(distinct x->>'id') from jsonb_array_elements(a->'event_animals') x)<>jsonb_array_length(a->'event_animals')
   or exists(select 1 from jsonb_array_elements(a->'event_animals') x where not exists(select 1 from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=agenda_id and aa.fazenda_id=fazenda_id and aa.animal_id=(x->>'animal_id')::uuid)) then
   raise exception 'SANITARIO_EVENT_ANIMAL_OUTSIDE_OBLIGATION' using errcode='23503'; end if;
  seq:=coalesce((a->'event_payload'->'payload'->>'participation_sequence')::bigint,1);
  if participant.final_sequence is not null and seq>participant.final_sequence and ag.status='programada' then raise exception 'SANITARIO_PARTICIPATION_ALREADY_COMPLETE' using errcode='55000'; end if;
  select array_agg((x->>'animal_id')::uuid order by (x->>'animal_id')::uuid) into ids from jsonb_array_elements(a->'event_animals') x;
  foreach target in array ids loop perform pg_advisory_xact_lock(hashtextextended('sanitario:claim:'||fazenda_id::text||':'||ag.obrigacao_origem_agenda_id::text||':'||target::text,0)); end loop;
  -- A known late declaration prevents incompatible confirmation in its continuity.
  if ag.status='programada' and exists(select 1 from public.sanitario_participacao_operacoes o join public.sanitario_agenda_v2 parent on parent.id=o.agenda_id and parent.fazenda_id=o.fazenda_id
   where o.fazenda_id=fazenda_id and parent.obrigacao_origem_agenda_id=ag.obrigacao_origem_agenda_id and o.agenda_id<>agenda_id and o.outcome='late' and o.resolution is null
    and exists(select 1 from jsonb_array_elements(o.declaration->'event_animals') la join jsonb_array_elements(a->'event_animals') ca on la->>'animal_id'=ca->>'animal_id')) then
   result:=jsonb_build_object('agenda_id',agenda_id,'evento_id',(a->'event_payload'->>'id')::uuid,'outcome','dependency','confirmed',false,'declaration_id',op);
   insert into public.sanitario_participacao_operacoes(id,fazenda_id,agenda_id,participation_id,sequence,declaration,outcome)
    values(op,fazenda_id,agenda_id,participant_id,seq,a,'dependency');
   insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
    values(fazenda_id,'factual_core',(a->'event_payload'->>'id')::uuid,op,dom,actor_user_id,3,fingerprint,result);
   update public.sanitario_agenda_v2 g set operational_revision=g.operational_revision+1,closing_barrier=null where g.id=agenda_id and g.fazenda_id=fazenda_id;
   return result;
  end if;
  if ag.status='programada' then
   result:=public.internal_sanitario_admit_v3_implementation(actor_user_id,fazenda_id,command,a,false);
   perform set_config('rebanhosync.sanitario_v3_farm',fazenda_id::text,true);
   perform set_config('rebanhosync.sanitario_v3_actor',actor_user_id::text,true);
   insert into public.sanitario_participacao_operacoes(id,fazenda_id,agenda_id,participation_id,sequence,declaration,outcome,evento_id)
    values(op,fazenda_id,agenda_id,participant_id,seq,a,result->>'outcome',(result->>'evento_id')::uuid);
  else
   result:=jsonb_build_object('agenda_id',agenda_id,'outcome','late','confirmed',false,'declaration_id',op,'evento_id',(a->'event_payload'->>'id')::uuid);
   insert into public.sanitario_participacao_operacoes(id,fazenda_id,agenda_id,participation_id,sequence,declaration,outcome)
    values(op,fazenda_id,agenda_id,participant_id,seq,a,'late');
   insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
    values(fazenda_id,'factual_core',(a->'event_payload'->>'id')::uuid,op,dom,actor_user_id,3,fingerprint,result);
  end if;
  update public.sanitario_agenda_v2 g set operational_revision=operational_revision+1,closing_barrier=null where g.id=agenda_id and g.fazenda_id=fazenda_id;
  return result;
 end if;
 if act='participate' then
  if ag.status<>'programada' then raise exception 'SANITARIO_AGENDA_CLOSED' using errcode='55000'; end if;
  result:=jsonb_build_object('participation_id',participant_id);
 elsif act='complete' then
  seq:=(p->>'final_sequence')::bigint;
  if seq is null or seq<0 or seq>100000 or exists(select 1 from public.sanitario_participacao_operacoes o where o.participation_id=participant_id and o.sequence>seq)
   or (participant.final_sequence is not null and participant.final_sequence<>seq) then raise exception 'SANITARIO_FINAL_SEQUENCE_INVALID' using errcode='23514'; end if;
  if ag.status<>'programada' then raise exception 'SANITARIO_AGENDA_CLOSED' using errcode='55000'; end if;
  update public.sanitario_participacoes s set final_sequence=seq,updated_at=now() where s.id=participant_id;
  result:=jsonb_build_object('participation_id',participant_id,'final_sequence',seq);
 elsif act='prepare_close' then
  if ag.status<>'programada' then raise exception 'SANITARIO_AGENDA_CLOSED' using errcode='55000'; end if;
  if exists(select 1 from public.sanitario_participacoes s where s.agenda_id=agenda_id and s.fazenda_id=fazenda_id and
    (s.final_sequence is null or s.final_sequence<>(select count(*) from public.sanitario_participacao_operacoes o where o.participation_id=s.id and o.sequence<=s.final_sequence))) then
   raise exception 'SANITARIO_PARTICIPANTS_INCOMPLETE' using errcode='55000'; end if;
  if exists(select 1 from public.sanitario_participacao_operacoes o where o.agenda_id=agenda_id and o.fazenda_id=fazenda_id and o.outcome in ('collision','late','dependency') and o.resolution is null) then
   raise exception 'SANITARIO_UNRESOLVED_EVIDENCE' using errcode='55000'; end if;
  if exists(select 1 from public.eventos e where e.fazenda_id=fazenda_id and e.source_sanitario_agenda_v2_id=agenda_id and e.sanitario_v3_confirmation='collision'
    and not exists(select 1 from public.sanitario_participacao_operacoes o where o.fazenda_id=fazenda_id and o.evento_id=e.id and o.resolution is not null)) then
   raise exception 'SANITARIO_UNRESOLVED_EVIDENCE' using errcode='55000'; end if;
  -- A single nonblank reason for every outstanding target, and no other animal.
  -- Validate shape first so malformed/null payloads cannot bypass exact set coverage.
  if jsonb_typeof(coalesce(p->'not_executed','[]'::jsonb)) is distinct from 'array' then
   raise exception 'SANITARIO_NOT_EXECUTED_TARGET_INVALID' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p->'not_executed','[]')) x
    where jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'animal_id') is distinct from 'string'
     or jsonb_typeof(x->'reason') is distinct from 'string' or nullif(btrim(x->>'reason'),'') is null) then
   raise exception 'SANITARIO_NOT_EXECUTED_REASON_REQUIRED' using errcode='23514'; end if;
  if (select count(distinct (x->>'animal_id')::uuid) from jsonb_array_elements(coalesce(p->'not_executed','[]')) x)
     <>jsonb_array_length(coalesce(p->'not_executed','[]'))
   or exists(select 1 from jsonb_array_elements(coalesce(p->'not_executed','[]')) x
    where not exists(select 1 from public.sanitario_agenda_animais_v2 aa
     where aa.agenda_id=agenda_id and aa.fazenda_id=fazenda_id and aa.animal_id=(x->>'animal_id')::uuid and aa.planned_status<>'executado')) then
   raise exception 'SANITARIO_NOT_EXECUTED_TARGET_INVALID' using errcode='23514'; end if;
  -- Reasons are supplied per animal and stored in the immutable barrier; not facts.
  if exists(select 1 from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=agenda_id and aa.fazenda_id=fazenda_id and aa.planned_status<>'executado'
   and not exists(select 1 from jsonb_array_elements(coalesce(p->'not_executed','[]')) x where (x->>'animal_id')::uuid=aa.animal_id and nullif(btrim(x->>'reason'),'') is not null)) then
   raise exception 'SANITARIO_NOT_EXECUTED_REASON_REQUIRED' using errcode='23514'; end if;
  snap:=public.internal_sanitario_result_snapshot(fazenda_id,agenda_id);
  result:=jsonb_build_object('barrier_id',dom,'snapshot',snap,'not_executed',coalesce(p->'not_executed','[]'));
  update public.sanitario_agenda_v2 g set closing_barrier=result where g.id=agenda_id and g.fazenda_id=fazenda_id;
 elsif act='cancel_preparation' then
  if ag.status<>'programada' then raise exception 'SANITARIO_AGENDA_CLOSED' using errcode='55000'; end if;
  update public.sanitario_agenda_v2 g set closing_barrier=null where g.id=agenda_id and g.fazenda_id=fazenda_id;
  result:=jsonb_build_object('outcome','preparation_cancelled');
 elsif act='confirm_close' then
  if ag.status<>'programada' or ag.closing_barrier is null or ag.closing_barrier->>'barrier_id' is distinct from p->>'barrier_id'
    or ag.closing_barrier->'snapshot' is distinct from public.internal_sanitario_result_snapshot(fazenda_id,agenda_id) then
   raise exception 'SANITARIO_CLOSING_SNAPSHOT_STALE' using errcode='PT409'; end if;
  update public.sanitario_agenda_animais_v2 aa set planned_status='nao_executado',execution_evento_id=null,not_executed_reason=x->>'reason'
   from jsonb_array_elements(ag.closing_barrier->'not_executed') x where aa.agenda_id=agenda_id and aa.fazenda_id=fazenda_id and aa.animal_id=(x->>'animal_id')::uuid and aa.planned_status<>'executado';
  update public.sanitario_agenda_v2 g set status='fechada',result_revision=result_revision+1,closing_barrier=null where g.id=agenda_id and g.fazenda_id=fazenda_id;
  snap:=public.internal_sanitario_result_snapshot(fazenda_id,agenda_id);
  insert into public.sanitario_agenda_resultados(id,fazenda_id,agenda_id,revision,snapshot,actor_user_id) values(dom,fazenda_id,agenda_id,ag.result_revision+1,snap,actor_user_id);
  result:=jsonb_build_object('result_id',dom,'result_revision',ag.result_revision+1,'agenda_status','fechada','snapshot',snap);
 elsif act in ('resolve','reconcile_late') then
  if nullif(btrim(p->>'reason'),'') is null then raise exception 'SANITARIO_RESOLUTION_REASON_REQUIRED' using errcode='23514'; end if;
  select o.* into evidence from public.sanitario_participacao_operacoes o where o.id=(p->>'declaration_id')::uuid and o.agenda_id=agenda_id and o.fazenda_id=fazenda_id for update;
  if not found and act='resolve' and p->>'event_id' is not null then
   select e.id,jsonb_build_object('historical_evidence_projection',true,'actor_user_id',ledger.actor_user_id,'fazenda_id',fazenda_id,'contract_version',3,
    'client_op_id',e.client_op_id,'domain_op_id',e.domain_op_id,'expected_revision',ag.revision,
    'event_payload',to_jsonb(e)||jsonb_build_object('natureza','primary_execution'),
    'detail_payload',to_jsonb(d),
    'event_animals',(select jsonb_agg(jsonb_build_object('id',ea.id,'animal_id',ea.animal_id) order by ea.animal_id) from public.eventos_animais ea where ea.evento_id=e.id and ea.fazenda_id=fazenda_id))
   into v_event,event_args from public.eventos e join public.eventos_sanitario d on d.evento_id=e.id and d.fazenda_id=e.fazenda_id
    join public.sanitario_sync_v2_operations ledger on ledger.entity_id=e.id and ledger.fazenda_id=e.fazenda_id and ledger.operation_kind='factual_core'
   where e.id=(p->>'event_id')::uuid and e.client_op_id=(p->>'declaration_id')::uuid and e.fazenda_id=fazenda_id
    and e.source_sanitario_agenda_v2_id=agenda_id and e.sanitario_v3_confirmation='collision';
   if found then
    -- Preserve existing factual rows/receipts. No synthetic operational participation or final limit.
    insert into public.sanitario_participacao_operacoes(id,fazenda_id,agenda_id,participation_id,sequence,declaration,outcome,evento_id)
     values((p->>'declaration_id')::uuid,fazenda_id,agenda_id,null,1,event_args,'collision',v_event) returning * into evidence;
   end if;
  end if;
  if evidence.id is null or evidence.resolution is not null or (act='resolve' and evidence.outcome not in ('collision','dependency')) or (act='reconcile_late' and evidence.outcome<>'late') then
   raise exception 'SANITARIO_EVIDENCE_STALE' using errcode='PT409'; end if;
  if p->>'decision' not in ('duplicate','rejected','additional','accepted') or p->>'decision' is null then raise exception 'SANITARIO_RESOLUTION_INVALID' using errcode='23514'; end if;
  if evidence.declaration->>'historical_evidence_projection'='true' and p->>'decision' in ('accepted','additional') then
   raise exception 'SANITARIO_HISTORICAL_COMPLEMENT_REQUIRED' using errcode='23514'; end if;
  if p->>'decision' in ('accepted','additional') then
   select array_agg((x->>'animal_id')::uuid order by (x->>'animal_id')::uuid) into ids from jsonb_array_elements(evidence.declaration->'event_animals') x;
   foreach target in array ids loop perform pg_advisory_xact_lock(hashtextextended('sanitario:claim:'||fazenda_id::text||':'||ag.obrigacao_origem_agenda_id::text||':'||target::text,0)); end loop;
   if evidence.outcome='dependency' and exists(select 1 from public.sanitario_participacao_operacoes pending join public.sanitario_agenda_v2 parent on parent.id=pending.agenda_id and parent.fazenda_id=pending.fazenda_id
    where pending.fazenda_id=fazenda_id and parent.obrigacao_origem_agenda_id=ag.obrigacao_origem_agenda_id and pending.outcome='late' and pending.resolution is null
      and exists(select 1 from jsonb_array_elements(pending.declaration->'event_animals') x where (x->>'animal_id')::uuid=any(ids))) then
    raise exception 'SANITARIO_CONTINUATION_DEPENDENCY' using errcode='55000'; end if;
   -- Existing continuity must be explicitly handled before recognizing affected facts.
   if exists(select 1 from public.sanitario_continuidade_solicitacoes c join public.sanitario_agenda_v2 child on child.id=c.continuation_id and child.fazenda_id=c.fazenda_id where c.fazenda_id=fazenda_id and c.agenda_id=agenda_id and c.decision='approved' and child.status not in ('cancelada','dispensada') and exists(select 1 from jsonb_array_elements(c.animals) ca join jsonb_array_elements(evidence.declaration->'event_animals') ea on ca->>'animal_id'=ea->>'animal_id' where p->>'decision'<>'additional' or not exists(select 1 from public.sanitario_agenda_animais_v2 child_animal where child_animal.agenda_id=child.id and child_animal.fazenda_id=fazenda_id and child_animal.animal_id=(ca->>'animal_id')::uuid and child_animal.planned_status='executado'))) then
    raise exception 'SANITARIO_CONTINUATION_DEPENDENCY' using errcode='55000'; end if;
   event_args:=evidence.declaration;
   v_event:=dom;
   event_args:=event_args||jsonb_build_object('actor_user_id',actor_user_id,'client_op_id',op,'domain_op_id',dom);
   event_args:=jsonb_set(event_args,'{event_payload,id}',to_jsonb(v_event));
   event_args:=jsonb_set(event_args,'{event_payload,payload}',coalesce(event_args->'event_payload'->'payload','{}')||jsonb_build_object('reconciles_declaration_id',evidence.id,'original_actor_user_id',evidence.declaration->>'actor_user_id'));
   -- Movement identity follows the newly confirmed Event; never the collision.
   if event_args->'event_payload'->'payload' ? 'inventory_movement' then
    event_args:=jsonb_set(event_args,'{event_payload,payload,inventory_movement,id}',to_jsonb(v_event));
    event_args:=jsonb_set(event_args,'{event_payload,payload,inventory_movement,client_op_id}',to_jsonb(op));
    event_args:=jsonb_set(event_args,'{event_payload,payload,inventory_movement,domain_op_id}',to_jsonb(dom));
   end if;
   select jsonb_agg(x||jsonb_build_object('id',gen_random_uuid())) into snap from jsonb_array_elements(event_args->'event_animals') x;
   event_args:=jsonb_set(event_args,'{event_animals}',snap);
   perform set_config('rebanhosync.sanitario_reconcile',agenda_id::text,true);
   if p->>'decision'='additional' then perform set_config('rebanhosync.sanitario_additional',agenda_id::text,true); end if;
   -- Different ledger identity for the linked confirmation, still inside this decision transaction.
   event_args:=event_args||jsonb_build_object('client_op_id',gen_random_uuid(),'domain_op_id',gen_random_uuid());
   perform set_config('rebanhosync.sanitario_v3_fingerprint',public.internal_sanitario_v3_fingerprint(actor_user_id,fazenda_id,'apply_factual_core',event_args),true);
   result:=public.internal_sanitario_sync_v2_apply_factual_core(actor_user_id,fazenda_id,3,(event_args->>'client_op_id')::uuid,(event_args->>'domain_op_id')::uuid,(event_args->>'expected_revision')::bigint,
    jsonb_populate_record(null::public.sanitario_sync_v2_event_input,event_args->'event_payload'),jsonb_populate_record(null::public.sanitario_sync_v2_detail_input,event_args->'detail_payload'),
    array(select x from jsonb_populate_recordset(null::public.sanitario_sync_v2_event_animal_input,event_args->'event_animals') x));
   if result->>'confirmed' is distinct from 'true' then raise exception 'SANITARIO_RESOLUTION_STILL_COLLIDES' using errcode='23514'; end if;
  end if;
  result:=jsonb_build_object('decision',p->>'decision','reason',p->>'reason','actor_user_id',actor_user_id,'evento_id',v_event,'resolved_at',now());
  update public.sanitario_participacao_operacoes o set resolution=result,updated_at=now() where o.id=evidence.id;
  perform set_config('rebanhosync.sanitario_resolution',fazenda_id::text,true);
  update public.sanitario_atendimentos atn set em_disputa=false,revision=atn.revision+1,updated_at=now()
   where atn.fazenda_id=fazenda_id and atn.obrigacao_origem_agenda_id=ag.obrigacao_origem_agenda_id and atn.em_disputa
   and not exists(select 1 from public.eventos e join public.sanitario_agenda_v2 parent on parent.id=e.source_sanitario_agenda_v2_id and parent.fazenda_id=e.fazenda_id
     join public.eventos_animais ea on ea.evento_id=e.id and ea.fazenda_id=e.fazenda_id
     where e.fazenda_id=fazenda_id and parent.obrigacao_origem_agenda_id=ag.obrigacao_origem_agenda_id and ea.animal_id=atn.animal_id and e.sanitario_v3_confirmation='collision'
     and not exists(select 1 from public.sanitario_participacao_operacoes resolved where resolved.evento_id=e.id and resolved.fazenda_id=fazenda_id and resolved.resolution is not null))
   and not exists(select 1 from public.sanitario_participacao_operacoes o join public.sanitario_agenda_v2 g on g.id=o.agenda_id and g.fazenda_id=o.fazenda_id
    where o.fazenda_id=fazenda_id and g.obrigacao_origem_agenda_id=ag.obrigacao_origem_agenda_id and o.outcome='collision' and o.resolution is null
    and exists(select 1 from jsonb_array_elements(o.declaration->'event_animals') x where (x->>'animal_id')::uuid=atn.animal_id));
  perform set_config('rebanhosync.sanitario_resolution','',true);
  if ag.status<>'programada' then
   select r.* into current_result from public.sanitario_agenda_resultados r where r.agenda_id=agenda_id and r.fazenda_id=fazenda_id order by revision desc limit 1;
   update public.sanitario_agenda_v2 g set result_revision=result_revision+1 where g.id=agenda_id and g.fazenda_id=fazenda_id;
   insert into public.sanitario_agenda_resultados(id,fazenda_id,agenda_id,revision,previous_result_id,snapshot,actor_user_id)
    values(dom,fazenda_id,agenda_id,ag.result_revision+1,current_result.id,public.internal_sanitario_result_snapshot(fazenda_id,agenda_id),actor_user_id);
   result:=result||jsonb_build_object('result_id',dom);
  end if;
 elsif act='cancel_continuation' then
  if ag.status<>'programada' or ag.metadata->>'continuation_request_id' is null or nullif(btrim(p->>'reason'),'') is null then
   raise exception 'SANITARIO_CONTINUATION_CANCELLATION_INVALID' using errcode='23514'; end if;
  if exists(select 1 from public.sanitario_participacoes s where s.agenda_id=agenda_id and s.fazenda_id=fazenda_id and
    (s.final_sequence is null or s.final_sequence<>(select count(*) from public.sanitario_participacao_operacoes o where o.participation_id=s.id and o.sequence<=s.final_sequence))) then
   raise exception 'SANITARIO_PARTICIPANTS_INCOMPLETE' using errcode='55000'; end if;
  if exists(select 1 from public.eventos e where e.fazenda_id=fazenda_id and e.source_sanitario_agenda_v2_id=agenda_id
    and (e.sanitario_v3_confirmation is distinct from 'collision' or not exists(select 1 from public.sanitario_participacao_operacoes o where o.evento_id=e.id and o.fazenda_id=fazenda_id and o.resolution is not null))) then
   raise exception 'SANITARIO_CONTINUATION_HAS_FACTS' using errcode='55000'; end if;
  event_args:=jsonb_build_object('id',dom,'agenda_id',agenda_id,'closure_type','cancelled','dedup_key',dom,'client_id',client,'client_tx_id',a->>'client_tx_id','client_recorded_at',now(),'closed_at',now(),'reason',p->>'reason','metadata',jsonb_build_object('deferred_declaration_ids',(select coalesce(jsonb_agg(o.id),'[]') from public.sanitario_participacao_operacoes o where o.agenda_id=agenda_id and o.fazenda_id=fazenda_id and o.outcome='dependency' and o.resolution is null)));
  perform set_config('rebanhosync.sanitario_v3_fingerprint',encode(sha256(convert_to(event_args::text,'UTF8')),'hex'),true);
  perform set_config('rebanhosync.sanitario_cancel_continuation',agenda_id::text,true);
  result:=public.internal_sanitario_sync_v2_close_agenda(actor_user_id,fazenda_id,3,gen_random_uuid(),gen_random_uuid(),ag.revision,
    jsonb_populate_record(null::public.sanitario_sync_v2_closure_input,event_args));
  perform set_config('rebanhosync.sanitario_cancel_continuation','',true);
 elsif act='request_continuation' then
  select r.* into current_result from public.sanitario_agenda_resultados r where r.id=(p->>'result_id')::uuid and r.agenda_id=agenda_id and r.fazenda_id=fazenda_id and r.revision=ag.result_revision;
  if not found or ag.status<>'fechada' or nullif(btrim(p->>'reason'),'') is null or jsonb_typeof(p->'animals') is distinct from 'array' or jsonb_array_length(p->'animals')=0 then
   raise exception 'SANITARIO_CONTINUATION_RESULT_STALE' using errcode='PT409'; end if;
  if exists(select 1 from jsonb_array_elements(p->'animals') x where nullif(btrim(x->>'reason'),'') is null or not exists(select 1 from public.sanitario_agenda_animais_v2 aa where aa.agenda_id=agenda_id and aa.fazenda_id=fazenda_id and aa.animal_id=(x->>'animal_id')::uuid and aa.planned_status='nao_executado')) then
   raise exception 'SANITARIO_CONTINUATION_TARGET_INVALID' using errcode='23514'; end if;
  insert into public.sanitario_continuidade_solicitacoes(id,fazenda_id,agenda_id,result_id,actor_user_id,animals,reason) values(dom,fazenda_id,agenda_id,current_result.id,actor_user_id,p->'animals',p->>'reason');
  result:=jsonb_build_object('request_id',dom);
 elsif act='decide_continuation' then
  select c.* into req from public.sanitario_continuidade_solicitacoes c where c.id=(p->>'request_id')::uuid and c.fazenda_id=fazenda_id and c.agenda_id=agenda_id for update;
  if not found or req.decision is not null then raise exception 'SANITARIO_CONTINUATION_ALREADY_DECIDED' using errcode='PT409'; end if;
  if p->>'decision' not in ('approved','rejected') or p->>'decision' is null or nullif(btrim(p->>'reason'),'') is null then raise exception 'SANITARIO_CONTINUATION_DECISION_INVALID' using errcode='23514'; end if;
  if p->>'decision'='approved' then
   if not exists(select 1 from public.sanitario_agenda_resultados r where r.id=req.result_id and r.revision=ag.result_revision)
    or exists(select 1 from public.sanitario_participacao_operacoes o where o.agenda_id=agenda_id and o.fazenda_id=fazenda_id and o.outcome='late' and o.resolution is null) then
    raise exception 'SANITARIO_CONTINUATION_RESULT_STALE' using errcode='PT409'; end if;
   select array_agg(distinct (x->>'animal_id')::uuid order by (x->>'animal_id')::uuid) into ids from jsonb_array_elements(req.animals) x;
   foreach target in array ids loop perform pg_advisory_xact_lock(hashtextextended('sanitario:claim:'||fazenda_id::text||':'||ag.obrigacao_origem_agenda_id::text||':'||target::text,0)); end loop;
   if exists(select 1 from public.sanitario_atendimentos s where s.fazenda_id=fazenda_id and s.obrigacao_origem_agenda_id=ag.obrigacao_origem_agenda_id and s.animal_id=any(ids)) then
    raise exception 'SANITARIO_CONTINUATION_ALREADY_ATTENDED' using errcode='23514'; end if;
   if (p->>'planned_for')::date is null then raise exception 'SANITARIO_CONTINUATION_DATE_REQUIRED' using errcode='23514'; end if;
   if (p->>'planned_for')::date<ag.janela_inicio or (ag.janela_fim is not null and (p->>'planned_for')::date>ag.janela_fim) then
    raise exception 'SANITARIO_CONTINUATION_OUTSIDE_WINDOW' using errcode='23514'; end if;
   if ag.catalog_protocolo_v2_id is not null and not exists(select 1 from public.sanitario_protocolos_v2 cp
    left join public.sanitario_protocolo_itens_versions_v2 ci on ci.id=ag.catalog_protocol_item_version_v2_id and ci.protocol_id=cp.id
    where cp.id=ag.catalog_protocolo_v2_id and cp.status='active' and cp.approval_status='approved' and cp.deleted_at is null
     and (cp.fazenda_id is null or cp.fazenda_id=fazenda_id) and (ag.catalog_protocol_item_version_v2_id is null or (ci.status='active' and ci.deleted_at is null))) then
    raise exception 'SANITARIO_CONTINUATION_SOURCE_NOT_ACTIVE' using errcode='23514'; end if;
   if (select count(*) from public.animais an where an.fazenda_id=fazenda_id and an.id=any(ids) and an.deleted_at is null)<>cardinality(ids) then
    raise exception 'SANITARIO_CONTINUATION_TARGET_INVALID' using errcode='23503'; end if;
   new_agenda:=dom;
   -- Copy the original prescription/configuration, never shift the original date.
   perform set_config('rebanhosync.sanitario_continuation_root',ag.obrigacao_origem_agenda_id::text,true);
   insert into public.sanitario_agenda_v2(id,fazenda_id,dedup_key,janela_inicio,janela_fim,data_programada,acao_sanitaria,lote_id,
    catalog_protocolo_v2_id,catalog_protocol_item_version_v2_id,protocolo_id,protocol_item_version_id,protocol_item_snapshot,produto_snapshot,produto_classe,metadata,client_id,client_op_id,client_tx_id,contract_version,domain_op_id)
    values(new_agenda,fazenda_id,'continuation:'||req.result_id::text,ag.janela_inicio,ag.janela_fim,(p->>'planned_for')::date,ag.acao_sanitaria,ag.lote_id,
    ag.catalog_protocolo_v2_id,ag.catalog_protocol_item_version_v2_id,ag.protocolo_id,ag.protocol_item_version_id,ag.protocol_item_snapshot,ag.produto_snapshot,ag.produto_classe,
    ag.metadata||jsonb_build_object('continuation_request_id',req.id,'source_result_id',req.result_id,'source_agenda_id',agenda_id),client,op,(a->>'client_tx_id')::uuid,3,dom);
   -- The insert guard assigns roots. Continuation is the explicit exception, tied to a decision.
   perform set_config('rebanhosync.sanitario_continuation_root','',true);
   insert into public.sanitario_agenda_animais_v2(agenda_id,fazenda_id,animal_id) select new_agenda,fazenda_id,unnest(ids);
  end if;
  update public.sanitario_continuidade_solicitacoes c set decision=p->>'decision',decision_reason=p->>'reason',decided_by=actor_user_id,continuation_id=new_agenda,updated_at=now() where c.id=req.id;
  result:=jsonb_build_object('request_id',req.id,'decision',p->>'decision','continuation_id',new_agenda);
 end if;
 if act not in ('prepare_close','confirm_close') then
  update public.sanitario_agenda_v2 g set operational_revision=operational_revision+1,closing_barrier=null where g.id=agenda_id and g.fazenda_id=fazenda_id;
 end if;
 result:=coalesce(result,'{}')||jsonb_build_object('agenda_id',agenda_id,'command',command);
 insert into public.sanitario_sync_v2_operations(fazenda_id,operation_kind,entity_id,client_op_id,domain_op_id,actor_user_id,contract_version,request_fingerprint,canonical_result)
 values(fazenda_id,'collaboration',agenda_id,op,dom,actor_user_id,3,fingerprint,result);
 perform set_config('rebanhosync.sanitario_v3_farm','',true);
 perform set_config('rebanhosync.sanitario_v3_actor','',true);
 perform set_config('rebanhosync.sanitario_reconcile','',true);
 perform set_config('rebanhosync.sanitario_additional','',true);
 return result;
end $$;
revoke all on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean) to service_role;
revoke all on function public.internal_sanitario_result_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.internal_sanitario_result_snapshot(uuid,uuid) to service_role;
revoke all on function public.guard_sanitario_collaboration_write() from public,anon,authenticated;
grant execute on function public.guard_sanitario_collaboration_write() to service_role;
commit;
