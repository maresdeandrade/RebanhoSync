-- Corrective, additive: keep legacy FKs/queued clients and separate V2 catalog IDs.
-- No backfill, gate change, protocol import, policy or RPC privilege change.
begin;

-- The internal RPC executor needs read/row-lock access, not catalog publishing.
-- PostgreSQL requires UPDATE on at least one column for SELECT ... FOR SHARE.
grant select on public.sanitario_protocolos_v2, public.sanitario_protocolo_itens_versions_v2 to service_role;
grant update (id) on public.sanitario_protocolos_v2, public.sanitario_protocolo_itens_versions_v2 to service_role;

alter table public.sanitario_agenda_v2
  add column catalog_protocolo_v2_id uuid references public.sanitario_protocolos_v2(id) on delete restrict,
  add column catalog_protocol_item_version_v2_id uuid references public.sanitario_protocolo_itens_versions_v2(id) on delete restrict,
  add constraint ck_sanitario_agenda_v2_catalog_reference check (
    (catalog_protocolo_v2_id is null and catalog_protocol_item_version_v2_id is null)
    or (catalog_protocolo_v2_id is not null and protocolo_id is null and protocol_item_version_id is null)
  );

create function public.sanitario_agenda_v2_resolve_catalog_reference()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
declare
  v_protocol public.sanitario_protocolos_v2%rowtype;
  v_item public.sanitario_protocolo_itens_versions_v2%rowtype;
begin
  -- The existing typed RPC/envelope stays compatible. Legacy IDs retain their
  -- original columns/FKs; canonical IDs get explicit canonical columns.
  if new.protocolo_id is not null then
    select p.* into v_protocol from public.sanitario_protocolos_v2 p
      where p.id = new.protocolo_id for share;
    if found then
      if new.catalog_protocolo_v2_id is not null and new.catalog_protocolo_v2_id <> new.protocolo_id then
        raise exception 'SANITARIO_CATALOG_REFERENCE_MISMATCH' using errcode = '23503';
      end if;
      new.catalog_protocolo_v2_id := new.protocolo_id;
      new.protocolo_id := null;
    end if;
  end if;
  if new.protocol_item_version_id is not null then
    select i.* into v_item from public.sanitario_protocolo_itens_versions_v2 i
      where i.id = new.protocol_item_version_id for share;
    if found then
      if new.catalog_protocol_item_version_v2_id is not null and new.catalog_protocol_item_version_v2_id <> new.protocol_item_version_id then
        raise exception 'SANITARIO_CATALOG_REFERENCE_MISMATCH' using errcode = '23503';
      end if;
      new.catalog_protocol_item_version_v2_id := new.protocol_item_version_id;
      new.protocol_item_version_id := null;
    end if;
  end if;
  if new.catalog_protocolo_v2_id is not null then
    select p.* into v_protocol from public.sanitario_protocolos_v2 p
      where p.id = new.catalog_protocolo_v2_id for share;
    if not found or (v_protocol.fazenda_id is not null and v_protocol.fazenda_id <> new.fazenda_id) then
      raise exception 'SANITARIO_CATALOG_PROTOCOL_CROSS_FARM_OR_MISSING' using errcode = '23503';
    end if;
  end if;
  if new.catalog_protocol_item_version_v2_id is not null then
    select i.* into v_item from public.sanitario_protocolo_itens_versions_v2 i
      where i.id = new.catalog_protocol_item_version_v2_id for share;
    if not found or v_item.protocol_id is distinct from new.catalog_protocolo_v2_id then
      raise exception 'SANITARIO_CATALOG_ITEM_PROTOCOL_MISMATCH' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger sanitario_agenda_v2_resolve_catalog_reference
before insert or update of protocolo_id, protocol_item_version_id, catalog_protocolo_v2_id, catalog_protocol_item_version_v2_id, fazenda_id
on public.sanitario_agenda_v2 for each row
execute function public.sanitario_agenda_v2_resolve_catalog_reference();

-- A referenced catalog row cannot later change tenant/parent behind the guard.
-- FOR SHARE above serializes reference creation with these row updates.
create function public.sanitario_agenda_v2_protect_catalog_reference()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'sanitario_protocolos_v2' then
    if (new.fazenda_id is distinct from old.fazenda_id or new.scope is distinct from old.scope)
      and exists (select 1 from public.sanitario_agenda_v2 a where a.catalog_protocolo_v2_id = old.id) then
      raise exception 'SANITARIO_CATALOG_REFERENCED_PROTOCOL_SCOPE_IMMUTABLE' using errcode = '23503';
    end if;
  else
    if new.protocol_id is distinct from old.protocol_id
      and exists (select 1 from public.sanitario_agenda_v2 a where a.catalog_protocol_item_version_v2_id = old.id) then
      raise exception 'SANITARIO_CATALOG_REFERENCED_ITEM_PARENT_IMMUTABLE' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger sanitario_agenda_v2_protect_protocol_scope
before update of scope, fazenda_id on public.sanitario_protocolos_v2
for each row execute function public.sanitario_agenda_v2_protect_catalog_reference();
create trigger sanitario_agenda_v2_protect_item_parent
before update of protocol_id on public.sanitario_protocolo_itens_versions_v2
for each row execute function public.sanitario_agenda_v2_protect_catalog_reference();

revoke all on function public.sanitario_agenda_v2_resolve_catalog_reference() from public, anon, authenticated;
revoke all on function public.sanitario_agenda_v2_protect_catalog_reference() from public, anon, authenticated;
grant execute on function public.sanitario_agenda_v2_resolve_catalog_reference() to service_role;
grant execute on function public.sanitario_agenda_v2_protect_catalog_reference() to service_role;

comment on column public.sanitario_agenda_v2.catalog_protocolo_v2_id is
  'Canonical V2 catalog reference. Legacy protocolo_id remains available for old queued clients.';
comment on column public.sanitario_agenda_v2.catalog_protocol_item_version_v2_id is
  'Canonical immutable V2 item reference. Pull maps it into the existing local Agenda shape.';

notify pgrst, 'reload schema';
commit;
