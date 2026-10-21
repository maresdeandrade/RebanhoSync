-- Global catalog governance. No seed, reviewer bootstrap, agenda, event or stock writes.
-- Audit authority remains app_admin_audit_events; catalog tables remain canonical.
create function public.internal_sanitario_review_content_v2(_protocol uuid, _items uuid[])
returns jsonb language sql stable set search_path = pg_catalog, public as $$
  with selected as (
    select i.* from public.sanitario_protocolo_itens_versions_v2 i
    where i.protocol_id = _protocol and i.id = any(_items)
  ), refs as (
    select r.value as ref from selected i,
    lateral jsonb_each(i.source_refs_by_field) f,
    lateral jsonb_array_elements(case when jsonb_typeof(f.value) = 'array' then f.value else '[]'::jsonb end) r
  )
  select jsonb_build_object(
    'contract_version', 1,
    'protocol', (select to_jsonb(p) from public.sanitario_protocolos_v2 p where p.id = _protocol),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from selected i), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.sanitario_fontes_tecnicas_v2 s
      where s.id::text in (select ref->>'id' from refs)), '[]'::jsonb),
    'coverage', coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.sanitario_fonte_cobertura_campos_v2 c
      where c.id::text in (select jsonb_array_elements_text(coalesce(ref->'metadata'->'coverage_ids', '[]'::jsonb)) from refs)), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.sanitario_produtos_v2 p
      where p.id in (select product_id from selected)), '[]'::jsonb)
  );
$$;

-- Validate registry-backed field mappings, reconstructing references from the DB.
-- A reviewed regional assessment is not a promotion of its guideline to norma/bula.
create function public.internal_sanitario_review_fields_v2(_content jsonb, _actor uuid, _at timestamptz, _reference text)
returns jsonb language plpgsql set search_path = pg_catalog, public as $$
declare
  i jsonb; r jsonb; s jsonb; c jsonb; field text; fields text[];
  reviewed jsonb; refs jsonb; result jsonb := '{}'::jsonb;
  assessment boolean; strong boolean; criterion text; n integer; valid_n integer;
