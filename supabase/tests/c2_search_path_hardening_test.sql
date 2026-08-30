\set ON_ERROR_STOP on

begin;

do $$
declare
  v_expected record;
  v_oid oid;
begin
  for v_expected in
    select *
    from (values
      ('public.fn_validate_product_class_default_rule_v2()', '3bc26a21d07ebc5f84e36d808e10450f'),
      ('public.fn_validate_product_class_group_member_v2()', '5418375ce61ee29136665d1488157746'),
      ('public.prevent_admin_audit_mutation()', '9a952d9dd3442582ca4a988dd30f5e8a'),
      ('public.prevent_business_update()', '7ba108203c1cf24a38954022c1cc5596'),
      ('public.prevent_insumo_movimentacao_update()', '3106f891a98d74c9a62e810fb5411e31'),
      ('public.render_dedup_key(text,uuid,uuid,uuid,integer,date)', 'cecc1d043f1084bc1a1d128750651cca'),
      ('public.render_sanitario_canonical_dedup_key(text,uuid,text,text,integer,text,text,text)', '9bfa7a39ce6fb8fcc5f18a8b9237f4e9'),
      ('public.sanitario_dedup_period_mode(text)', '53ec32f4d8d997723c35fe7b66d873e8'),
      ('public.set_event_occurred_on()', '3b349147f545144081b0bd35d86b1e8a'),
      ('public.set_updated_at()', '9b1889f56258bf9d6554213c05019c76')
    ) as expected(signature, body_md5)
  loop
    v_oid := to_regprocedure(v_expected.signature);

    if v_oid is null then
      raise exception 'C2 function missing: %', v_expected.signature;
    end if;

    if not exists (
      select 1
      from pg_proc p
      where p.oid = v_oid
        and md5(p.prosrc) = v_expected.body_md5
        and p.prosecdef = false
        and pg_get_userbyid(p.proowner) = 'postgres'
    ) then
      raise exception 'C2 body or authorization metadata changed: %', v_expected.signature;
    end if;

    if not has_function_privilege('public', v_oid, 'execute')
       or not has_function_privilege('anon', v_oid, 'execute')
       or not has_function_privilege('authenticated', v_oid, 'execute')
       or not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception 'C2 effective execute authorization changed: %', v_expected.signature;
    end if;
  end loop;
end
$$;

do $$
declare
  v_canonical text;
  v_legacy text;
begin
  v_canonical := public.render_sanitario_canonical_dedup_key(
    'Animal',
    '11111111-1111-4111-8111-111111111111',
    'FAMILY',
    'ITEM',
    2,
    'Campaign',
    '2026',
    'br'
  );

  if v_canonical <> 'sanitario:animal:11111111-1111-4111-8111-111111111111:family:item:v2:campaign:2026:BR' then
    raise exception 'canonical dedup result changed: %', v_canonical;
  end if;

  v_legacy := public.render_dedup_key(
    'ignored-template',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    2,
    date '2026-01-02'
  );

  if v_legacy <> 'sanitario:animal:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:v2:legacy:2026-01-02' then
    raise exception 'legacy dedup result changed: %', v_legacy;
  end if;

  if public.sanitario_dedup_period_mode('campaign') <> 'campaign'
     or public.sanitario_dedup_period_mode('janela_etaria') <> 'window'
     or public.sanitario_dedup_period_mode('unexpected') <> 'unstructured' then
    raise exception 'sanitary period mapping changed';
  end if;
end
$$;

create temporary table c2_updated_at_probe (
  id integer primary key,
  updated_at timestamptz not null
);

create trigger c2_set_updated_at
before update on c2_updated_at_probe
for each row execute function public.set_updated_at();

insert into c2_updated_at_probe values (1, '2000-01-01 00:00:00+00');
update c2_updated_at_probe set id = 1 where id = 1;

do $$
begin
  if (select updated_at <= '2000-01-01 00:00:00+00' from c2_updated_at_probe where id = 1) then
    raise exception 'set_updated_at result changed';
  end if;
