-- A non-pharmacological assessment remains a V3 Event, with the same admission,
-- authorization, receipt and append-only participant relations as other facts.
begin;
alter table public.eventos_sanitario alter column produto drop not null;
alter table public.eventos_sanitario add constraint ck_sanitary_assessment_product_v1
  check ((tipo::text = 'avaliacao' and produto is null) or (tipo::text <> 'avaliacao' and produto is not null));

create function public.internal_validate_sanitary_assessment_v1(p_farm uuid, a jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e jsonb:=a->'event_payload'; d jsonb:=a->'detail_payload'; x jsonb:=e->'payload'->'assessment';
 old_event public.eventos%rowtype; old_assessment jsonb;
begin
 if e->'payload'->>'schema' is distinct from 'sanitary_assessment_v1'
    or d->>'tipo' is distinct from 'avaliacao' or jsonb_typeof(x) is distinct from 'object'
    or x->'schema_version' is distinct from '1'::jsonb
    or x->>'result' not in ('no_treatment_indicated','treatment_indicated','insufficient_data') or x->>'result' is null
    or x->>'origin' is distinct from 'farm_assessment'
    or nullif(btrim(x->>'responsible_name'),'') is null
    or x->>'cycle_key' !~ '^[0-9]{4}$' or x->>'cycle_key' is null
    or (e->>'natureza' = 'standalone_fact' and extract(year from ((e->>'occurred_at')::timestamptz at time zone 'America/Sao_Paulo'))::text is distinct from x->>'cycle_key')
    or ((e->>'occurred_at')::timestamptz at time zone 'America/Sao_Paulo')::date > (now() at time zone 'America/Sao_Paulo')::date
    or jsonb_typeof(x->'item_version') is distinct from 'number'
    or x->>'item_version' !~ '^[1-9][0-9]{0,8}$'
    or nullif(x->>'protocol_id','') is null or nullif(x->>'item_id','') is null
    or (x->'observation' is not null and jsonb_typeof(x->'observation') not in ('string','null'))
    or e->>'source_sanitario_agenda_v2_id' is not null
    or e->>'natureza' not in ('standalone_fact','correction')
    or exists(select 1 from jsonb_object_keys(e->'payload') k where k <> all(array['schema','assessment']))
    or exists(select 1 from jsonb_object_keys(x) k where k <> all(array['schema_version','result','protocol_id','item_id','item_version','cycle_key','responsible_name','origin','observation']))
    or exists(select 1 from unnest(array['produto_sanitario_v2_id','insumo_id','estoque_lote_id','produto_nome_snapshot','estoque_lote_codigo_snapshot','lote_fabricante','validade_produto','dose_quantidade','dose_unidade','via_aplicacao','carencia_carne_dias','carencia_leite_dias','carencia_carne_ate','carencia_leite_ate','custo_unitario_snapshot','custo_total_snapshot']) k where d->>k is not null)
    or coalesce(d->'produto_snapshot','{}'::jsonb) <> '{}'::jsonb
    or coalesce(d->'payload','{}'::jsonb) <> '{}'::jsonb then
   raise exception 'SANITARIO_ASSESSMENT_INVALID' using errcode='22023';
 end if;
 if e->>'animal_id' is not null and not exists(select 1 from jsonb_array_elements(a->'event_animals') participant where participant->>'animal_id' = e->>'animal_id') then
   raise exception 'SANITARIO_ASSESSMENT_ANIMAL_MISMATCH' using errcode='22023';
 end if;
 if not exists(select 1 from public.sanitario_protocolo_itens_versions_v2 i
   join public.sanitario_protocolos_v2 p on p.id=i.protocol_id
   where i.id=(x->>'item_id')::uuid and p.id=(x->>'protocol_id')::uuid
     and i.version=(x->>'item_version')::integer and i.action_type='manejo_sanitario'
     and i.snapshot_template->'metadata'->>'planning_scope'='assessment_only'
     and (p.fazenda_id is null or p.fazenda_id=p_farm)) then
   raise exception 'SANITARIO_ASSESSMENT_PROTOCOL_INVALID' using errcode='23503';
 end if;
 if e->>'natureza'='correction' then
   perform pg_advisory_xact_lock(hashtextextended('sanitary-assessment-correction:'||p_farm::text||':'||coalesce(e->>'corrige_evento_id',''),0));
   select * into old_event from public.eventos where id=(e->>'corrige_evento_id')::uuid and fazenda_id=p_farm and deleted_at is null;
   if not found or old_event.payload->>'schema' is distinct from 'sanitary_assessment_v1'
      or ((e->>'occurred_at')::timestamptz at time zone 'America/Sao_Paulo')::date < (old_event.occurred_at at time zone 'America/Sao_Paulo')::date
      or not exists(select 1 from public.eventos_sanitario where evento_id=old_event.id and fazenda_id=p_farm and tipo::text='avaliacao')
      or exists(select 1 from public.eventos where fazenda_id=p_farm and corrige_evento_id=old_event.id and id <> (e->>'id')::uuid and deleted_at is null)
      or (select array_agg(animal_id order by animal_id) from public.eventos_animais where fazenda_id=p_farm and evento_id=old_event.id)
         is distinct from (select array_agg((z->>'animal_id')::uuid order by (z->>'animal_id')::uuid) from jsonb_array_elements(a->'event_animals') z) then
     raise exception 'SANITARIO_ASSESSMENT_CORRECTION_INVALID' using errcode='22023';
   end if;
   old_assessment:=old_event.payload->'assessment';
   if (x->>'protocol_id',x->>'item_id',x->>'item_version',x->>'cycle_key') is distinct from
      (old_assessment->>'protocol_id',old_assessment->>'item_id',old_assessment->>'item_version',old_assessment->>'cycle_key')
      or nullif(btrim(e->>'observacoes'),'') is null then
     raise exception 'SANITARIO_ASSESSMENT_CORRECTION_INVALID' using errcode='22023';
   end if;
 elsif e->>'corrige_evento_id' is not null then
   raise exception 'SANITARIO_ASSESSMENT_CORRECTION_INVALID' using errcode='22023';
 end if;
end $$;
revoke all on function public.internal_validate_sanitary_assessment_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.internal_validate_sanitary_assessment_v1(uuid,jsonb) to service_role;

do $$
declare d text; old text; replacement text;
begin
 d:=pg_get_functiondef('public.internal_sanitario_admit_v3_implementation(uuid,uuid,text,jsonb,boolean)'::regprocedure);
 old:=$old$    detail := jsonb_populate_record(null::public.sanitario_sync_v2_detail_input,a->'detail_payload');$old$;
 replacement:=old||$new$
    if event.payload->>'schema'='sanitary_assessment_v1' or detail.tipo::text='avaliacao' then
      perform public.internal_validate_sanitary_assessment_v1(fazenda_id,a);
    end if;$new$;
 if position(old in d)=0 then raise exception 'SANITARIO_ASSESSMENT_ADMISSION_ANCHOR_MISSING'; end if;
 d:=replace(d,old,replacement);
 old:=$old$    if event.natureza='standalone_fact' and (coalesce(event.payload->>'entry_history_source','') not in ('external_documented','external_declared')$old$;
 replacement:=$new$    if event.natureza='standalone_fact' and event.payload->>'schema' is distinct from 'sanitary_assessment_v1' and (coalesce(event.payload->>'entry_history_source','') not in ('external_documented','external_declared')$new$;
 if position(old in d)=0 then raise exception 'SANITARIO_ASSESSMENT_HISTORY_ANCHOR_MISSING'; end if;
 d:=replace(d,old,replacement); execute d;
 d:=pg_get_functiondef('public.internal_sanitario_sync_v2_apply_factual_core(uuid,uuid,integer,uuid,uuid,bigint,public.sanitario_sync_v2_event_input,public.sanitario_sync_v2_detail_input,public.sanitario_sync_v2_event_animal_input[])'::regprocedure);
 old:=$old$    coalesce(nullif(btrim(detail_payload.produto_nome_snapshot), ''), 'Produto sanitario v2'),$old$;
 replacement:=$new$    case when detail_payload.tipo::text='avaliacao' then null else coalesce(nullif(btrim(detail_payload.produto_nome_snapshot), ''), 'Produto sanitario v2') end,$new$;
 if position(old in d)=0 then raise exception 'SANITARIO_ASSESSMENT_PRODUCT_ANCHOR_MISSING'; end if;
 d:=replace(d,old,replacement); execute d;
end $$;
commit;
