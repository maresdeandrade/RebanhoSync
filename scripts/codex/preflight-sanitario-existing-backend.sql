-- Read-only inventory for zqloazqzhwauamcejmuz. No business RPC invocation.
select jsonb_build_object(
  'observed_at', statement_timestamp(),
  'migrations', (select jsonb_agg(t) from (
    select version, name, cardinality(statements) statement_count,
      encode(sha256(convert_to(regexp_replace(regexp_replace(regexp_replace(
        array_to_string(statements,E'\n'),'/\*.*?\*/','','gs'),
        '--[^\n]*','','g'),'[[:space:];]','','g'),'UTF8')),'hex') normalized_sha256
    from supabase_migrations.schema_migrations order by version
  ) t),
  'counts', jsonb_build_object(
    'protocols',(select count(*) from public.sanitario_protocolos_v2),
    'items',(select count(*) from public.sanitario_protocolo_itens_versions_v2),
    'automatic_items',(select count(*) from public.sanitario_protocolo_itens_versions_v2 where allows_agenda_auto),
    'sources',(select count(*) from public.sanitario_fontes_tecnicas_v2),
    'coverage',(select count(*) from public.sanitario_fonte_cobertura_campos_v2),
    'products',(select count(*) from public.sanitario_produtos_v2),
    'product_authorizations',(select count(*) from public.sanitario_produto_especie_autorizacao_v2),
    'product_sources',(select count(*) from public.sanitario_produto_fontes_v2),
    'dose_rules',(select count(*) from public.sanitario_produto_dose_rules_v2),
    'withdrawal_rules',(select count(*) from public.sanitario_produto_carencia_rules_v2),
    'withdrawal_sources',(select count(*) from public.sanitario_produto_carencia_fontes_v2),
    'classes',(select count(*) from public.sanitario_product_classes_v2),
    'groups',(select count(*) from public.sanitario_product_class_groups_v2),
    'members',(select count(*) from public.sanitario_product_class_group_members_v2),
    'default_rules',(select count(*) from public.sanitario_product_class_default_rules_v2),
    'agenda_v2',(select count(*) from public.sanitario_agenda_v2),
    'ledger',(select count(*) from public.sanitario_sync_v2_operations),
    'configs',(select count(*) from public.fazenda_sanidade_config),
    'automation_plans',(select count(*) from public.fazenda_sanidade_config where payload ? 'sanitary_agenda_automation_v2'),
    'users',(select count(*) from auth.users),
    'users_signed_in_30d',(select count(*) from auth.users where last_sign_in_at > now()-interval '30 days'),
    'auth_sessions',(select count(*) from auth.sessions),
    'global_reviewers',(select count(*) from public.app_superadmins)
  ),
  'farms',(select jsonb_agg(jsonb_build_object('id',id,'name',nome,'deleted',deleted_at is not null)) from public.fazendas),
  'memberships',(select jsonb_agg(t) from (select user_id,fazenda_id,role,deleted_at is not null deleted from public.user_fazendas) t),
  'gates',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.sanitario_sync_v2_gates g),
  'rpcs',(select jsonb_agg(t) from (
    select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,p.proacl,
      md5(pg_get_functiondef(p.oid)) definition_md5
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like '%sanitario%' or p.proname in ('is_app_admin','has_membership','role_in_fazenda'))
    order by p.proname
  ) t),
  'columns',(select jsonb_agg(t) from (
    select table_name,column_name,data_type,is_nullable from information_schema.columns
    where table_schema='public' and table_name in ('sanitario_agenda_v2','sanitario_sync_v2_gates','sanitario_sync_v2_operations')
    order by table_name,ordinal_position
  ) t),
  'tables',(select jsonb_agg(t) from (
    select c.relname,c.relrowsecurity,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and (c.relname like 'sanitario%v2' or c.relname like 'sanitario_sync_v2_%') order by c.relname
  ) t),
  'constraints',(select jsonb_agg(t) from (
    select r.relname,c.conname,pg_get_constraintdef(c.oid) definition from pg_constraint c join pg_class r on r.oid=c.conrelid
    join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and
    r.relname in ('sanitario_agenda_v2','sanitario_agenda_animais_v2','sanitario_agenda_closures_v2','sanitario_sync_v2_operations')
    order by r.relname,c.conname
  ) t),
  'policies',(select jsonb_agg(t) from (
    select tablename,policyname,roles,cmd,qual,with_check from pg_policies
    where schemaname='public' and (tablename like 'sanitario%v2' or tablename like 'sanitario_sync_v2_%' or tablename in ('app_superadmins','fazendas','user_fazendas'))
    order by tablename,policyname
  ) t)
) inventory;