end
$$;

create temporary table c2_occurred_on_probe (
  id integer primary key,
  occurred_at timestamptz not null,
  occurred_on date not null default current_date
);

create trigger c2_set_event_occurred_on
before insert or update on c2_occurred_on_probe
for each row execute function public.set_event_occurred_on();

insert into c2_occurred_on_probe(id, occurred_at)
values (1, '2026-01-02 01:30:00+00');

do $$
begin
  if (select occurred_on <> date '2026-01-01' from c2_occurred_on_probe where id = 1) then
    raise exception 'set_event_occurred_on result changed';
  end if;
end
$$;

create temporary table c2_business_probe (
  id integer primary key,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_received_at timestamptz not null default now()
);

create trigger c2_prevent_business_update
before update on c2_business_probe
for each row execute function public.prevent_business_update();

insert into c2_business_probe(id) values (1);
update c2_business_probe set updated_at = updated_at + interval '1 second' where id = 1;

do $$
begin
  begin
    update c2_business_probe set payload = '{"changed":true}'::jsonb where id = 1;
    raise exception 'prevent_business_update accepted a business mutation';
  exception
    when check_violation then null;
  end;
end
$$;

create temporary table c2_inventory_probe (id integer primary key);
create trigger c2_prevent_inventory_update
before update on c2_inventory_probe
for each row execute function public.prevent_insumo_movimentacao_update();
insert into c2_inventory_probe values (1);

do $$
begin
  begin
    update c2_inventory_probe set id = 1 where id = 1;
    raise exception 'prevent_insumo_movimentacao_update accepted an update';
  exception
    when check_violation then null;
  end;
end
$$;

create temporary table c2_admin_audit_probe (id integer primary key);
create trigger c2_prevent_admin_audit_mutation
before update or delete on c2_admin_audit_probe
for each row execute function public.prevent_admin_audit_mutation();
insert into c2_admin_audit_probe values (1);

do $$
begin
  begin
    delete from c2_admin_audit_probe where id = 1;
    raise exception 'prevent_admin_audit_mutation accepted a delete';
  exception
    when check_violation then null;
  end;
end
$$;

insert into public.sanitario_product_classes_v2 (
  id, scope, class_key, name, product_type, species_scope,
  curation_status, automation_status
) values (
  'c2a00000-0000-4000-8000-000000000001',
  'global', 'c2-class', 'C2 class', 'vacina', array['bovino'],
  'candidate', 'manual_only'
);

insert into public.sanitario_product_class_groups_v2 (
  id, scope, group_key, name, curation_status, automation_status
) values (
  'c2a00000-0000-4000-8000-000000000002',
  'global', 'c2-group', 'C2 group', 'candidate', 'manual_only'
);

insert into public.sanitario_product_class_group_members_v2 (
  id, fazenda_id, scope, group_id, class_id
) values (
  'c2a00000-0000-4000-8000-000000000003',
  null, 'tenant',
  'c2a00000-0000-4000-8000-000000000002',
  'c2a00000-0000-4000-8000-000000000001'
);

insert into public.sanitario_product_class_default_rules_v2 (
  id, fazenda_id, scope, class_id, species_code
) values (
  'c2a00000-0000-4000-8000-000000000004',
  null, 'tenant',
  'c2a00000-0000-4000-8000-000000000001',
  'bovino'
);

do $$
begin
  if not exists (
    select 1
    from public.sanitario_product_class_group_members_v2
    where id = 'c2a00000-0000-4000-8000-000000000003'
      and scope = 'global'
      and fazenda_id is null
  ) then
    raise exception 'group member validation result changed';
  end if;

  if not exists (
    select 1
    from public.sanitario_product_class_default_rules_v2
    where id = 'c2a00000-0000-4000-8000-000000000004'
      and scope = 'global'
      and fazenda_id is null
  ) then
    raise exception 'default rule validation result changed';
  end if;
end
$$;

select 'C2_SEARCH_PATH_FUNCTIONAL_OK' as result;

rollback;
