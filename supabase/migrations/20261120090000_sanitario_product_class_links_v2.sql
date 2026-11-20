begin;
-- Relação pull-only entre produto comercial V2 e classe técnica V2.
-- Não altera a categoria ampla sanitario_produtos_v2.classe e não cria autorização operacional.
create table if not exists public.sanitario_produto_class_links_v2 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.sanitario_produtos_v2(id) on delete restrict,
  class_id uuid not null references public.sanitario_product_classes_v2(id) on delete restrict,
  status_curatorial public.sanitario_curatorial_status_v2_enum not null default 'precisa_validar',
  source_refs jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint sanitario_produto_class_links_v2_source_refs_chk check (jsonb_typeof(source_refs) = 'array'),
  constraint sanitario_produto_class_links_v2_limitations_chk check (jsonb_typeof(limitations) = 'array'),
  constraint sanitario_produto_class_links_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

create or replace function public.fn_validate_sanitario_produto_class_link_v2()
returns trigger set search_path = public, pg_temp as $$
declare
  v_product_exists boolean;
  v_class_scope text;
  v_class_fazenda_id uuid;
begin
  if tg_op='UPDATE' and (new.product_id,new.class_id) is distinct from (old.product_id,old.class_id) then
    raise exception 'PRODUCT_CLASS_LINK_IDENTITY_IMMUTABLE';
  end if;
  if exists (select 1 from public.sanitario_product_classes_v2 where id=new.class_id and (scope <> 'global' or fazenda_id is not null)) then
    raise exception 'Relação global produto-classe não aceita classe tenant.';
  end if;
  -- Revogação/tombstone deve continuar possível após arquivar os pais.
  if new.deleted_at is not null or new.status_curatorial <> 'ativo' then
    return new;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(new.source_refs) ref
    join public.sanitario_fontes_tecnicas_v2 s on s.id::text = ref->>'id'
    where ref->>'field' = 'product_class' and s.deleted_at is null
      and s.scope = 'global' and s.strength = 'forte'
      and (s.evidence_status in ('SIM_BULA', 'SIM_NORMA') or (s.evidence_status='SIM_COMPOSICAO_FABRICANTE' and s.kind='registro_produto' and s.metadata->>'classification_only'='true'))
      and exists (select 1 from public.sanitario_produto_fontes_v2 ps
        join public.sanitario_fonte_cobertura_campos_v2 cov on cov.source_id=ps.source_id and cov.field_key=ps.field_key
        where ps.product_id=new.product_id and ps.source_id=s.id
          and ps.field_key=coalesce(ref->>'basedOnField','product_class')
          and ps.field_key in ('product_class','composition')
          and cov.deleted_at is null and cov.coverage_status='covers')
  ) then
    raise exception 'PRODUCT_CLASS_TECHNICAL_EVIDENCE_REQUIRED';
  end if;
  select exists (
    select 1
    from public.sanitario_produtos_v2
    where id = new.product_id and deleted_at is null
  ) into v_product_exists;
  if not v_product_exists then
    raise exception 'Produto comercial ativo inexistente para product_id = %', new.product_id;
  end if;

  select scope, fazenda_id
    into v_class_scope, v_class_fazenda_id
    from public.sanitario_product_classes_v2
   where id = new.class_id and deleted_at is null and curation_status = 'approved_for_catalog';
  if not found then
    raise exception 'Classe técnica ativa inexistente para class_id = %', new.class_id;
  end if;
  if v_class_scope <> 'global' or v_class_fazenda_id is not null then
    raise exception 'Relação global produto-classe não aceita classe tenant.';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_sanitario_produto_class_link_v2
  on public.sanitario_produto_class_links_v2;
create trigger trg_validate_sanitario_produto_class_link_v2
before insert or update on public.sanitario_produto_class_links_v2
for each row execute function public.fn_validate_sanitario_produto_class_link_v2();

drop trigger if exists set_updated_at_sanitario_produto_class_links_v2
  on public.sanitario_produto_class_links_v2;
create trigger set_updated_at_sanitario_produto_class_links_v2
before update on public.sanitario_produto_class_links_v2
for each row execute function public.set_updated_at();

create unique index if not exists ux_sanitario_produto_class_links_v2_active
  on public.sanitario_produto_class_links_v2 (product_id, class_id)
  where deleted_at is null;
create index if not exists idx_sanitario_produto_class_links_v2_product
  on public.sanitario_produto_class_links_v2 (product_id, updated_at);
create index if not exists idx_sanitario_produto_class_links_v2_class
  on public.sanitario_produto_class_links_v2 (class_id, updated_at);