begin
  if _content->'protocol'->>'status' = 'retired'
    or _content->'protocol'->>'legal_status' in ('bloqueado','experimental_alerta') then
    raise exception 'PROTOCOL_NOT_AUTOMATABLE' using errcode = '23514';
  end if;
  for i in select value from jsonb_array_elements(_content->'items') loop
    if i->>'status' <> 'draft' or i->>'deleted_at' is not null then
      raise exception 'ITEM_NOT_DRAFT' using errcode = '40001';
    end if;
    if _content->'protocol'->>'family_code' in ('raiva_herbivoros','febre_aftosa')
      or i->>'logical_item_key' = 'lepto_primovac_dose2'
      or i->'operational_window_rule'->>'type' = 'blocked'
      or i->>'item_status' in ('bloqueado','somente_alerta')
      or position('no_agenda_auto' in (i->'limitations')::text || (i->'snapshot_template')::text) > 0 then
      raise exception 'AUTOMATION_EXPRESSLY_RESTRICTED' using errcode = '23514';
    end if;
    assessment := i->'snapshot_template'->'metadata'->>'planning_scope' = 'assessment_only';
    if assessment then
      if coalesce(i->'dose_rule', 'null'::jsonb) not in ('null'::jsonb, '{}'::jsonb)
        or coalesce(i->'route_rule', 'null'::jsonb) not in ('null'::jsonb, '{}'::jsonb)
        or i->>'product_id' is not null
        or not (i->>'product_requirement_kind' = 'none' and i->>'action_type' = 'manejo_sanitario'
          or i->>'logical_item_key' = 'b19_femeas_3_8_meses' and i->>'product_requirement_kind' = 'product_class') then
        raise exception 'ASSESSMENT_CANNOT_AUTHORIZE_APPLICATION' using errcode = '23514';
      end if;
      fields := array['eligibility_rule','operational_window','product_requirement'];
    else
      if not exists (select 1 from jsonb_array_elements(_content->'products') p
        where p->>'id' = i->>'product_id' and p->>'deleted_at' is null
          and p->>'status_curatorial' = 'ativo' and nullif(p->>'registro_numero','') is not null
          and p->'metadata'->>'registration_current_validity' = 'verified')
        or coalesce(i->'dose_rule','{}'::jsonb) in ('{}'::jsonb, 'null'::jsonb)
        or coalesce(i->'route_rule','{}'::jsonb) in ('{}'::jsonb, 'null'::jsonb) then
        raise exception 'COMMERCIAL_EVIDENCE_REQUIRED' using errcode = '23514';
      end if;
      fields := array['eligibility_rule','operational_window','product_requirement','dose','route','species_authorization'];
    end if;
    reviewed := i->'source_refs_by_field';
    foreach field in array fields loop
      refs := '[]'::jsonb;
      if jsonb_typeof(reviewed->field) is distinct from 'array' or jsonb_array_length(reviewed->field) = 0 then
        raise exception 'FIELD_SOURCE_REQUIRED:%', field using errcode = '23514';
      end if;
      for r in select value from jsonb_array_elements(reviewed->field) loop
        select value into s from jsonb_array_elements(_content->'sources') where value->>'id' = r->>'id';
        if s is null or s->>'scope' <> 'global' or s->>'deleted_at' is not null
          or s->>'evidence_status' in ('NAO_AUTORIZADO','EXTRAPOLADO')
          or s->>'source_key' is distinct from r->>'source_ref' then
          raise exception 'REGISTERED_GLOBAL_SOURCE_REQUIRED:%', field using errcode = '23514';
        end if;
        strong := s->>'strength' = 'forte' and s->>'kind' <> 'guideline_apoio'
          and s->>'evidence_status' in ('SIM_BULA','SIM_NORMA');
        criterion := case
          when i->>'logical_item_key' in ('recria_maio','recria_julho','recria_setembro') then 'regional_applicability_5_7_9'
          when i->>'logical_item_key' = 'pre_desmama_situacional' then 'pre_weaning_criteria'
          when i->>'logical_item_key' = 'pre_confinamento_dose_unica' then 'pre_confinement_criteria'
          when i->>'logical_item_key' = 'matrizes_pre_parto_antiparasitario' then 'pre_partum_criteria' end;
        if not strong and not coalesce((assessment and i->>'product_requirement_kind' = 'none'
          and s->>'source_key' = 'SRC_EMBRAPA_REC_TEC_26_VERMINOSE_DF' and criterion is not null
          and i->'snapshot_template'->'metadata'->'assessment_region_ufs' = '["DF"]'::jsonb),false) then
          raise exception 'INSUFFICIENT_FIELD_EVIDENCE:%', field using errcode = '23514';
        end if;
        n := 0; valid_n := 0;
        for c in select value from jsonb_array_elements(_content->'coverage')
          where (r->'metadata'->'coverage_ids') ? (value->>'id') loop
          n := n + 1;
          if c->>'source_id' = s->>'id' and c->>'deleted_at' is null and (
            strong and c->>'coverage_status' = 'covers' and c->>'field_key' = any(case field
              when 'eligibility_rule' then array[field,'legal_requirement','species_authorization','sex_age','regional_restrictions']
              when 'operational_window' then array[field,'sex_age','recurrence']
              when 'product_requirement' then array[field,'legal_requirement'] else array[field] end)
            or not strong and c->>'field_key' = criterion and c->>'coverage_status' in ('covers','partially_covers')) then
            valid_n := valid_n + 1;
          end if;
        end loop;
        if n = 0 or n <> valid_n or n <> jsonb_array_length(r->'metadata'->'coverage_ids') then
          raise exception 'FIELD_COVERAGE_MISMATCH:%', field using errcode = '23514';
        end if;
        refs := refs || jsonb_build_array(jsonb_build_object(
          'source_ref', s->>'source_key', 'id', s->>'id', 'kind', s->>'kind', 'scope', 'global',
          'title', s->>'title', 'strength', s->>'strength', 'evidenceStatus', s->>'evidence_status',
          'fieldKeys', jsonb_build_array(field), 'metadata', jsonb_build_object(
            'coverage_ids', r->'metadata'->'coverage_ids', 'catalogFieldReview', jsonb_build_object(
              'actorId', _actor, 'approvedAt', _at, 'decisionReference', _reference,
              'protocolId', i->>'protocol_id', 'itemId', i->>'id', 'itemVersion', (i->>'version')::integer,
              'field', field, 'scope', case when assessment then 'assessment_only' else 'defined_scheme' end))));
      end loop;
      reviewed := jsonb_set(reviewed, array[field], refs);
    end loop;
    result := result || jsonb_build_object(i->>'id', reviewed);
  end loop;
  return result;
