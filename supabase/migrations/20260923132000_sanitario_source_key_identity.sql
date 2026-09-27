-- Sanitário v2 C0.2A.2 — infraestrutura de identidade canônica.
-- A presença obrigatória de source_key para fontes globais permanece adiada até C0.2B.

alter table public.sanitario_fontes_tecnicas_v2
  add column source_key text null;

alter table public.sanitario_fontes_tecnicas_v2
  add constraint sanitario_fontes_tecnicas_v2_source_key_chk
  check (source_key is null or source_key ~ '^SRC_[A-Z0-9_]+$');

-- Preflight inclui tombstones: uma natural key removida continua reservada.
do $$
begin
  if exists (
    select source_key
    from public.sanitario_fontes_tecnicas_v2
    where scope = 'global'
      and fazenda_id is null
      and source_key is not null
    group by source_key
    having count(*) > 1
  ) then
    raise exception 'SANITARIO_SOURCE_KEY_CONFLICT: duplicate global source_key including tombstones';
  end if;

  if exists (
    select fazenda_id, source_key
    from public.sanitario_fontes_tecnicas_v2
    where scope = 'fazenda'
      and fazenda_id is not null
      and source_key is not null
    group by fazenda_id, source_key
    having count(*) > 1
  ) then
    raise exception 'SANITARIO_SOURCE_KEY_CONFLICT: duplicate farm source_key including tombstones';
  end if;

  if exists (
    select class_key
    from public.sanitario_product_classes_v2
    where scope = 'global'
      and fazenda_id is null
    group by class_key
    having count(*) > 1
  ) then
    raise exception 'SANITARIO_CLASS_KEY_CONFLICT: duplicate global class_key including tombstones';
  end if;

  if exists (
    select fazenda_id, class_key
    from public.sanitario_product_classes_v2
    where scope = 'tenant'
      and fazenda_id is not null
    group by fazenda_id, class_key
    having count(*) > 1
  ) then
    raise exception 'SANITARIO_CLASS_KEY_CONFLICT: duplicate tenant class_key including tombstones';
  end if;
end
$$;

create unique index ux_sanitario_fontes_v2_global_source_key_identity
  on public.sanitario_fontes_tecnicas_v2 (source_key)
  where scope = 'global'
    and fazenda_id is null
    and source_key is not null;

create unique index ux_sanitario_fontes_v2_farm_source_key_identity
  on public.sanitario_fontes_tecnicas_v2 (fazenda_id, source_key)
  where scope = 'fazenda'
    and fazenda_id is not null
    and source_key is not null;

-- Índices adicionais preservam os índices ativos existentes e reservam class_key tombstonada.
create unique index ux_sanitario_classes_v2_global_class_key_identity
  on public.sanitario_product_classes_v2 (class_key)
  where scope = 'global'
    and fazenda_id is null;

create unique index ux_sanitario_classes_v2_tenant_class_key_identity
  on public.sanitario_product_classes_v2 (fazenda_id, class_key)
  where scope = 'tenant'
    and fazenda_id is not null;

comment on column public.sanitario_fontes_tecnicas_v2.source_key is
  'Natural key canônica opcional nesta fase. Fontes globais serão obrigadas a preenchê-la somente após C0.2B.';