alter table public.sanitario_produto_class_links_v2 enable row level security;
create policy sanitario_produto_class_links_v2_select
  on public.sanitario_produto_class_links_v2
  for select to authenticated
  using (true); -- catálogo global: inclui revogações para convergência incremental

revoke all on public.sanitario_produto_class_links_v2 from anon, authenticated;
grant select on public.sanitario_produto_class_links_v2 to authenticated;
revoke all on public.sanitario_produto_class_links_v2 from service_role;
grant select, insert, update on public.sanitario_produto_class_links_v2 to service_role;
grant select on public.sanitario_product_classes_v2, public.sanitario_product_class_group_members_v2 to service_role;
grant update (id) on public.sanitario_product_classes_v2 to service_role;

comment on table public.sanitario_produto_class_links_v2 is
  'Relação curada pull-only N:N entre produto comercial e classe técnica; não autoriza dose, via, espécie, carência ou nova aplicação.';
comment on column public.sanitario_produto_class_links_v2.status_curatorial is
  'ativo satisfaz correspondência técnica de catálogo; precisa_validar/bloqueado/arquivado não autorizam seleção prospectiva.';
comment on column public.sanitario_produto_class_links_v2.source_refs is
  'Referências de evidência da associação, sem duplicar as fontes técnicas do produto ou da classe.';

-- Reutilizado no limite transacional das RPCs de Agenda e fatos.
create function public.sanitario_product_matches_requirement_v2(_product uuid, _class text, _group uuid)
returns boolean language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.sanitario_produto_class_links_v2 l
    join public.sanitario_product_classes_v2 c on c.id=l.class_id
    where l.product_id=_product and l.deleted_at is null and l.status_curatorial='ativo'
      and c.deleted_at is null and c.scope='global' and c.fazenda_id is null and c.curation_status='approved_for_catalog'
      and ((_class is not null and c.class_key=_class) or (_group is not null and exists (
        select 1 from public.sanitario_product_class_group_members_v2 m
        where m.group_id=_group and m.class_id=c.id and m.deleted_at is null and m.is_allowed
      )))
  );
