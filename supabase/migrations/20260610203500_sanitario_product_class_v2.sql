-- 1. Tabela public.sanitario_product_classes_v2
create table if not exists public.sanitario_product_classes_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  class_key text not null,
  name text not null,
  product_type text not null,
  product_subtype text null,
  target_condition text null,
  species_scope text[] not null default '{}',
  curation_status text not null,
  automation_status text not null,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint sanitario_product_classes_v2_scope_chk check (scope in ('global', 'tenant')),
  constraint sanitario_product_classes_v2_fazenda_chk check (
    (scope = 'global' and fazenda_id is null) or
    (scope = 'tenant' and fazenda_id is not null)
  ),
  constraint sanitario_product_classes_v2_class_key_chk check (btrim(class_key) <> ''),
  constraint sanitario_product_classes_v2_name_chk check (btrim(name) <> ''),
  constraint sanitario_product_classes_v2_species_chk check (
    cardinality(species_scope) > 0 
    and species_scope <@ array['bovino', 'bubalino']::text[]
  ),
  constraint sanitario_product_classes_v2_curation_chk check (
    curation_status in ('candidate', 'needs_review', 'approved_for_catalog', 'blocked', 'archived')
  ),
  constraint sanitario_product_classes_v2_automation_chk check (
    automation_status in ('manual_only', 'preview_allowed', 'agenda_allowed', 'blocked')
  ),
  constraint sanitario_product_classes_v2_type_chk check (
    product_type in ('vacina', 'antiparasitario', 'antibiotico', 'anti_inflamatorio', 'hormonio', 'diagnostico', 'outro')
  ),
  constraint sanitario_product_classes_v2_limitations_chk check (limitations is not null),
  constraint sanitario_product_classes_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

-- 2. Tabela public.sanitario_product_class_groups_v2
create table if not exists public.sanitario_product_class_groups_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  group_key text not null,
  name text not null,
  requires_mv_for_other_class boolean not null default true,
  curation_status text not null,
  automation_status text not null,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint sanitario_product_class_groups_v2_scope_chk check (scope in ('global', 'tenant')),
  constraint sanitario_product_class_groups_v2_fazenda_chk check (
    (scope = 'global' and fazenda_id is null) or
    (scope = 'tenant' and fazenda_id is not null)
  ),
  constraint sanitario_product_class_groups_v2_group_key_chk check (btrim(group_key) <> ''),
  constraint sanitario_product_class_groups_v2_name_chk check (btrim(name) <> ''),
  constraint sanitario_product_class_groups_v2_curation_chk check (
    curation_status in ('candidate', 'needs_review', 'approved_for_catalog', 'blocked', 'archived')
  ),
  constraint sanitario_product_class_groups_v2_automation_chk check (
    automation_status in ('manual_only', 'preview_allowed', 'agenda_allowed', 'blocked')
  ),
  constraint sanitario_product_class_groups_v2_limitations_chk check (limitations is not null),
  constraint sanitario_product_class_groups_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

-- 3. Tabela public.sanitario_product_class_group_members_v2
create table if not exists public.sanitario_product_class_group_members_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  group_id uuid not null references public.sanitario_product_class_groups_v2(id) on delete cascade,
  class_id uuid not null references public.sanitario_product_classes_v2(id) on delete cascade,
  is_allowed boolean not null default true,
  requires_mv_override boolean null,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint sanitario_product_class_group_members_v2_scope_chk check (scope in ('global', 'tenant')),
  constraint sanitario_product_class_group_members_v2_fazenda_chk check (
    (scope = 'global' and fazenda_id is null) or
    (scope = 'tenant' and fazenda_id is not null)
  ),
  constraint sanitario_product_class_group_members_v2_limitations_chk check (limitations is not null),
  constraint sanitario_product_class_group_members_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

