-- V3.1-A only: additive identity/projection and private claim/receipt primitives.
-- No backfill, gate activation, consumer cutover or progressive execution.
-- Apply atomically through the authorized migration runner; never on a remote
-- target merely because this file exists.

alter table public.sanitario_agenda_v2
  add column obrigacao_origem_agenda_id uuid,
  add constraint fk_sanitario_obrigacao_raiz_fazenda
    foreign key (obrigacao_origem_agenda_id, fazenda_id)
    references public.sanitario_agenda_v2(id, fazenda_id) on delete restrict,
  add constraint ux_sanitario_agenda_obrigacao_scope
    unique (id, fazenda_id, obrigacao_origem_agenda_id);

alter table public.sanitario_agenda_animais_v2
  add column obrigacao_origem_agenda_id uuid,
  add constraint fk_sanitario_alvo_agenda_obrigacao
    foreign key (agenda_id, fazenda_id, obrigacao_origem_agenda_id)
    references public.sanitario_agenda_v2(id, fazenda_id, obrigacao_origem_agenda_id)
    on delete restrict,
  add constraint fk_sanitario_alvo_obrigacao_raiz
    foreign key (obrigacao_origem_agenda_id, fazenda_id, animal_id)
    references public.sanitario_agenda_animais_v2(agenda_id, fazenda_id, animal_id)
    on delete restrict;

create table public.sanitario_atendimentos (
  fazenda_id uuid not null,
  obrigacao_origem_agenda_id uuid not null,
  animal_id uuid not null,
  evento_id uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  em_disputa boolean not null default false,
  updated_at timestamptz not null default transaction_timestamp(),
  primary key (fazenda_id, obrigacao_origem_agenda_id, animal_id),
  constraint fk_sanitario_atendimento_alvo_raiz
    foreign key (obrigacao_origem_agenda_id, fazenda_id, animal_id)
    references public.sanitario_agenda_animais_v2(agenda_id, fazenda_id, animal_id)
    on delete restrict,
  constraint fk_sanitario_atendimento_fato_animal
    foreign key (fazenda_id, evento_id, animal_id)
    references public.eventos_animais(fazenda_id, evento_id, animal_id)
    on delete restrict
);

alter table public.sanitario_atendimentos enable row level security;
create policy sanitario_atendimentos_select_member
  on public.sanitario_atendimentos for select to authenticated
  using (public.has_membership(fazenda_id));
revoke all on table public.sanitario_atendimentos from public, anon, authenticated, service_role;
grant select on table public.sanitario_atendimentos to authenticated;
grant select, insert on table public.sanitario_atendimentos to service_role;

-- Metadata only. Existing gate range/enabled/allowlists/rollout remain untouched.
alter table public.sanitario_sync_v2_gates
  add column foundation_state text not null default 'inactive'
    check (foundation_state in ('inactive', 'frozen', 'ready')),
  add column foundation_transition_id uuid,
  add column foundation_revision bigint not null default 0
    check (foundation_revision >= 0),
  add column foundation_prepared_revision bigint
    check (foundation_prepared_revision >= 0),
  add column foundation_evidence jsonb
    check (foundation_evidence is null or jsonb_typeof(foundation_evidence) = 'object');

create function public.guard_sanitario_obrigacao_identity()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
declare
  v_parent_root uuid;
  v_has_fact boolean;