end;
$$;

create function public.sanitario_catalog_review_preview_v2(_protocol_id uuid, _expected_version integer, _item_ids uuid[])
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare content jsonb; blockers jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_app_admin() then raise exception 'CATALOG_REVIEW_FORBIDDEN' using errcode = '42501'; end if;
  if _protocol_id is null or _expected_version is null or coalesce(cardinality(_item_ids),0) not between 1 and 20
    or cardinality(_item_ids) <> (select count(distinct x) from unnest(_item_ids) x) then
    raise exception 'INVALID_REVIEW_SCOPE' using errcode = '22023';
  end if;
  content := public.internal_sanitario_review_content_v2(_protocol_id, _item_ids);
  if content->'protocol'->>'scope' is distinct from 'global' or content->'protocol'->>'deleted_at' is not null
    or (content->'protocol'->>'version')::integer is distinct from _expected_version
    or jsonb_array_length(content->'items') <> cardinality(_item_ids) then
    raise exception 'REVIEW_VERSION_CONFLICT' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.sanitario_protocolo_itens_versions_v2 i
    join public.sanitario_protocolo_itens_versions_v2 newer
      on newer.protocol_id = i.protocol_id and newer.logical_item_key = i.logical_item_key
      and newer.version > i.version and newer.deleted_at is null
    where i.protocol_id = _protocol_id and i.id = any(_item_ids)
  ) then raise exception 'OBSOLETE_ITEM_VERSION' using errcode = '40001'; end if;
  begin perform public.internal_sanitario_review_fields_v2(content, auth.uid(), transaction_timestamp(), 'preview');
  exception when check_violation or serialization_failure then blockers := jsonb_build_array(sqlerrm); end;
  return jsonb_build_object('content', content, 'reviewed_content_digest', encode(sha256(convert_to(content::text,'UTF8')),'hex'),
    'protocol_id', _protocol_id, 'expected_version', _expected_version, 'item_ids', to_jsonb(_item_ids), 'blockers', blockers);
end;
$$;

