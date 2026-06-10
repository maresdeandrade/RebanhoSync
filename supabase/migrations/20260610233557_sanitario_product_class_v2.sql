do $$ begin create type public.sanitario_product_type_v2_enum as enum ('vacina','antiparasitario','antibiotico','anti_inflamatorio','hormonio','diagnostico','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_curation_status_class_v2_enum as enum ('candidate','needs_review','approved_for_catalog','blocked','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_automation_status_v2_enum as enum ('manual_only','preview_allowed','agenda_allowed','blocked'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_execution_product_policy_v2_enum as enum ('not_required','required_at_execution','required_at_agenda','fixed_by_protocol'); exception when duplicate_object then null; end $$;

create table if not exists public.sanitario_product_classes_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  class_key text not null,
  name text not null,
  product_type public.sanitario_product_type_v2_enum not null,
  product_subtype text,
  target_condition text,
  species_scope text[] not null default '{}',
  curation_status public.sanitario_curation_status_class_v2_enum not null,
  automation_status public.sanitario_automation_status_v2_enum not null,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_product_classes_v2_class_key_chk check (btrim(class_key) <> ''),
  constraint sanitario_product_classes_v2_name_chk check (btrim(name) <> ''),
  constraint sanitario_product_classes_v2_species_scope_chk check (coalesce(array_length(species_scope, 1), 0) > 0),
  constraint sanitario_product_classes_v2_metadata_chk check (jsonb_typeof(metadata) = 'object'),
  constraint sanitario_product_classes_v2_scope_chk check (
    (scope = 'global' and fazenda_id is null)
    or (scope = 'tenant' and fazenda_id is not null)
  )
);

create table if not exists public.sanitario_product_class_groups_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  group_key text not null,
  name text not null,
  requires_mv_for_other_class boolean not null default true,
  curation_status public.sanitario_curation_status_class_v2_enum not null,
  automation_status public.sanitario_automation_status_v2_enum not null,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_product_class_groups_v2_group_key_chk check (btrim(group_key) <> ''),
  constraint sanitario_product_class_groups_v2_name_chk check (btrim(name) <> ''),
  constraint sanitario_product_class_groups_v2_metadata_chk check (jsonb_typeof(metadata) = 'object'),
  constraint sanitario_product_class_groups_v2_scope_chk check (
    (scope = 'global' and fazenda_id is null)
    or (scope = 'tenant' and fazenda_id is not null)
  )
);

create table if not exists public.sanitario_product_class_group_members_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  group_id uuid not null references public.sanitario_product_class_groups_v2(id) on delete cascade,
  class_id uuid not null references public.sanitario_product_classes_v2(id) on delete cascade,
  is_allowed boolean not null default true,
  requires_mv_override boolean,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_product_class_group_members_v2_metadata_chk check (jsonb_typeof(metadata) = 'object'),
  constraint sanitario_product_class_group_members_v2_scope_chk check (
    (scope = 'global' and fazenda_id is null)
    or (scope = 'tenant' and fazenda_id is not null)
  )
);

create table if not exists public.sanitario_product_class_default_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  scope text not null default 'global',
  class_id uuid not null references public.sanitario_product_classes_v2(id) on delete cascade,
  species_code text not null,
  aptitude text not null default 'all',
  dose_rule jsonb,
  route_rule jsonb,
  withdrawal_rule jsonb,
  execution_product_policy public.sanitario_execution_product_policy_v2_enum not null default 'required_at_execution',
  can_validate_execution boolean not null default false,
  requires_executed_product_for_withdrawal boolean not null default true,
  source_refs jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  curation_status public.sanitario_curation_status_class_v2_enum not null default 'candidate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_product_class_default_rules_v2_can_validate_chk check (can_validate_execution = false),
  constraint sanitario_product_class_default_rules_v2_requires_product_chk check (requires_executed_product_for_withdrawal = true),
  constraint sanitario_product_class_default_rules_v2_policy_chk check (execution_product_policy <> 'fixed_by_protocol'),
  constraint sanitario_product_class_default_rules_v2_source_refs_chk check (
    ((dose_rule is not null or route_rule is not null or withdrawal_rule is not null) and jsonb_array_length(source_refs) > 0)
    or (dose_rule is null and route_rule is null and withdrawal_rule is null)
  ),
  constraint sanitario_product_class_default_rules_v2_metadata_chk check (jsonb_typeof(metadata) = 'object'),
  constraint sanitario_product_class_default_rules_v2_scope_chk check (
    (scope = 'global' and fazenda_id is null)
    or (scope = 'tenant' and fazenda_id is not null)
  )
);

