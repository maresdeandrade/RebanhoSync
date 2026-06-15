alter type public.sanitario_product_requirement_kind_v2_enum
  add value if not exists 'product_class_group';

alter table public.sanitario_protocolo_itens_versions_v2
  add column if not exists product_class_group_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname in (
      'sanitario_item_product_class_group_id_fkey',
      'sanitario_protocolo_itens_versions_v2_product_class_group_id_fk'
    )
      and conrelid = 'public.sanitario_protocolo_itens_versions_v2'::regclass
  ) then
    alter table public.sanitario_protocolo_itens_versions_v2
      add constraint sanitario_item_product_class_group_id_fkey
      foreign key (product_class_group_id)
      references public.sanitario_product_class_groups_v2(id)
      on delete restrict;
  end if;
end $$;

alter table public.sanitario_protocolo_itens_versions_v2
  drop constraint if exists sanitario_protocolo_itens_versions_v2_product_req_chk;

alter table public.sanitario_protocolo_itens_versions_v2
  add constraint sanitario_protocolo_itens_versions_v2_product_req_chk check (
    (
      product_requirement_kind::text = 'specific_product'
      and product_id is not null
      and product_class is null
      and product_class_group_id is null
    )
    or (
      product_requirement_kind::text = 'product_class'
      and product_id is null
      and product_class is not null
      and btrim(product_class) <> ''
      and product_class_group_id is null
    )
    or (
      product_requirement_kind::text = 'product_class_group'
      and product_id is null
      and product_class is null
      and product_class_group_id is not null
    )
    or (
      product_requirement_kind::text = 'none'
      and product_id is null
      and product_class is null
      and product_class_group_id is null
    )
  );

create index if not exists idx_sanitario_protocolo_itens_versions_v2_product_class_group
  on public.sanitario_protocolo_itens_versions_v2(product_class_group_id)
  where product_class_group_id is not null and deleted_at is null;

create or replace function public.fn_validate_protocol_item_product_class_group_v2()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_protocol_scope public.sanitario_protocol_scope_v2_enum;
  v_protocol_fazenda_id uuid;
  v_group_scope text;
  v_group_fazenda_id uuid;
  v_group_curation_status text;
  v_group_automation_status text;
begin
  if new.product_requirement_kind::text <> 'product_class_group' then
    return new;
  end if;

  select p.scope, p.fazenda_id
    into v_protocol_scope, v_protocol_fazenda_id
  from public.sanitario_protocolos_v2 p
  where p.id = new.protocol_id
    and p.deleted_at is null;

  if not found then
    raise exception 'Protocolo sanitario v2 inexistente ou deletado para protocol_id = %', new.protocol_id
      using errcode = '23514';
  end if;

  select g.scope, g.fazenda_id, g.curation_status, g.automation_status
    into v_group_scope, v_group_fazenda_id, v_group_curation_status, v_group_automation_status
  from public.sanitario_product_class_groups_v2 g
  where g.id = new.product_class_group_id
    and g.deleted_at is null;

  if not found then
    raise exception 'ProductClassGroup inexistente ou deletado para product_class_group_id = %', new.product_class_group_id
      using errcode = '23514';
  end if;

  if v_protocol_scope in ('global', 'pack') and v_group_scope <> 'global' then
    raise exception 'Protocolo % nao pode referenciar ProductClassGroup tenant.', v_protocol_scope
      using errcode = '23514';
  end if;

  if v_protocol_scope = 'fazenda' then
    if v_group_scope not in ('global', 'tenant') then
      raise exception 'Escopo invalido de ProductClassGroup: %', v_group_scope
        using errcode = '23514';
    end if;

    if v_group_scope = 'tenant' and v_group_fazenda_id is distinct from v_protocol_fazenda_id then
      raise exception 'ProductClassGroup tenant da fazenda % nao pode ser usado por protocolo da fazenda %.',
        v_group_fazenda_id, v_protocol_fazenda_id
        using errcode = '23514';
    end if;
  end if;

  if new.allows_agenda_auto and (
    v_group_curation_status in ('blocked', 'archived')
    or v_group_automation_status = 'blocked'
  ) then
    raise exception 'ProductClassGroup blocked/archived nao permite agenda automatica.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_protocol_item_product_class_group_v2
  on public.sanitario_protocolo_itens_versions_v2;

create trigger trg_validate_protocol_item_product_class_group_v2
before insert or update of protocol_id, product_requirement_kind, product_class_group_id, allows_agenda_auto
on public.sanitario_protocolo_itens_versions_v2
for each row
execute function public.fn_validate_protocol_item_product_class_group_v2();

comment on column public.sanitario_protocolo_itens_versions_v2.product_class_group_id is
  'ProductClassGroup aceito pelo item de protocolo sanitario v2. Nao valida execucao, dose ou carencia; produto real segue obrigatorio no evento quando aplicavel.';