create function public.sanitario_catalog_decide_v2(_protocol_id uuid, _expected_version integer, _item_ids uuid[],
  _reviewed_content_digest text, _result text, _justification text, _request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor uuid := auth.uid(); at_time timestamptz := transaction_timestamp();
  request jsonb; old public.app_admin_audit_events%rowtype; preview jsonb; content jsonb; mappings jsonb;
  receipt jsonb; reference text := 'sanitary-v2:' || _request_id::text; i jsonb;
begin
  if actor is null or not public.is_app_admin() then raise exception 'CATALOG_REVIEW_FORBIDDEN' using errcode = '42501'; end if;
  perform 1 from public.app_superadmins where user_id = actor for share;
  if not found then raise exception 'CATALOG_REVIEW_FORBIDDEN' using errcode = '42501'; end if;
  if _request_id is null or _result not in ('approved','rejected') or _result is null
    or length(btrim(coalesce(_justification,''))) not between 10 and 2000 or _reviewed_content_digest !~ '^[a-f0-9]{64}$'
    or _reviewed_content_digest is null then raise exception 'INVALID_REVIEW_DECISION' using errcode = '22023'; end if;
  request := jsonb_build_object('protocol_id',_protocol_id,'expected_version',_expected_version,
    'item_ids',(select jsonb_agg(x order by x) from unnest(_item_ids) x),
    'digest',_reviewed_content_digest,'result',_result,'justification',_justification);
  perform pg_advisory_xact_lock(hashtextextended('sanitary-review:' || _request_id::text,0));
  select * into old from public.app_admin_audit_events where id = _request_id;
  if found then
    if old.actor_user_id <> actor or old.action <> 'SANITARY_RULE_DECISION_V2' or old.metadata->'request' is distinct from request then
      raise exception 'DECISION_REQUEST_CONFLICT' using errcode = '40001';
    end if;
    return old.state_after;
  end if;
  perform 1 from public.sanitario_protocolos_v2 where id = _protocol_id for update;
  perform 1 from public.sanitario_protocolo_itens_versions_v2 where protocol_id = _protocol_id and id = any(_item_ids) order by id for update;
  content := public.internal_sanitario_review_content_v2(_protocol_id,_item_ids);
  perform 1 from public.sanitario_fontes_tecnicas_v2 where id::text in (select value->>'id' from jsonb_array_elements(content->'sources')) order by id for share;
  perform 1 from public.sanitario_fonte_cobertura_campos_v2 where id::text in (select value->>'id' from jsonb_array_elements(content->'coverage')) order by id for share;
  perform 1 from public.sanitario_produtos_v2 where id::text in (select value->>'id' from jsonb_array_elements(content->'products')) order by id for share;
  preview := public.sanitario_catalog_review_preview_v2(_protocol_id,_expected_version,_item_ids);
  content := preview->'content';
  if preview->>'reviewed_content_digest' <> _reviewed_content_digest then raise exception 'REVIEW_DIGEST_CONFLICT' using errcode = '40001'; end if;
  if _result = 'approved' then
    mappings := public.internal_sanitario_review_fields_v2(content,actor,at_time,reference);
    update public.sanitario_protocolos_v2 set status = 'active', approval_status = 'approved', approved_by = actor, approved_at = at_time,
      metadata = metadata || jsonb_build_object('agenda_allowed',true,'approved_for_catalog',true,
        'curationStatus','approved_for_catalog','automationStatus','agenda_allowed') where id = _protocol_id;
    for i in select value from jsonb_array_elements(content->'items') loop
      update public.sanitario_protocolo_itens_versions_v2 set status = 'active', allows_agenda_auto = true,
        source_refs_by_field = mappings->(i->>'id'),
        snapshot_template = jsonb_set(snapshot_template,'{metadata}',coalesce(snapshot_template->'metadata','{}'::jsonb) ||
          jsonb_build_object('agenda_allowed',true,'approved_for_catalog',true,'curationStatus','approved_for_catalog',
            'automationStatus','agenda_allowed','catalog_decision_reference',reference,'reviewed_content_digest',_reviewed_content_digest))
        where id = (i->>'id')::uuid and version = (i->>'version')::integer and status = 'draft';
      if not found then raise exception 'ITEM_VERSION_CONFLICT' using errcode = '40001'; end if;
    end loop;
  end if;
  receipt := jsonb_build_object('decision_reference',reference,'actor_id',actor,'decided_at',at_time,
    'approved_at',case when _result = 'approved' then at_time else null end,'result',_result,'justification',_justification,
    'reviewed_content_digest',_reviewed_content_digest,'protocol_id',_protocol_id,'protocol_version',_expected_version,
    'item_versions',(select jsonb_agg(jsonb_build_object('id',x->>'id','version',x->'version') order by x->>'id') from jsonb_array_elements(content->'items') x));
  insert into public.app_admin_audit_events(id,actor_user_id,action,target_type,target_id,state_before,state_after,metadata,created_at)
    values(_request_id,actor,'SANITARY_RULE_DECISION_V2','sanitario_protocolos_v2',_protocol_id::text,content,receipt,
      jsonb_build_object('request',request,'source','catalog_review_v2'),at_time);
  return receipt;
end;
$$;

revoke all on function public.internal_sanitario_review_content_v2(uuid,uuid[]) from public,anon,authenticated,service_role;
revoke all on function public.internal_sanitario_review_fields_v2(jsonb,uuid,timestamptz,text) from public,anon,authenticated,service_role;
revoke all on function public.sanitario_catalog_review_preview_v2(uuid,integer,uuid[]) from public,anon,authenticated,service_role;
revoke all on function public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.sanitario_catalog_review_preview_v2(uuid,integer,uuid[]) to authenticated;
grant execute on function public.sanitario_catalog_decide_v2(uuid,integer,uuid[],text,text,text,uuid) to authenticated;
