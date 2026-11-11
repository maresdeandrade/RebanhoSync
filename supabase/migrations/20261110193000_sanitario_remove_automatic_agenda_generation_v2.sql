-- Remove o contrato de geração automática de Agendas Sanitárias.
-- Corretiva e forward-only: não reescreve migrations aplicadas nem migra dados legados.
begin;

create function pg_temp.sanitario_replace_once(source text, anchor text, replacement text)
returns text language plpgsql as $$
declare matches integer;
begin
  matches := (length(source) - length(replace(source, anchor, ''))) / nullif(length(anchor), 0);
  if matches is distinct from 1 then
    raise exception 'SANITARIO_AUTOMATION_CUTOVER_BASELINE_MISMATCH: expected one anchor, found %', matches;
  end if;
  return replace(source, anchor, replacement);
end $$;

-- Keep the current collaboration/death wrappers and reject the removed V2 command
-- at the shared V3 admission implementation.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.internal_sanitario_v3_fingerprint(uuid,uuid,text,jsonb)'::regprocedure);
  d := pg_temp.sanitario_replace_once(d,
    $old$    when 'set_automation_plan' then return encode(sha256(convert_to(jsonb_build_object('actor',actor,'plan',a->'plan','expected_plan',a->'expected_plan','expected_revision',a->'expected_revision','client_tx_id',a->'client_tx_id')::text,'UTF8')),'hex');
$old$,
    '');
  execute d;

  d := pg_get_functiondef('public.internal_sanitario_admit_v3_implementation(uuid,uuid,text,jsonb,boolean)'::regprocedure);
  d := pg_temp.sanitario_replace_once(d,
    $old$  if command not in ('create_agenda','replace_agenda_animals','apply_factual_core','close_agenda','set_automation_plan','reschedule_agenda') then
$old$,
    $new$  if command not in ('create_agenda','replace_agenda_animals','apply_factual_core','close_agenda','reschedule_agenda') then
$new$);
  d := pg_temp.sanitario_replace_once(d,
    $old$    when 'set_automation_plan' then kind:='automation_plan'; entity:=fazenda_id;
$old$,
    '');
  d := pg_temp.sanitario_replace_once(d,
    $old$  elsif command='set_automation_plan' then
    result := public.internal_sanitario_sync_v2_set_automation_plan(actor_user_id,fazenda_id,version,client,domain_id,(a->>'expected_revision')::bigint,a->>'client_id',(a->>'client_tx_id')::uuid,a->'plan',a->'expected_plan');
$old$,
    '');
  execute d;
end $$;

-- Reject stale queued automatic creates; all accepted create_agenda operations are
-- explicit/manual and retain the established identity lock, receipt and CAS rules.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.internal_sanitario_sync_v2_create_agenda(uuid,uuid,integer,uuid,uuid,public.sanitario_sync_v2_agenda_input,uuid[])'::regprocedure);
  d := pg_temp.sanitario_replace_once(d,
    $old$  if payload.protocol_item_snapshot->>'generationMode'='automatic' and exists (
    select 1 from public.sanitario_agenda_v2 a where a.fazenda_id=fazenda_id and a.dedup_key=payload.dedup_key and a.id<>payload.id
  ) then raise exception 'SANITARIO_AUTOMATIC_IDENTITY_CONFLICT' using errcode='23505'; end if;
$old$,
    $new$  if payload.protocol_item_snapshot->>'generationMode'='automatic' then
    raise exception 'SANITARIO_AUTOMATION_RETIRED' using errcode='55000';
  end if;
$new$);
  d := pg_temp.sanitario_replace_once(d,
    $old$  if payload.protocol_item_snapshot->>'generationMode'='automatic' then
    -- Validate publication and farm activation; individual eligibility stays in the existing engine.
    if not exists (
      select 1 from public.sanitario_protocolos_v2 p join public.sanitario_protocolo_itens_versions_v2 i on i.protocol_id=p.id
      join public.fazenda_sanidade_config c on c.fazenda_id=fazenda_id and c.deleted_at is null
      cross join lateral jsonb_array_elements(c.payload->'sanitary_agenda_automation_v2'->'rules') r
      where p.id=payload.protocolo_id and p.scope='global' and p.status='active' and p.deleted_at is null
        and p.approval_status='approved' and p.approved_by is not null
        and i.id=payload.protocol_item_version_id and i.status='active' and i.deleted_at is null and i.allows_agenda_auto
        and position('no_agenda_auto' in i.limitations::text || i.snapshot_template::text)=0
        and c.payload->'sanitary_agenda_automation_v2'->>'enabled'='true'
        and (payload.metadata->>'automationPlanRevision')::bigint=(c.payload->'sanitary_agenda_automation_v2'->>'revision')::bigint
        and r->>'protocolId'=p.id::text and (r->>'protocolVersion')::integer=p.version
        and r->>'itemId'=i.id::text and (r->>'itemVersion')::integer=i.version
        and (payload.protocol_item_snapshot->'planningEvidence'->>'itemVersion')::integer=i.version
        and i.product_id::text is not distinct from r->>'productId'
    ) then raise exception 'SANITARIO_AUTOMATIC_RULE_NOT_APPROVED_OR_ACTIVATED' using errcode='23514'; end if;
  end if;
$old$,
    '');
  execute d;
