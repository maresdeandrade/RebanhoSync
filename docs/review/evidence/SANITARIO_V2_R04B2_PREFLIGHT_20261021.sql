-- PREPARED ONLY. Read-only, after authorization, only project zqloazqzhwauamcejmuz.
begin transaction isolation level repeatable read read only;
select current_database() as database,current_user as db_role,inet_server_addr() as server_address;
select version,name from supabase_migrations.schema_migrations order by version;
select count(*) as migrations,md5(string_agg(version||':'||name,'|' order by version)) as fingerprint from supabase_migrations.schema_migrations;
select p.oid::regprocedure as routine,md5(pg_get_functiondef(p.oid)) as definition_md5,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('internal_sanitario_review_content_v2','internal_sanitario_review_fields_v2','sanitario_catalog_decide_v2','sanitario_catalog_review_preview_v2') order by p.proname;
select to_jsonb(t) as protected_approved_item from public.sanitario_protocolo_itens_versions_v2 t where id=any(array['0aa8fb30-fe4f-5a37-a100-ead8f568d5e3','4efb40be-1a71-5380-a9e8-c9e2d9c72d62','a6c83dd1-80fd-551a-b877-ee3a9eab1f1e','b34673c2-5d51-5d25-9ee2-60bfe5825550','c1866199-bf9d-506e-af05-dd84f3165c90','e10a3a77-a91e-5fd4-afab-1276526404ef','e711773e-88ee-5107-aa73-68e7337468be']::uuid[]) order by id;
select to_jsonb(t) as r05_agenda from public.sanitario_agenda_v2 t where fazenda_id='2d8a30d9-bd9c-41b4-a71d-93d2d293058f'::uuid order by id;
select count(*) as r05_events from public.eventos where fazenda_id='2d8a30d9-bd9c-41b4-a71d-93d2d293058f'::uuid;
select to_jsonb(t) as gate from public.sanitario_sync_v2_gates t order by fazenda_id;
select count(*) as prior_sanitary_decisions from public.app_admin_audit_events where action='SANITARY_RULE_DECISION_V2';
select to_jsonb(t) as item_version from public.sanitario_protocolo_itens_versions_v2 t where protocol_id=any(array['c033a955-0492-4f0f-b068-667c127c80ad','6e5f7841-bd23-4572-83bf-09bbf579eaf5']::uuid[]) order by protocol_id,logical_item_key,version;
select to_jsonb(t) as protocol from public.sanitario_protocolos_v2 t where id=any(array['c033a955-0492-4f0f-b068-667c127c80ad','6e5f7841-bd23-4572-83bf-09bbf579eaf5']::uuid[]) order by id;
select to_jsonb(t) as class from public.sanitario_product_classes_v2 t where id=any(array['d93e2a18-adf9-4988-8849-1b69889832b9','e014edb6-8273-4eb8-aece-ae6ecd6cc36e']::uuid[]) order by id;
select to_jsonb(t) as source from public.sanitario_fontes_tecnicas_v2 t where id=any(array['e009b927-fe7e-414d-8a37-cef5a2ee7ff7','953be191-f9ae-44ab-bb97-aa29fac824f4']::uuid[]) order by id;
select to_jsonb(t) as product from public.sanitario_produtos_v2 t where id=any(array['239a438c-abe0-568e-b24b-793001a08f98','820e0950-e617-5fcd-a3b7-351f855b2ba4']::uuid[]) order by id;
select to_jsonb(t) as coverage from public.sanitario_fonte_cobertura_campos_v2 t where source_id=any(array['e009b927-fe7e-414d-8a37-cef5a2ee7ff7','953be191-f9ae-44ab-bb97-aa29fac824f4']::uuid[]) order by id;
select to_jsonb(t) as product_source from public.sanitario_produto_fontes_v2 t where product_id=any(array['239a438c-abe0-568e-b24b-793001a08f98','820e0950-e617-5fcd-a3b7-351f855b2ba4']::uuid[]) order by product_id,source_id,field_key;
commit;
