-- Fase 12C - Fundacao SQL/RLS da Agenda Sanitaria v2.
-- Agenda v2 e intencao futura; execucao real permanece em eventos + eventos_sanitario.

do $$
begin
  create type public.sanitario_agenda_v2_status_enum as enum (
    'programada',
    'fechada',
    'cancelada',
    'dispensada'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_agenda_animal_v2_status_enum as enum (
    'planejado',
    'executado',
    'nao_executado'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.sanitario_agenda_closure_v2_type_enum as enum (
    'executed_with_event',
    'partially_executed_with_event',
    'closed_without_execution',
    'cancelled',
    'dismissed'
  );
exception when duplicate_object then null;
end $$;

create table public.sanitario_agenda_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  status public.sanitario_agenda_v2_status_enum not null default 'programada',
  dedup_key text not null,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  source_demand_key text,
  preview_group_id text,
  protocolo_id uuid,
  protocol_item_version_id uuid,
  protocol_item_snapshot jsonb not null default '{}'::jsonb,
  janela_inicio date not null,
  janela_fim date,
  data_programada date not null,
  lote_id uuid,
  produto_veterinario_id uuid references public.produtos_veterinarios(id) on delete set null,
  produto_snapshot jsonb not null default '{}'::jsonb,
  produto_classe text,
  acao_sanitaria text not null,
  execution_evento_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint ck_sanitario_agenda_v2_dedup_key check (btrim(dedup_key) <> ''),
  constraint ck_sanitario_agenda_v2_acao check (btrim(acao_sanitaria) <> ''),
  constraint ck_sanitario_agenda_v2_janela check (
    janela_fim is null or janela_fim >= janela_inicio
  ),
  constraint ck_sanitario_agenda_v2_data_programada check (
    data_programada >= janela_inicio
    and (janela_fim is null or data_programada <= janela_fim)
  ),
  constraint ck_sanitario_agenda_v2_execution_status check (
    execution_evento_id is null or status = 'fechada'
  ),
  constraint ck_sanitario_agenda_v2_cancelled_without_event check (
    status not in ('cancelada','dispensada') or execution_evento_id is null
  ),
  constraint fk_sanitario_agenda_v2_protocolo_fazenda
    foreign key (protocolo_id, fazenda_id)
    references public.protocolos_sanitarios(id, fazenda_id)
    on delete set null,
  constraint fk_sanitario_agenda_v2_protocol_item_fazenda
    foreign key (protocol_item_version_id, fazenda_id)
    references public.protocolos_sanitarios_itens(id, fazenda_id)
    on delete set null,
  constraint fk_sanitario_agenda_v2_lote_fazenda
    foreign key (lote_id, fazenda_id)
    references public.lotes(id, fazenda_id)
    on delete set null,
  constraint fk_sanitario_agenda_v2_execution_evento_fazenda
    foreign key (execution_evento_id, fazenda_id)
    references public.eventos(id, fazenda_id)
    on delete set null
);

create unique index ux_sanitario_agenda_v2_dedup_programada
  on public.sanitario_agenda_v2(fazenda_id, dedup_key)
  where status = 'programada' and deleted_at is null;

create unique index ux_sanitario_agenda_v2_client_op_active
  on public.sanitario_agenda_v2(fazenda_id, client_op_id)
  where deleted_at is null;

create index ix_sanitario_agenda_v2_fazenda_status_data
  on public.sanitario_agenda_v2(fazenda_id, status, data_programada)
  where deleted_at is null;

create index ix_sanitario_agenda_v2_execution_evento
  on public.sanitario_agenda_v2(fazenda_id, execution_evento_id)
  where execution_evento_id is not null;

create table public.sanitario_agenda_animais_v2 (
  agenda_id uuid not null,
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  animal_id uuid not null,
  planned_status public.sanitario_agenda_animal_v2_status_enum not null default 'planejado',
  execution_evento_id uuid,
  not_executed_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agenda_id, animal_id),
  unique (agenda_id, fazenda_id, animal_id),
  constraint ck_sanitario_agenda_animais_v2_status_event check (
    (
      planned_status = 'planejado'
      and execution_evento_id is null
      and nullif(btrim(coalesce(not_executed_reason, '')), '') is null
    )
    or (
      planned_status = 'executado'
      and execution_evento_id is not null
    )
    or (
      planned_status = 'nao_executado'
      and execution_evento_id is null
      and nullif(btrim(coalesce(not_executed_reason, '')), '') is not null
    )
  ),
  constraint fk_sanitario_agenda_animais_v2_agenda_fazenda
    foreign key (agenda_id, fazenda_id)
    references public.sanitario_agenda_v2(id, fazenda_id)
    on delete cascade,
  constraint fk_sanitario_agenda_animais_v2_animal_fazenda
    foreign key (animal_id, fazenda_id)
    references public.animais(id, fazenda_id)
    on delete cascade,
  constraint fk_sanitario_agenda_animais_v2_execution_evento_fazenda
    foreign key (execution_evento_id, fazenda_id)
    references public.eventos(id, fazenda_id)
    on delete set null
);