end $$;

-- Catalog approval remains curatorial. Manual-review scope and technical/legal
-- restrictions (including B19, rabies context, and foot-and-mouth blocks) remain.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.internal_sanitario_review_fields_v2(jsonb,uuid,timestamp with time zone,text)'::regprocedure);
  d := replace(d, 'PROTOCOL_NOT_AUTOMATABLE', 'PROTOCOL_NOT_REVIEWABLE');
  d := pg_temp.sanitario_replace_once(d,
    $old$      or i->>'allows_agenda_auto' is distinct from 'false'
      or not coalesce((i->'limitations') ? 'no_agenda_auto', false)
$old$,
    '');
  d := pg_temp.sanitario_replace_once(d,
    $old$      or (position('no_agenda_auto' in (i->'limitations')::text || (i->'snapshot_template')::text) > 0 and not manual_review) then
$old$,
    ' then');
  d := replace(d, 'AUTOMATION_EXPRESSLY_RESTRICTED', 'SANITARY_PROTOCOL_RESTRICTED');
  execute d;

  d := pg_get_functiondef('public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid)'::regprocedure);
  d := pg_temp.sanitario_replace_once(d, $old$  auto_allowed boolean; item_auto boolean;
$old$, '');
  d := pg_temp.sanitario_replace_once(d,
    $old$    auto_allowed := exists (
      select 1 from public.sanitario_protocolo_itens_versions_v2
      where protocol_id = _protocol_id and status = 'active' and deleted_at is null and allows_agenda_auto
    ) or exists (
      select 1 from jsonb_array_elements(content->'items') x
      where x->'snapshot_template'->'metadata'->>'catalog_review_scope' is distinct from 'manual_planning'
    );
$old$,
    '');
  d := pg_temp.sanitario_replace_once(d,
    $old$    update public.sanitario_protocolos_v2 set status = 'active', approval_status = 'approved', approved_by = actor, approved_at = at_time,
      metadata = metadata || jsonb_build_object('agenda_allowed',auto_allowed,'approved_for_catalog',true,
        'curationStatus','approved_for_catalog','automationStatus',case when auto_allowed then 'agenda_allowed' else 'manual_only' end) where id = _protocol_id;
$old$,
    $new$    update public.sanitario_protocolos_v2 set status = 'active', approval_status = 'approved', approved_by = actor, approved_at = at_time,
      metadata = metadata || jsonb_build_object('approved_for_catalog',true,'curationStatus','approved_for_catalog') where id = _protocol_id;
$new$);
  d := pg_temp.sanitario_replace_once(d,
    $old$      item_auto := i->'snapshot_template'->'metadata'->>'catalog_review_scope' is distinct from 'manual_planning';
      update public.sanitario_protocolo_itens_versions_v2 set status = 'active', allows_agenda_auto = item_auto,
        source_refs_by_field = mappings->(i->>'id'),
        snapshot_template = jsonb_set(snapshot_template,'{metadata}',coalesce(snapshot_template->'metadata','{}'::jsonb) ||
          jsonb_build_object('agenda_allowed',item_auto,'approved_for_catalog',true,'proposal_only',false,'curationStatus','approved_for_catalog',
            'automationStatus',case when item_auto then 'agenda_allowed' else 'manual_only' end,'catalog_decision_reference',reference,'reviewed_content_digest',_reviewed_content_digest))
        where id = (i->>'id')::uuid and version = (i->>'version')::integer and status = 'draft';
$old$,
    $new$      update public.sanitario_protocolo_itens_versions_v2 set status = 'active',
        source_refs_by_field = mappings->(i->>'id'),
        snapshot_template = jsonb_set(snapshot_template,'{metadata}',coalesce(snapshot_template->'metadata','{}'::jsonb) ||
          jsonb_build_object('approved_for_catalog',true,'proposal_only',false,'curationStatus','approved_for_catalog',
            'catalog_decision_reference',reference,'reviewed_content_digest',_reviewed_content_digest))
        where id = (i->>'id')::uuid and version = (i->>'version')::integer and status = 'draft';
$new$);
  d := replace(d, $old$coalesce(x->'snapshot_template'->'metadata'->>'catalog_review_scope','automation')$old$,
    $new$coalesce(x->'snapshot_template'->'metadata'->>'catalog_review_scope','defined_scheme')$new$);
  execute d;