begin
  if tg_table_name = 'sanitario_agenda_v2' then
    if tg_op = 'UPDATE' then
      -- Once assigned, the occurrence identity is never silently reset/reused.
      if old.obrigacao_origem_agenda_id is not null and
        (new.id, new.fazenda_id, new.obrigacao_origem_agenda_id) is distinct from
        (old.id, old.fazenda_id, old.obrigacao_origem_agenda_id) then
        raise exception 'SANITARIO_OBRIGACAO_IDENTITY_IMMUTABLE' using errcode = '23514';
      end if;
      if old.obrigacao_origem_agenda_id is null and new.obrigacao_origem_agenda_id is not null then
        if old.execution_evento_id is not null or exists (
          select 1 from public.eventos e
          where e.fazenda_id = old.fazenda_id and e.source_sanitario_agenda_v2_id = old.id
        ) or exists (
          select 1 from public.sanitario_agenda_animais_v2 aa
          where aa.fazenda_id = old.fazenda_id and aa.agenda_id = old.id
            and aa.execution_evento_id is not null
        ) then
          raise exception 'SANITARIO_HISTORICAL_ROOT_REQUIRES_RECONCILIATION' using errcode = '23514';
        end if;
      end if;
    end if;
    if new.obrigacao_origem_agenda_id is null then return new; end if;
    if new.obrigacao_origem_agenda_id <> new.id then
      select a.obrigacao_origem_agenda_id into v_parent_root
      from public.sanitario_agenda_v2 a
      where a.id = new.obrigacao_origem_agenda_id and a.fazenda_id = new.fazenda_id
        and a.deleted_at is null;
      if not found or v_parent_root is distinct from new.obrigacao_origem_agenda_id then
        raise exception 'SANITARIO_OBRIGACAO_ROOT_INVALID' using errcode = '23503';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and
    (new.agenda_id, new.fazenda_id, new.animal_id, new.obrigacao_origem_agenda_id)
      is distinct from
    (old.agenda_id, old.fazenda_id, old.animal_id, old.obrigacao_origem_agenda_id)) then
    if old.obrigacao_origem_agenda_id is not null or
       (tg_op = 'UPDATE' and new.obrigacao_origem_agenda_id is not null) then
      select exists (
        select 1 from public.eventos e join public.eventos_animais ea
          on ea.evento_id = e.id and ea.fazenda_id = e.fazenda_id
        where e.fazenda_id = old.fazenda_id and e.source_sanitario_agenda_v2_id = old.agenda_id
          and ea.animal_id = old.animal_id
      ) or exists (
        select 1 from public.sanitario_atendimentos s
        where s.fazenda_id = old.fazenda_id and s.obrigacao_origem_agenda_id = old.obrigacao_origem_agenda_id
          and s.animal_id = old.animal_id
      ) into v_has_fact;
      if old.execution_evento_id is not null or v_has_fact then
        raise exception 'SANITARIO_OBRIGACAO_ANIMAL_IMMUTABLE' using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.obrigacao_origem_agenda_id is null then
    select a.obrigacao_origem_agenda_id into v_parent_root from public.sanitario_agenda_v2 a
      where a.id = new.agenda_id and a.fazenda_id = new.fazenda_id;
    if v_parent_root is not null then
      raise exception 'SANITARIO_OBRIGACAO_ANIMAL_ROOT_REQUIRED' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_sanitario_agenda_obrigacao_identity
  before insert or update on public.sanitario_agenda_v2
  for each row execute function public.guard_sanitario_obrigacao_identity();
create trigger trg_sanitario_alvo_obrigacao_identity
  before insert or update or delete on public.sanitario_agenda_animais_v2
  for each row execute function public.guard_sanitario_obrigacao_identity();

create function public.guard_sanitario_atendimento_factual()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'SANITARIO_ATENDIMENTO_ADMIN_NOT_IMPLEMENTED' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.eventos e
    join public.eventos_sanitario es on es.evento_id = e.id and es.fazenda_id = e.fazenda_id
    join public.sanitario_agenda_v2 a on a.id = e.source_sanitario_agenda_v2_id and a.fazenda_id = e.fazenda_id
    join public.sanitario_agenda_animais_v2 aa on aa.agenda_id = a.id and aa.fazenda_id = a.fazenda_id
      and aa.animal_id = new.animal_id
    join public.sanitario_agenda_animais_v2 raiz on raiz.agenda_id = new.obrigacao_origem_agenda_id
      and raiz.fazenda_id = new.fazenda_id and raiz.animal_id = new.animal_id
    where e.id = new.evento_id and e.fazenda_id = new.fazenda_id
      and e.dominio = 'sanitario'::public.dominio_enum
      and e.sanitario_sync_v2_nature = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
      and e.corrige_evento_id is null and e.deleted_at is null and es.deleted_at is null and a.deleted_at is null
      and a.obrigacao_origem_agenda_id = new.obrigacao_origem_agenda_id
      and aa.obrigacao_origem_agenda_id = new.obrigacao_origem_agenda_id
      and raiz.obrigacao_origem_agenda_id = new.obrigacao_origem_agenda_id
  ) then
    raise exception 'SANITARIO_ATENDIMENTO_FACT_SCOPE_INVALID' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger trg_sanitario_atendimento_factual
  before insert or update or delete on public.sanitario_atendimentos
  for each row execute function public.guard_sanitario_atendimento_factual();