$$;
revoke all on function public.sanitario_product_matches_requirement_v2(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.sanitario_product_matches_requirement_v2(uuid,text,uuid) to service_role;

create function public.sanitario_agenda_product_class_link_guard_v2() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare pid uuid; item public.sanitario_protocolo_itens_versions_v2;
begin
  -- UPDATE sem troca de produto preserva intenção anterior. Nova Agenda revalida correspondência.
  if tg_op='UPDATE' and new.produto_snapshot is not distinct from old.produto_snapshot then return new; end if;
  pid := coalesce(nullif(new.produto_snapshot->>'plannedProductId','')::uuid, nullif(new.produto_snapshot->>'productId','')::uuid);
  if pid is null then return new; end if;
  select * into item from public.sanitario_protocolo_itens_versions_v2 where id=coalesce(new.catalog_protocol_item_version_v2_id,new.protocol_item_version_id);
  if item.product_requirement_kind in ('product_class','product_class_group') and
    not public.sanitario_product_matches_requirement_v2(pid,item.product_class,item.product_class_group_id) then
    raise exception 'SANITARIO_PRODUCT_CLASS_LINK_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger sanitario_agenda_product_class_link_guard_v2 before insert or update on public.sanitario_agenda_v2
for each row execute function public.sanitario_agenda_product_class_link_guard_v2();

-- Não consulta catálogos em leitura nem UPDATE: snapshots históricos são imutáveis.
create function public.sanitario_fact_product_class_link_guard_v2() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare proof jsonb; l public.sanitario_produto_class_links_v2; c public.sanitario_product_classes_v2; factual boolean; agenda public.sanitario_agenda_v2; item public.sanitario_protocolo_itens_versions_v2;
begin
  if new.produto_sanitario_v2_id is null then return new; end if;
  select coalesce(e.payload->>'registration_mode'='executed_fact' and e.payload->>'prospective_authorization'='false',false) into factual from public.eventos e where e.id=new.evento_id and e.fazenda_id=new.fazenda_id;
  select a.* into agenda from public.sanitario_agenda_v2 a join public.eventos e on e.source_sanitario_agenda_v2_id=a.id and e.fazenda_id=a.fazenda_id where e.id=new.evento_id;
  select * into item from public.sanitario_protocolo_itens_versions_v2 where id=coalesce(agenda.catalog_protocol_item_version_v2_id,agenda.protocol_item_version_id);
  if not coalesce(factual,false) and item.product_requirement_kind in ('product_class','product_class_group') and not public.sanitario_product_matches_requirement_v2(new.produto_sanitario_v2_id,item.product_class,item.product_class_group_id) then raise exception 'SANITARIO_PRODUCT_CLASS_LINK_MISMATCH'; end if;
  new.produto_snapshot := coalesce(new.produto_snapshot,'{}'::jsonb);
  if not (new.produto_snapshot ? 'productClassLinks') then
    new.produto_snapshot := jsonb_set(new.produto_snapshot,'{productClassLinks}','[]'::jsonb);
  end if;
  if new.produto_snapshot ? 'productClassLinks' then
    if jsonb_typeof(new.produto_snapshot->'productClassLinks') <> 'array' then raise exception 'SANITARIO_PRODUCT_CLASS_LINK_MISMATCH'; end if;
    for proof in select value from jsonb_array_elements(new.produto_snapshot->'productClassLinks') loop
      select * into l from public.sanitario_produto_class_links_v2 where id=(proof->>'linkId')::uuid for share;
      select * into c from public.sanitario_product_classes_v2 where id=l.class_id for share;
      if l.id is null or l.product_id is distinct from new.produto_sanitario_v2_id or c.id::text is distinct from proof->>'classId'
        or c.class_key is distinct from proof->>'classKey' or l.deleted_at is not null or l.status_curatorial <> 'ativo'
        or c.deleted_at is not null or c.curation_status <> 'approved_for_catalog'
        or l.updated_at is distinct from (proof->>'catalogUpdatedAt')::timestamptz or l.source_refs is distinct from proof->'sourceRefs' then
        if not coalesce(factual,false) then raise exception 'SANITARIO_PRODUCT_CLASS_LINK_MISMATCH'; end if;
        -- Nova admissão retrospectiva preserva produto/dose/via realizados,
        -- sem certificar correspondência que o servidor não pode comprovar.
        new.produto_snapshot := jsonb_set(new.produto_snapshot,'{productClassLinks}','[]'::jsonb);
        new.produto_snapshot := jsonb_set(new.produto_snapshot,'{fieldEvidence}',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(new.produto_snapshot->'fieldEvidence','[]'::jsonb)) where value->>'reason' is distinct from 'class_scheme_product_compatibility_verified'),'[]'::jsonb));
        exit;
      end if;
    end loop;
  end if;
  if jsonb_array_length(new.produto_snapshot->'productClassLinks')=0 then
    new.produto_snapshot := jsonb_set(new.produto_snapshot,'{fieldEvidence}',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(new.produto_snapshot->'fieldEvidence','[]'::jsonb)) where value->>'reason' is distinct from 'class_scheme_product_compatibility_verified'),'[]'::jsonb));
  end if;
  return new;
end;
$$;
create trigger sanitario_fact_product_class_link_guard_v2 before insert on public.eventos_sanitario
for each row execute function public.sanitario_fact_product_class_link_guard_v2();
-- Revogação de pai chega ao cache como revogação da própria associação.
-- Reaprovar o pai não reaprova associações: é necessária nova decisão curatorial.
create function public.sanitario_revoke_product_class_links_v2() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_table_name='sanitario_product_classes_v2' then
    -- Identidade global não pode virar tenant enquanto houver associações,
    -- inclusive revogadas, que preservam sua proveniência histórica.
    if (new.scope <> 'global' or new.fazenda_id is not null) and exists (
      select 1 from public.sanitario_produto_class_links_v2 where class_id=new.id
    ) then raise exception 'PRODUCT_CLASS_LINK_GLOBAL_SCOPE_IMMUTABLE'; end if;
    if new.deleted_at is not null or new.curation_status <> 'approved_for_catalog'
      or new.class_key is distinct from old.class_key then
      update public.sanitario_produto_class_links_v2 set status_curatorial='bloqueado'
        where class_id=new.id and deleted_at is null and status_curatorial='ativo';
    end if;
  elsif new.deleted_at is not null then
    update public.sanitario_produto_class_links_v2 set deleted_at=new.deleted_at
      where product_id=new.id and deleted_at is null;
  end if;
  return new;
end;
$$;
create trigger sanitario_revoke_class_links_v2 after update of deleted_at,curation_status,class_key,scope on public.sanitario_product_classes_v2
for each row execute function public.sanitario_revoke_product_class_links_v2();
create trigger sanitario_revoke_product_links_v2 after update of deleted_at on public.sanitario_produtos_v2
for each row execute function public.sanitario_revoke_product_class_links_v2();
commit;