drop trigger if exists set_updated_at_sanitario_product_classes_v2 on public.sanitario_product_classes_v2;
create trigger set_updated_at_sanitario_product_classes_v2 before update on public.sanitario_product_classes_v2 for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_sanitario_product_class_groups_v2 on public.sanitario_product_class_groups_v2;
create trigger set_updated_at_sanitario_product_class_groups_v2 before update on public.sanitario_product_class_groups_v2 for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_sanitario_product_class_default_rules_v2 on public.sanitario_product_class_default_rules_v2;
create trigger set_updated_at_sanitario_product_class_default_rules_v2 before update on public.sanitario_product_class_default_rules_v2 for each row execute function public.set_updated_at();

create index if not exists sanitario_product_classes_v2_fazenda_id_idx on public.sanitario_product_classes_v2(fazenda_id);
create index if not exists sanitario_product_classes_v2_scope_idx on public.sanitario_product_classes_v2(scope);
create index if not exists sanitario_product_classes_v2_curation_status_idx on public.sanitario_product_classes_v2(curation_status);
create index if not exists sanitario_product_classes_v2_automation_status_idx on public.sanitario_product_classes_v2(automation_status);
create index if not exists sanitario_product_classes_v2_deleted_at_idx on public.sanitario_product_classes_v2(deleted_at);
create unique index if not exists sanitario_product_classes_v2_class_key_unique_idx on public.sanitario_product_classes_v2(scope, class_key) where deleted_at is null and scope = 'global';
create unique index if not exists sanitario_product_classes_v2_class_key_tenant_unique_idx on public.sanitario_product_classes_v2(fazenda_id, class_key) where deleted_at is null and scope = 'tenant';

create index if not exists sanitario_product_class_groups_v2_fazenda_id_idx on public.sanitario_product_class_groups_v2(fazenda_id);
create index if not exists sanitario_product_class_groups_v2_scope_idx on public.sanitario_product_class_groups_v2(scope);
create index if not exists sanitario_product_class_groups_v2_curation_status_idx on public.sanitario_product_class_groups_v2(curation_status);
create index if not exists sanitario_product_class_groups_v2_automation_status_idx on public.sanitario_product_class_groups_v2(automation_status);
create index if not exists sanitario_product_class_groups_v2_deleted_at_idx on public.sanitario_product_class_groups_v2(deleted_at);
create unique index if not exists sanitario_product_class_groups_v2_group_key_unique_idx on public.sanitario_product_class_groups_v2(scope, group_key) where deleted_at is null and scope = 'global';
create unique index if not exists sanitario_product_class_groups_v2_group_key_tenant_unique_idx on public.sanitario_product_class_groups_v2(fazenda_id, group_key) where deleted_at is null and scope = 'tenant';

create index if not exists sanitario_product_class_group_members_v2_fazenda_id_idx on public.sanitario_product_class_group_members_v2(fazenda_id);
create index if not exists sanitario_product_class_group_members_v2_scope_idx on public.sanitario_product_class_group_members_v2(scope);
create index if not exists sanitario_product_class_group_members_v2_group_id_idx on public.sanitario_product_class_group_members_v2(group_id);
create index if not exists sanitario_product_class_group_members_v2_class_id_idx on public.sanitario_product_class_group_members_v2(class_id);
create index if not exists sanitario_product_class_group_members_v2_deleted_at_idx on public.sanitario_product_class_group_members_v2(deleted_at);
create unique index if not exists sanitario_product_class_group_members_v2_unique_idx on public.sanitario_product_class_group_members_v2(group_id, class_id) where deleted_at is null;