create function public.internal_sanitario_claim_atendimento(
  fazenda_id uuid, origem_agenda_id uuid, animal_id uuid, evento_id uuid
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public as $$
#variable_conflict use_variable
declare
  v_existing uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if fazenda_id is null or origem_agenda_id is null or animal_id is null or evento_id is null then
    raise exception 'SANITARIO_CLAIM_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'sanitario:claim:' || fazenda_id::text || ':' || origem_agenda_id::text || ':' || animal_id::text, 0));
  -- Validate every candidate, including collision/replay, before returning a result.
  if not exists (
    select 1 from public.eventos e
    join public.eventos_sanitario es on es.evento_id = e.id and es.fazenda_id = e.fazenda_id
    join public.eventos_animais ea on ea.evento_id = e.id and ea.fazenda_id = e.fazenda_id and ea.animal_id = animal_id
    join public.sanitario_agenda_v2 a on a.id = e.source_sanitario_agenda_v2_id and a.fazenda_id = e.fazenda_id
    join public.sanitario_agenda_animais_v2 aa on aa.agenda_id = a.id and aa.fazenda_id = a.fazenda_id and aa.animal_id = animal_id
    join public.sanitario_agenda_animais_v2 raiz on raiz.agenda_id = origem_agenda_id and raiz.fazenda_id = fazenda_id and raiz.animal_id = animal_id
    where e.id = evento_id and e.fazenda_id = fazenda_id
      and e.dominio = 'sanitario'::public.dominio_enum
      and e.sanitario_sync_v2_nature = 'primary_execution'::public.sanitario_sync_v2_event_nature_enum
      and e.corrige_evento_id is null and e.deleted_at is null and es.deleted_at is null and a.deleted_at is null
      and a.obrigacao_origem_agenda_id = origem_agenda_id and aa.obrigacao_origem_agenda_id = origem_agenda_id
      and raiz.obrigacao_origem_agenda_id = origem_agenda_id
  ) then
    raise exception 'SANITARIO_ATENDIMENTO_FACT_SCOPE_INVALID' using errcode = '23503';
  end if;
  select s.evento_id into v_existing from public.sanitario_atendimentos s
    where s.fazenda_id = fazenda_id and s.obrigacao_origem_agenda_id = origem_agenda_id and s.animal_id = animal_id;
  if found then
    return jsonb_build_object('outcome', case when v_existing = evento_id then 'same_event' else 'collision' end,
      'evento_id', evento_id, 'canonical_evento_id', v_existing);
  end if;
  insert into public.sanitario_atendimentos(fazenda_id, obrigacao_origem_agenda_id, animal_id, evento_id)
    values (fazenda_id, origem_agenda_id, animal_id, evento_id);
  return jsonb_build_object('outcome', 'claimed', 'evento_id', evento_id, 'canonical_evento_id', evento_id);
end;
$$;

create function public.internal_sanitario_get_receipt(
  actor_user_id uuid, fazenda_id uuid, operation_kind text, entity_id uuid,
  client_op_id uuid, domain_op_id uuid, request_fingerprint text
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public as $$
#variable_conflict use_variable
declare
  v_role public.farm_role_enum;
  v_result jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'SANITARIO_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if actor_user_id is null or fazenda_id is null or operation_kind is null or entity_id is null
    or client_op_id is null or domain_op_id is null or nullif(btrim(request_fingerprint), '') is null then
    raise exception 'SANITARIO_RECEIPT_REQUIRED_ARGUMENT_MISSING' using errcode = '22004';
  end if;
  if operation_kind not in ('agenda_create','agenda_targets_replace','factual_core',
    'administrative_closure','automation_plan','agenda_schedule') then
    raise exception 'SANITARIO_OPERATION_NOT_ALLOWLISTED' using errcode = '42501';
  end if;
  select uf.role into v_role from public.user_fazendas uf
    join public.fazendas f on f.id = uf.fazenda_id and f.deleted_at is null
    where uf.user_id = actor_user_id and uf.fazenda_id = fazenda_id and uf.deleted_at is null;
  if v_role is null then
    raise exception 'SANITARIO_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if v_role not in ('owner'::public.farm_role_enum, 'manager'::public.farm_role_enum)
    and not (operation_kind = 'factual_core' and v_role = 'cowboy'::public.farm_role_enum) then
    raise exception 'SANITARIO_ROLE_NOT_ALLOWED' using errcode = '42501';
  end if;
  -- Deliberately no write-gate check and no new receipt/fingerprint generation.
  v_result := public.internal_sanitario_sync_v2_existing_result(
    fazenda_id, operation_kind, entity_id, client_op_id, domain_op_id, request_fingerprint);
  if v_result is null then return jsonb_build_object('outcome', 'absent'); end if;
  return jsonb_build_object('outcome', 'found', 'canonical_result', v_result);
end;
$$;

revoke all on function public.guard_sanitario_obrigacao_identity() from public, anon, authenticated, service_role;
revoke all on function public.guard_sanitario_atendimento_factual() from public, anon, authenticated, service_role;
revoke all on function public.internal_sanitario_claim_atendimento(uuid,uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.internal_sanitario_get_receipt(uuid,uuid,text,uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.guard_sanitario_obrigacao_identity() to service_role;
grant execute on function public.guard_sanitario_atendimento_factual() to service_role;
grant execute on function public.internal_sanitario_claim_atendimento(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.internal_sanitario_get_receipt(uuid,uuid,text,uuid,uuid,uuid,text) to service_role;

comment on table public.sanitario_atendimentos is
  'Projecao atual de atendimento por obrigacao/animal; Evento permanece fonte factual. Sem writer operacional V3.1.';
comment on column public.sanitario_agenda_v2.obrigacao_origem_agenda_id is
  'Identidade estavel da ocorrencia; nullable no historico, sem backfill implicito.';
comment on function public.internal_sanitario_claim_atendimento(uuid,uuid,uuid,uuid) is
  'Primitiva privada; serializa claim sem criar Evento, consumo, closure ou resolucao administrativa.';
comment on function public.internal_sanitario_get_receipt(uuid,uuid,text,uuid,uuid,uuid,text) is
  'Consulta privada aos seis kinds existentes; exige membership/papel e identidade exata, independente de gate de escrita.';
