-- Fase 1B: versionamento imutavel de etapas de protocolos sanitarios.
-- A identidade logica passa a ser logical_item_key; id representa a versao fisica.

alter table public.protocolos_sanitarios_itens
  add column if not exists logical_item_key uuid,
  add column if not exists item_code text,
  add column if not exists ativo boolean not null default true,
  add column if not exists superseded_by_id uuid,
  add column if not exists superseded_at timestamptz;

update public.protocolos_sanitarios_itens
set
  logical_item_key = coalesce(logical_item_key, id),
  item_code = nullif(coalesce(item_code, payload->>'item_code', payload->>'official_item_code'), '')
where logical_item_key is null
   or item_code is null;

alter table public.protocolos_sanitarios_itens
  alter column logical_item_key set not null,
  alter column version set not null;

alter table public.protocolos_sanitarios_itens
  drop constraint if exists protocolos_sanitarios_itens_logical_version_unique,
  add constraint protocolos_sanitarios_itens_logical_version_unique
  unique (fazenda_id, protocolo_id, logical_item_key, version);

drop index if exists public.idx_protocolos_sanitarios_itens_active_partial;
create unique index idx_protocolos_sanitarios_itens_active_partial
on public.protocolos_sanitarios_itens (fazenda_id, protocolo_id, logical_item_key)
where ativo = true and deleted_at is null;

alter table public.protocolos_sanitarios_itens
  drop constraint if exists protocolos_sanitarios_itens_superseded_by_fk,
  add constraint protocolos_sanitarios_itens_superseded_by_fk
  foreign key (superseded_by_id)
  references public.protocolos_sanitarios_itens(id)
  deferrable initially deferred;

alter table public.agenda_itens
  add column if not exists protocol_item_logical_key uuid,
  add column if not exists protocol_item_version integer,
  add column if not exists protocol_item_code text;

alter table public.eventos_sanitario
  add column if not exists protocol_item_version_id uuid,
  add column if not exists protocol_item_logical_key uuid,
  add column if not exists protocol_item_version integer,
  add column if not exists protocol_item_snapshot jsonb;

create index if not exists idx_agenda_protocol_item_version
on public.agenda_itens (protocol_item_version_id);

create index if not exists idx_agenda_protocol_item_logical_key
on public.agenda_itens (protocol_item_logical_key);

create index if not exists idx_agenda_fazenda_protocol_item_version
on public.agenda_itens (fazenda_id, protocol_item_version_id);

create index if not exists idx_eventos_sanitario_protocol_item_version
on public.eventos_sanitario (protocol_item_version_id);

alter table public.eventos_sanitario
  drop constraint if exists fk_eventos_sanitario_protocol_item_fazenda,
  add constraint fk_eventos_sanitario_protocol_item_fazenda
  foreign key (protocol_item_version_id, fazenda_id)
  references public.protocolos_sanitarios_itens(id, fazenda_id)
  on delete no action;

create or replace function public.fill_sanitario_agenda_protocol_item_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item public.protocolos_sanitarios_itens%rowtype;
begin
  if new.protocol_item_version_id is null then
    return new;
  end if;

  select * into v_item
  from public.protocolos_sanitarios_itens
  where id = new.protocol_item_version_id
    and fazenda_id = new.fazenda_id
    and deleted_at is null;

  if not found then
    raise exception 'protocol_item_version_id invalido para a fazenda';
  end if;

  new.protocol_item_logical_key := v_item.logical_item_key;
  new.protocol_item_version := v_item.version;
  new.protocol_item_code := v_item.item_code;
  new.source_ref := coalesce(new.source_ref, '{}'::jsonb) || jsonb_build_object(
    'protocol_item_version_id', v_item.id,
    'protocol_item_logical_key', v_item.logical_item_key,
    'protocol_item_version', v_item.version,
    'protocol_item_code', v_item.item_code
  );
  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'protocol_item_version_id', v_item.id,
    'protocol_item_logical_key', v_item.logical_item_key,
    'protocol_item_version', v_item.version,
    'protocol_item_code', v_item.item_code
  );

  return new;
end;
$$;

drop trigger if exists trg_fill_sanitario_agenda_protocol_item_snapshot on public.agenda_itens;
create trigger trg_fill_sanitario_agenda_protocol_item_snapshot
before insert or update of protocol_item_version_id
on public.agenda_itens
for each row
when (new.dominio = 'sanitario')
execute function public.fill_sanitario_agenda_protocol_item_snapshot();

create or replace function public.fill_eventos_sanitario_protocol_item_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_event public.eventos%rowtype;
  v_agenda public.agenda_itens%rowtype;
  v_item public.protocolos_sanitarios_itens%rowtype;
begin
  if new.protocol_item_version_id is null then
    select * into v_event
    from public.eventos
    where id = new.evento_id
      and fazenda_id = new.fazenda_id
      and deleted_at is null;

    if found and v_event.source_task_id is not null then
      select * into v_agenda
      from public.agenda_itens
      where id = v_event.source_task_id
        and fazenda_id = new.fazenda_id
        and deleted_at is null;

      if found then
        new.protocol_item_version_id := v_agenda.protocol_item_version_id;
        new.protocol_item_logical_key := v_agenda.protocol_item_logical_key;
        new.protocol_item_version := v_agenda.protocol_item_version;
      end if;
    end if;
  end if;

  if new.protocol_item_version_id is not null then
    select * into v_item
    from public.protocolos_sanitarios_itens
    where id = new.protocol_item_version_id
      and fazenda_id = new.fazenda_id
      and deleted_at is null;

    if not found then
      raise exception 'protocol_item_version_id invalido para o evento sanitario';
    end if;

    new.protocol_item_logical_key := coalesce(new.protocol_item_logical_key, v_item.logical_item_key);
    new.protocol_item_version := coalesce(new.protocol_item_version, v_item.version);
    new.protocol_item_snapshot := coalesce(
      new.protocol_item_snapshot,
      jsonb_build_object(
        'id', v_item.id,
        'logical_item_key', v_item.logical_item_key,
        'item_code', v_item.item_code,
        'version', v_item.version,
        'tipo', v_item.tipo,
        'produto', v_item.produto,
        'intervalo_dias', v_item.intervalo_dias,
        'dose_num', v_item.dose_num,
        'gera_agenda', v_item.gera_agenda,
        'dedup_template', v_item.dedup_template,
        'payload', v_item.payload
      )
    );
  end if;

  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'protocol_item_version_id', new.protocol_item_version_id,
    'protocol_item_logical_key', new.protocol_item_logical_key,
    'protocol_item_version', new.protocol_item_version
  );

  return new;
end;
$$;

drop trigger if exists trg_fill_eventos_sanitario_protocol_item_snapshot on public.eventos_sanitario;
create trigger trg_fill_eventos_sanitario_protocol_item_snapshot
before insert or update of protocol_item_version_id
on public.eventos_sanitario
for each row
execute function public.fill_eventos_sanitario_protocol_item_snapshot();