create index if not exists sanitario_product_class_default_rules_v2_class_id_idx on public.sanitario_product_class_default_rules_v2(class_id);
create index if not exists sanitario_product_class_default_rules_v2_deleted_at_idx on public.sanitario_product_class_default_rules_v2(deleted_at);
create unique index if not exists sanitario_product_class_default_rules_v2_unique_idx on public.sanitario_product_class_default_rules_v2(class_id, species_code, aptitude) where deleted_at is null;

alter table public.sanitario_product_classes_v2 enable row level security;
alter table public.sanitario_product_class_groups_v2 enable row level security;
alter table public.sanitario_product_class_group_members_v2 enable row level security;
alter table public.sanitario_product_class_default_rules_v2 enable row level security;

drop policy if exists sanitario_product_classes_v2_select_auth on public.sanitario_product_classes_v2;
create policy sanitario_product_classes_v2_select_auth on public.sanitario_product_classes_v2
  for select to authenticated
  using (
    deleted_at is null
    and (scope = 'global' or public.has_membership(fazenda_id))
  );

drop policy if exists sanitario_product_classes_v2_write_fazenda_manager on public.sanitario_product_classes_v2;
create policy sanitario_product_classes_v2_write_fazenda_manager on public.sanitario_product_classes_v2
  for all to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

drop policy if exists sanitario_product_class_groups_v2_select_auth on public.sanitario_product_class_groups_v2;
create policy sanitario_product_class_groups_v2_select_auth on public.sanitario_product_class_groups_v2
  for select to authenticated
  using (
    deleted_at is null
    and (scope = 'global' or public.has_membership(fazenda_id))
  );

drop policy if exists sanitario_product_class_groups_v2_write_fazenda_manager on public.sanitario_product_class_groups_v2;
create policy sanitario_product_class_groups_v2_write_fazenda_manager on public.sanitario_product_class_groups_v2
  for all to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

drop policy if exists sanitario_product_class_group_members_v2_select_auth on public.sanitario_product_class_group_members_v2;
create policy sanitario_product_class_group_members_v2_select_auth on public.sanitario_product_class_group_members_v2
  for select to authenticated
  using (
    deleted_at is null
    and (scope = 'global' or public.has_membership(fazenda_id))
  );

drop policy if exists sanitario_product_class_group_members_v2_write_fazenda_manager on public.sanitario_product_class_group_members_v2;
create policy sanitario_product_class_group_members_v2_write_fazenda_manager on public.sanitario_product_class_group_members_v2
  for all to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

drop policy if exists sanitario_product_class_default_rules_v2_select_auth on public.sanitario_product_class_default_rules_v2;
create policy sanitario_product_class_default_rules_v2_select_auth on public.sanitario_product_class_default_rules_v2
  for select to authenticated
  using (
    deleted_at is null
    and (scope = 'global' or public.has_membership(fazenda_id))
  );

drop policy if exists sanitario_product_class_default_rules_v2_write_fazenda_manager on public.sanitario_product_class_default_rules_v2;
create policy sanitario_product_class_default_rules_v2_write_fazenda_manager on public.sanitario_product_class_default_rules_v2
  for all to authenticated
  using (
    scope = 'tenant'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );

comment on table public.sanitario_product_classes_v2 is 'ProductClass não é produto comercial.';
comment on table public.sanitario_product_class_groups_v2 is 'ProductClassGroup agrupa classes aceitas por um item.';
comment on table public.sanitario_product_class_default_rules_v2 is 'DefaultRule não valida execução. Carência ativa nasce somente no evento executado com snapshot. Agenda não libera carência. SanitaryProduct executado continua necessário para carência aplicada.';