create index ix_sanitario_agenda_animais_v2_animal
  on public.sanitario_agenda_animais_v2(fazenda_id, animal_id, planned_status);

create index ix_sanitario_agenda_animais_v2_execution_evento
  on public.sanitario_agenda_animais_v2(fazenda_id, execution_evento_id)
  where execution_evento_id is not null;

create table public.sanitario_agenda_closures_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  agenda_id uuid not null,
  closure_type public.sanitario_agenda_closure_v2_type_enum not null,
  dedup_key text not null,
  client_id text not null default 'server',
  client_op_id uuid not null default gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz not null default now(),
  server_received_at timestamptz not null default now(),
  closed_at timestamptz not null,
  closed_by uuid references auth.users(id) on delete set null,
  execution_evento_id uuid,
  reason text,
  partial_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, fazenda_id),
  constraint ck_sanitario_agenda_closures_v2_dedup_key check (btrim(dedup_key) <> ''),
  constraint ck_sanitario_agenda_closures_v2_event_required check (
    (
      closure_type in ('executed_with_event','partially_executed_with_event')
      and execution_evento_id is not null
    )
    or (
      closure_type in ('closed_without_execution','cancelled','dismissed')
      and execution_evento_id is null
    )
  ),
  constraint ck_sanitario_agenda_closures_v2_reason_required check (
    closure_type not in ('closed_without_execution','cancelled','dismissed')
    or nullif(btrim(coalesce(reason, '')), '') is not null
  ),
  constraint ck_sanitario_agenda_closures_v2_partial_payload check (
    closure_type <> 'partially_executed_with_event'
    or (
      jsonb_typeof(partial_payload->'executed_animal_ids') = 'array'
      and jsonb_array_length(partial_payload->'executed_animal_ids') > 0
      and jsonb_typeof(partial_payload->'not_executed_animals') = 'array'
      and jsonb_array_length(partial_payload->'not_executed_animals') > 0
    )
  ),
  constraint fk_sanitario_agenda_closures_v2_agenda_fazenda
    foreign key (agenda_id, fazenda_id)
    references public.sanitario_agenda_v2(id, fazenda_id)
    on delete cascade,
  constraint fk_sanitario_agenda_closures_v2_execution_evento_fazenda
    foreign key (execution_evento_id, fazenda_id)
    references public.eventos(id, fazenda_id)
    on delete set null
);

create unique index ux_sanitario_agenda_closures_v2_dedup_active
  on public.sanitario_agenda_closures_v2(fazenda_id, dedup_key)
  where deleted_at is null;

create unique index ux_sanitario_agenda_closures_v2_client_op_active
  on public.sanitario_agenda_closures_v2(fazenda_id, client_op_id)
  where deleted_at is null;

create unique index ux_sanitario_agenda_closures_v2_agenda_active
  on public.sanitario_agenda_closures_v2(fazenda_id, agenda_id)
  where deleted_at is null;

create index ix_sanitario_agenda_closures_v2_execution_evento
  on public.sanitario_agenda_closures_v2(fazenda_id, execution_evento_id)
  where execution_evento_id is not null;

drop trigger if exists trg_sanitario_agenda_v2_updated_at on public.sanitario_agenda_v2;
create trigger trg_sanitario_agenda_v2_updated_at
  before update on public.sanitario_agenda_v2
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sanitario_agenda_animais_v2_updated_at on public.sanitario_agenda_animais_v2;
create trigger trg_sanitario_agenda_animais_v2_updated_at
  before update on public.sanitario_agenda_animais_v2
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sanitario_agenda_closures_v2_updated_at on public.sanitario_agenda_closures_v2;
create trigger trg_sanitario_agenda_closures_v2_updated_at
  before update on public.sanitario_agenda_closures_v2
  for each row execute function public.set_updated_at();