-- 4. Tabela public.sanitario_product_class_default_rules_v2
create table if not exists public.sanitario_product_class_default_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  class_id uuid not null references public.sanitario_product_classes_v2(id) on delete cascade,
  species_code text not null,
  aptitude text not null default 'all',
  dose_rule jsonb null,
  route_rule jsonb null,
  withdrawal_rule jsonb null,
  execution_product_policy text not null default 'required_at_execution',
  can_validate_execution boolean not null default false,
  requires_executed_product_for_withdrawal boolean not null default true,
  source_refs jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  curation_status text not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint sanitario_product_class_default_rules_v2_scope_chk check (scope in ('global', 'tenant')),
  constraint sanitario_product_class_default_rules_v2_fazenda_chk check (
    (scope = 'global' and fazenda_id is null) or
    (scope = 'tenant' and fazenda_id is not null)
  ),
  constraint sanitario_product_class_default_rules_v2_species_chk check (species_code in ('bovino', 'bubalino')),
  constraint sanitario_product_class_default_rules_v2_aptitude_chk check (aptitude in ('corte', 'leite', 'mista', 'all')),
  constraint sanitario_product_class_default_rules_v2_policy_chk check (
    execution_product_policy in ('required_at_execution', 'required_at_agenda', 'not_required')
  ),
  constraint sanitario_product_class_default_rules_v2_invariants_chk check (
    can_validate_execution = false and requires_executed_product_for_withdrawal = true
  ),
  constraint sanitario_product_class_default_rules_v2_curation_chk check (
    curation_status in ('candidate', 'needs_review', 'approved_for_catalog', 'blocked', 'archived')
  ),
  constraint sanitario_product_class_default_rules_v2_limitations_chk check (limitations is not null),
  constraint sanitario_product_class_default_rules_v2_json_chk check (
    (dose_rule is null or jsonb_typeof(dose_rule) = 'object')
    and (route_rule is null or jsonb_typeof(route_rule) = 'object')
    and (withdrawal_rule is null or jsonb_typeof(withdrawal_rule) = 'object')
    and jsonb_typeof(source_refs) = 'array'
  ),
  constraint sanitario_product_class_default_rules_v2_source_refs_chk check (
    (dose_rule is null and route_rule is null and withdrawal_rule is null)
    or jsonb_array_length(source_refs) > 0
  ),
  constraint sanitario_product_class_default_rules_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

-- 5. Funções e Triggers BEFORE para Validação de Coerência de Escopo e Bloqueio de Soft-Deletes
create or replace function public.fn_validate_product_class_group_member_v2()
returns trigger as $$
declare
  v_group_scope text;
  v_group_fazenda_id uuid;
  v_class_scope text;
  v_class_fazenda_id uuid;
begin
  -- Obter escopo e fazenda_id do grupo pai (somente se não estiver deletado)
  select scope, fazenda_id into v_group_scope, v_group_fazenda_id
  from public.sanitario_product_class_groups_v2
  where id = new.group_id and deleted_at is null;

  if not found then
    raise exception 'Grupo pai inativo, deletado ou inexistente para group_id = %', new.group_id;
  end if;

  -- Obter escopo e fazenda_id da classe técnica (somente se não estiver deletada)
  select scope, fazenda_id into v_class_scope, v_class_fazenda_id
  from public.sanitario_product_classes_v2
  where id = new.class_id and deleted_at is null;

  if not found then
    raise exception 'Classe técnica inativa, deletada ou inexistente para class_id = %', new.class_id;
  end if;

  -- Derivar do grupo pai para garantir integridade estrutural no servidor
  new.scope := v_group_scope;
  new.fazenda_id := v_group_fazenda_id;

  -- Regras de escopo:
  -- - grupo global só aceita classe global (grupo global nunca aceita classe tenant)
  if v_group_scope = 'global' then
    if v_class_scope <> 'global' then
      raise exception 'Grupo global só aceita classes com escopo global.';
    end if;
  end if;

  -- - grupo tenant aceita classe global ou classe tenant da mesma fazenda_id
  if v_group_scope = 'tenant' then
    if v_class_scope = 'tenant' and v_class_fazenda_id <> v_group_fazenda_id then
      raise exception 'Grupo tenant da fazenda % não aceita classe tenant da fazenda %.', v_group_fazenda_id, v_class_fazenda_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_validate_product_class_group_member_v2
before insert or update on public.sanitario_product_class_group_members_v2
for each row execute function public.fn_validate_product_class_group_member_v2();


create or replace function public.fn_validate_product_class_default_rule_v2()
returns trigger as $$
declare
  v_class_scope text;
  v_class_fazenda_id uuid;
begin
  -- Obter escopo e fazenda_id da classe técnica pai (somente se não estiver deletada)
  select scope, fazenda_id into v_class_scope, v_class_fazenda_id
  from public.sanitario_product_classes_v2
  where id = new.class_id and deleted_at is null;

  if not found then
    raise exception 'Classe técnica inativa, deletada ou inexistente para class_id = %', new.class_id;
  end if;

  -- Derivar da classe pai para garantir integridade estrutural no servidor
  new.scope := v_class_scope;
  new.fazenda_id := v_class_fazenda_id;

  return new;