end $$;

-- The group remains unusable when blocked/archived; this is a planning/curation
-- restriction, not an automation toggle. Preserve protocol/farm scope validation.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.fn_validate_protocol_item_product_class_group_v2()'::regprocedure);
  d := pg_temp.sanitario_replace_once(d, $old$  v_group_automation_status text;
$old$, '');
  d := pg_temp.sanitario_replace_once(d,
    $old$  select g.scope, g.fazenda_id, g.curation_status, g.automation_status
    into v_group_scope, v_group_fazenda_id, v_group_curation_status, v_group_automation_status
$old$,
    $new$  select g.scope, g.fazenda_id, g.curation_status
    into v_group_scope, v_group_fazenda_id, v_group_curation_status
$new$);
  d := pg_temp.sanitario_replace_once(d,
    $old$  if new.allows_agenda_auto and (
    v_group_curation_status in ('blocked', 'archived')
    or v_group_automation_status = 'blocked'
  ) then
    raise exception 'ProductClassGroup blocked/archived nao permite agenda automatica.'
      using errcode = '23514';
  end if;
$old$,
    $new$  if v_group_curation_status in ('blocked', 'archived') then
    raise exception 'ProductClassGroup blocked/archived nao permite planejamento manual.'
      using errcode = '23514';
  end if;
$new$);
  execute d;
end $$;

drop trigger if exists guard_sanitary_automation_plan_writer_v2 on public.fazenda_sanidade_config;
drop function if exists public.guard_sanitary_automation_plan_writer_v2();

drop trigger if exists trg_validate_protocol_item_product_class_group_v2 on public.sanitario_protocolo_itens_versions_v2;
create trigger trg_validate_protocol_item_product_class_group_v2
before insert or update of protocol_id, product_requirement_kind, product_class_group_id
on public.sanitario_protocolo_itens_versions_v2
for each row execute function public.fn_validate_protocol_item_product_class_group_v2();

-- The operation check rejects future automation receipts but deliberately leaves
-- old ledger rows untouched (no legacy-data rewrite/backfill).
alter table public.sanitario_sync_v2_operations drop constraint if exists ck_sanitario_sync_v2_operation_kind;
alter table public.sanitario_sync_v2_operations add constraint ck_sanitario_sync_v2_operation_kind check
  (operation_kind in ('agenda_create','agenda_targets_replace','factual_core','administrative_closure','agenda_schedule','collaboration','death_participant')) not valid;

revoke all on function public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
drop function public.internal_sanitario_sync_v2_set_automation_plan(uuid,uuid,integer,uuid,uuid,bigint,text,uuid,jsonb,jsonb);

alter table public.sanitario_protocolo_itens_versions_v2
  drop constraint if exists sanitario_protocolo_itens_versions_v2_auto_agenda_chk,
  drop column if exists allows_agenda_auto;

drop index if exists public.idx_sanitario_product_classes_v2_automation;
drop index if exists public.idx_sanitario_product_class_groups_v2_automation;
alter table public.sanitario_product_classes_v2
  drop constraint if exists sanitario_product_classes_v2_automation_chk,
  drop column if exists automation_status;
alter table public.sanitario_product_class_groups_v2
  drop constraint if exists sanitario_product_class_groups_v2_automation_chk,
  drop column if exists automation_status;

drop function pg_temp.sanitario_replace_once(text,text,text);
commit;