alter table public.sanitario_agenda_v2 enable row level security;
alter table public.sanitario_agenda_animais_v2 enable row level security;
alter table public.sanitario_agenda_closures_v2 enable row level security;

create policy sanitario_agenda_v2_select_member
  on public.sanitario_agenda_v2
  for select
  using (public.has_membership(fazenda_id));

create policy sanitario_agenda_v2_insert_member
  on public.sanitario_agenda_v2
  for insert
  with check (public.has_membership(fazenda_id));

create policy sanitario_agenda_v2_update_member
  on public.sanitario_agenda_v2
  for update
  using (public.has_membership(fazenda_id))
  with check (public.has_membership(fazenda_id));

create policy sanitario_agenda_animais_v2_select_member
  on public.sanitario_agenda_animais_v2
  for select
  using (public.has_membership(fazenda_id));

create policy sanitario_agenda_animais_v2_insert_member
  on public.sanitario_agenda_animais_v2
  for insert
  with check (public.has_membership(fazenda_id));

create policy sanitario_agenda_animais_v2_update_member
  on public.sanitario_agenda_animais_v2
  for update
  using (public.has_membership(fazenda_id))
  with check (public.has_membership(fazenda_id));

create policy sanitario_agenda_closures_v2_select_member
  on public.sanitario_agenda_closures_v2
  for select
  using (public.has_membership(fazenda_id));

create policy sanitario_agenda_closures_v2_insert_member
  on public.sanitario_agenda_closures_v2
  for insert
  with check (public.has_membership(fazenda_id));

create policy sanitario_agenda_closures_v2_update_member
  on public.sanitario_agenda_closures_v2
  for update
  using (public.has_membership(fazenda_id))
  with check (public.has_membership(fazenda_id));

grant usage on type public.sanitario_agenda_v2_status_enum to authenticated;
grant usage on type public.sanitario_agenda_animal_v2_status_enum to authenticated;
grant usage on type public.sanitario_agenda_closure_v2_type_enum to authenticated;

grant select, insert, update on public.sanitario_agenda_v2 to authenticated;
grant select, insert, update on public.sanitario_agenda_animais_v2 to authenticated;
grant select, insert, update on public.sanitario_agenda_closures_v2 to authenticated;

update public.agenda_itens
set
  status = 'cancelado'::public.agenda_status_enum,
  deleted_at = coalesce(deleted_at, now()),
  payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
    'reset_reason',
    'sanitario_agenda_v2_clean_foundation',
    'reset_at',
    now()
  )
where dominio = 'sanitario';

create or replace function public.prevent_legacy_sanitario_agenda_itens_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.dominio = 'sanitario' then
    raise exception 'Agenda sanitaria legada em agenda_itens foi desabilitada pela Agenda Sanitaria v2'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_legacy_sanitario_agenda_itens_v2 on public.agenda_itens;
create trigger trg_prevent_legacy_sanitario_agenda_itens_v2
  before insert or update of dominio on public.agenda_itens
  for each row execute function public.prevent_legacy_sanitario_agenda_itens_v2();

create or replace function public.sanitario_recompute_agenda_core(
  _fazenda_id uuid,
  _animal_id uuid default null,
  _as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_membership(_fazenda_id) then
    raise exception 'Forbidden';
  end if;

  -- 12C: a agenda sanitaria legada em agenda_itens foi desabilitada.
  -- A Agenda Sanitaria v2 deve ser persistida nas tabelas sanitario_agenda_*_v2.
  return 0;
end;
$$;

comment on table public.sanitario_agenda_v2 is
  'Agenda Sanitaria v2: intencao futura persistida; nao e historico sanitario.';

comment on table public.sanitario_agenda_animais_v2 is
  'Escopo planejado por animal da Agenda Sanitaria v2; execucao real permanece em eventos.';

comment on table public.sanitario_agenda_closures_v2 is
  'Fechamento administrativo da Agenda Sanitaria v2; nao cria evento nem historico sanitario.';

comment on function public.sanitario_recompute_agenda_core(uuid, uuid, date) is
  '12C: recompute sanitario legado em agenda_itens desabilitado; retorna 0 apos validar membership.';