end;
$$ language plpgsql;

create trigger trg_validate_product_class_default_rule_v2
before insert or update on public.sanitario_product_class_default_rules_v2
for each row execute function public.fn_validate_product_class_default_rule_v2();

-- Triggers de timestamp automáticas (reutilizando public.set_updated_at)
create trigger set_updated_at_sanitario_product_classes_v2
before update on public.sanitario_product_classes_v2
for each row execute function public.set_updated_at();

create trigger set_updated_at_sanitario_product_class_groups_v2
before update on public.sanitario_product_class_groups_v2
for each row execute function public.set_updated_at();

create trigger set_updated_at_sanitario_product_class_group_members_v2
before update on public.sanitario_product_class_group_members_v2
for each row execute function public.set_updated_at();

create trigger set_updated_at_sanitario_product_class_default_rules_v2
before update on public.sanitario_product_class_default_rules_v2
for each row execute function public.set_updated_at();

-- 6. Índices Otimizados, Filtros Explícitos e Índices Únicos Parciais (evitando falha de nulos)
create index if not exists idx_sanitario_product_classes_v2_deleted on public.sanitario_product_classes_v2 (deleted_at);
create index if not exists idx_sanitario_product_classes_v2_curation on public.sanitario_product_classes_v2 (curation_status);
create index if not exists idx_sanitario_product_classes_v2_automation on public.sanitario_product_classes_v2 (automation_status);

create unique index if not exists ux_sanitario_product_classes_v2_global_key
  on public.sanitario_product_classes_v2 (class_key)
  where scope = 'global' and fazenda_id is null and deleted_at is null;

create unique index if not exists ux_sanitario_product_classes_v2_tenant_key
  on public.sanitario_product_classes_v2 (fazenda_id, class_key)
  where scope = 'tenant' and fazenda_id is not null and deleted_at is null;

create index if not exists idx_sanitario_product_classes_v2_fazenda
  on public.sanitario_product_classes_v2 (fazenda_id)
  where scope = 'tenant' and deleted_at is null;


create index if not exists idx_sanitario_product_class_groups_v2_deleted on public.sanitario_product_class_groups_v2 (deleted_at);
create index if not exists idx_sanitario_product_class_groups_v2_curation on public.sanitario_product_class_groups_v2 (curation_status);
create index if not exists idx_sanitario_product_class_groups_v2_automation on public.sanitario_product_class_groups_v2 (automation_status);

create unique index if not exists ux_sanitario_product_class_groups_v2_global_key
  on public.sanitario_product_class_groups_v2 (group_key)
  where scope = 'global' and fazenda_id is null and deleted_at is null;

create unique index if not exists ux_sanitario_product_class_groups_v2_tenant_key
  on public.sanitario_product_class_groups_v2 (fazenda_id, group_key)
  where scope = 'tenant' and fazenda_id is not null and deleted_at is null;

create index if not exists idx_sanitario_product_class_groups_v2_fazenda
  on public.sanitario_product_class_groups_v2 (fazenda_id)
  where scope = 'tenant' and deleted_at is null;


create index if not exists idx_sanitario_product_class_group_members_v2_deleted on public.sanitario_product_class_group_members_v2 (deleted_at);

create unique index if not exists ux_sanitario_product_class_group_members_v2_active
  on public.sanitario_product_class_group_members_v2 (group_id, class_id)
  where deleted_at is null;

create index if not exists idx_sanitario_product_class_group_members_v2_fazenda
  on public.sanitario_product_class_group_members_v2 (fazenda_id)
  where scope = 'tenant' and deleted_at is null;


create index if not exists idx_sanitario_product_class_default_rules_v2_deleted on public.sanitario_product_class_default_rules_v2 (deleted_at);

create unique index if not exists ux_sanitario_product_class_default_rules_v2_global
  on public.sanitario_product_class_default_rules_v2 (class_id, species_code, aptitude)
  where scope = 'global' and fazenda_id is null and deleted_at is null;

create unique index if not exists ux_sanitario_product_class_default_rules_v2_tenant
  on public.sanitario_product_class_default_rules_v2 (fazenda_id, class_id, species_code, aptitude)
  where scope = 'tenant' and fazenda_id is not null and deleted_at is null;

create index if not exists idx_sanitario_product_class_default_rules_v2_fazenda
  on public.sanitario_product_class_default_rules_v2 (fazenda_id)
  where scope = 'tenant' and deleted_at is null;

-- 7. Ativação de Row Level Security (RLS)
alter table public.sanitario_product_classes_v2 enable row level security;
alter table public.sanitario_product_class_groups_v2 enable row level security;
alter table public.sanitario_product_class_group_members_v2 enable row level security;
alter table public.sanitario_product_class_default_rules_v2 enable row level security;

-- Policies para public.sanitario_product_classes_v2
create policy sanitario_product_classes_v2_select on public.sanitario_product_classes_v2
  for select to authenticated
  using (
    deleted_at is null
    and (
      (scope = 'global' and fazenda_id is null)
      or (scope = 'tenant' and fazenda_id is not null and public.has_membership(fazenda_id))
    )
  );

create policy sanitario_product_classes_v2_insert on public.sanitario_product_classes_v2
  for insert to authenticated
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

create policy sanitario_product_classes_v2_update on public.sanitario_product_classes_v2
  for update to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  )
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

-- Policies para public.sanitario_product_class_groups_v2
create policy sanitario_product_class_groups_v2_select on public.sanitario_product_class_groups_v2
  for select to authenticated
  using (
    deleted_at is null
    and (
      (scope = 'global' and fazenda_id is null)
      or (scope = 'tenant' and fazenda_id is not null and public.has_membership(fazenda_id))
    )
  );

create policy sanitario_product_class_groups_v2_insert on public.sanitario_product_class_groups_v2
  for insert to authenticated
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

create policy sanitario_product_class_groups_v2_update on public.sanitario_product_class_groups_v2
  for update to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  )
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

-- Policies para public.sanitario_product_class_group_members_v2
create policy sanitario_product_class_group_members_v2_select on public.sanitario_product_class_group_members_v2
  for select to authenticated
  using (
    deleted_at is null
    and (
      (scope = 'global' and fazenda_id is null)
      or (scope = 'tenant' and fazenda_id is not null and public.has_membership(fazenda_id))
    )
  );

create policy sanitario_product_class_group_members_v2_insert on public.sanitario_product_class_group_members_v2
  for insert to authenticated
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

create policy sanitario_product_class_group_members_v2_update on public.sanitario_product_class_group_members_v2
  for update to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  )
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

-- Policies para public.sanitario_product_class_default_rules_v2
create policy sanitario_product_class_default_rules_v2_select on public.sanitario_product_class_default_rules_v2
  for select to authenticated
  using (
    deleted_at is null
    and (
      (scope = 'global' and fazenda_id is null)
      or (scope = 'tenant' and fazenda_id is not null and public.has_membership(fazenda_id))
    )
  );

create policy sanitario_product_class_default_rules_v2_insert on public.sanitario_product_class_default_rules_v2
  for insert to authenticated
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

create policy sanitario_product_class_default_rules_v2_update on public.sanitario_product_class_default_rules_v2
  for update to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  )
  with check (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

-- 8. Concessão de Privilégios de Acesso (Excluindo DELETE físico)
grant select, insert, update on public.sanitario_product_classes_v2 to authenticated;
grant select, insert, update on public.sanitario_product_class_groups_v2 to authenticated;
grant select, insert, update on public.sanitario_product_class_group_members_v2 to authenticated;
grant select, insert, update on public.sanitario_product_class_default_rules_v2 to authenticated;

-- 9. Comentários Explicativos de Governança e Negócio
comment on table public.sanitario_product_classes_v2 is 'ProductClass representa classe tecnica sanitaria e nao e produto comercial.';
comment on table public.sanitario_product_class_groups_v2 is 'ProductClassGroup agrupa classes aceitas por um item e nao e protocolo.';
comment on table public.sanitario_product_class_default_rules_v2 is 'DefaultRule define defaults operacionais para a classe e nao valida execucao nem libera carencia ativa. Carencia ativa nasce somente no EventTechnicalSnapshot. Agenda nunca libera venda, abate, leite ou aptidao operacional.';
comment on table public.sanitario_product_class_group_members_v2 is 'Relacionamento de classes aceitas no grupo. Valida e deriva escopo do grupo automaticamente.';
