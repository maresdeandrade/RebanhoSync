do $$ begin create type public.sanitario_source_kind_v2_enum as enum ('norma_oficial','bula','registro_produto','bibliografia','guideline_apoio','mv_responsavel'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_source_scope_v2_enum as enum ('global','fazenda'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_source_strength_v2_enum as enum ('forte','apoio','fraca'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_evidence_status_v2_enum as enum ('SIM_BULA','SIM_NORMA','PRECISA_VALIDAR','NAO_AUTORIZADO','EXTRAPOLADO'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_source_coverage_status_v2_enum as enum ('covers','partially_covers','does_not_cover'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_curatorial_status_v2_enum as enum ('ativo','precisa_validar','bloqueado','arquivado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_species_code_v2_enum as enum ('bovino','bubalino','outro'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_aptitude_v2_enum as enum ('corte','leite','mista','all'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_dose_basis_v2_enum as enum ('animal','kg_peso_vivo','dose'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_withdrawal_applicability_v2_enum as enum ('period','zero','not_applicable','unknown','not_permitted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_protocol_scope_v2_enum as enum ('global','pack','fazenda'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_protocol_legal_status_v2_enum as enum ('obrigatorio_norma','recomendado_tecnico','condicional','estrategico','experimental_alerta','bloqueado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_protocol_status_v2_enum as enum ('draft','active','retired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_protocol_approval_status_v2_enum as enum ('draft','pending_review','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_protocol_item_status_v2_enum as enum ('obrigatorio','recomendado','condicional','estrategico','somente_alerta','bloqueado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_action_type_v2_enum as enum ('vacinacao','vermifugacao','tratamento','exame','manejo_sanitario','alerta'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sanitario_product_requirement_kind_v2_enum as enum ('specific_product','product_class','none'); exception when duplicate_object then null; end $$;

create table if not exists public.sanitario_fontes_tecnicas_v2 (
  id uuid primary key default gen_random_uuid(),
  kind public.sanitario_source_kind_v2_enum not null,
  scope public.sanitario_source_scope_v2_enum not null default 'global',
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  title text not null,
  issuer text,
  version text,
  published_at date,
  accessed_at date,
  url text,
  jurisdiction_country text default 'BR',
  jurisdiction_uf public.estado_uf_enum,
  jurisdiction_zone text,
  strength public.sanitario_source_strength_v2_enum not null,
  evidence_status public.sanitario_evidence_status_v2_enum not null,
  limitations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_fontes_tecnicas_v2_title_chk check (btrim(title) <> ''),
  constraint sanitario_fontes_tecnicas_v2_scope_chk check (
    (scope = 'global' and fazenda_id is null)
    or (scope = 'fazenda' and fazenda_id is not null)
  ),
  constraint sanitario_fontes_tecnicas_v2_mv_scope_chk check (kind <> 'mv_responsavel' or scope = 'fazenda'),
  constraint sanitario_fontes_tecnicas_v2_limitations_chk check (jsonb_typeof(limitations) = 'array'),
  constraint sanitario_fontes_tecnicas_v2_metadata_chk check (jsonb_typeof(metadata) = 'object'),
  constraint sanitario_fontes_tecnicas_v2_guideline_strength_chk check (kind <> 'guideline_apoio' or strength <> 'forte')
);

create table if not exists public.sanitario_fonte_cobertura_campos_v2 (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sanitario_fontes_tecnicas_v2(id) on delete cascade,
  field_key text not null,
  coverage_status public.sanitario_source_coverage_status_v2_enum not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_fonte_cobertura_campos_v2_field_key_chk check (btrim(field_key) <> ''),
  constraint sanitario_fonte_cobertura_campos_v2_unique unique (source_id, field_key)
);

create table if not exists public.sanitario_produtos_v2 (
  id uuid primary key default gen_random_uuid(),
  nome_comercial text not null,
  fabricante text,
  registro_orgao text,
  registro_numero text,
  classe text not null,
  principio_ativo text,
  tipo_produto text not null,
  apresentacao text,
  status_curatorial public.sanitario_curatorial_status_v2_enum not null default 'precisa_validar',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_produtos_v2_nome_chk check (btrim(nome_comercial) <> ''),
  constraint sanitario_produtos_v2_classe_chk check (btrim(classe) <> ''),
  constraint sanitario_produtos_v2_tipo_chk check (btrim(tipo_produto) <> ''),
  constraint sanitario_produtos_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.sanitario_produto_especie_autorizacao_v2 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.sanitario_produtos_v2(id) on delete cascade,
  species_code public.sanitario_species_code_v2_enum not null,
  authorization_status public.sanitario_evidence_status_v2_enum not null,
  aptitude public.sanitario_aptitude_v2_enum not null default 'all',
  sexo text,
  idade_min_dias integer,
  idade_max_dias integer,
  lactacao_permitida boolean,
  gestacao_permitida boolean,
  requires_mv_responsavel boolean not null default false,
  limitations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_produto_especie_autorizacao_v2_idade_chk check (
    (idade_min_dias is null or idade_min_dias >= 0)
    and (idade_max_dias is null or idade_max_dias >= 0)
    and (idade_min_dias is null or idade_max_dias is null or idade_min_dias <= idade_max_dias)
  ),
  constraint sanitario_produto_especie_autorizacao_v2_limitations_chk check (jsonb_typeof(limitations) = 'array'),
  constraint sanitario_produto_especie_autorizacao_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.sanitario_produto_fontes_v2 (
  product_id uuid not null references public.sanitario_produtos_v2(id) on delete cascade,
  source_id uuid not null references public.sanitario_fontes_tecnicas_v2(id) on delete restrict,
  field_key text not null,
  created_at timestamptz not null default now(),
  primary key (product_id, source_id, field_key),
  constraint sanitario_produto_fontes_v2_field_key_chk check (btrim(field_key) <> '')
);

create table if not exists public.sanitario_produto_dose_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.sanitario_produtos_v2(id) on delete cascade,
  species_code public.sanitario_species_code_v2_enum,
  aptitude public.sanitario_aptitude_v2_enum,
  route text not null,
  dose_quantity numeric(12,4) not null,
  dose_unit text not null,
  dose_basis public.sanitario_dose_basis_v2_enum not null,
  min_weight_kg numeric(12,3),
  max_weight_kg numeric(12,3),
  limitations jsonb not null default '[]'::jsonb,
  status_curatorial public.sanitario_curatorial_status_v2_enum not null default 'precisa_validar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_produto_dose_rules_v2_route_chk check (btrim(route) <> ''),
  constraint sanitario_produto_dose_rules_v2_quantity_chk check (dose_quantity > 0),
  constraint sanitario_produto_dose_rules_v2_unit_chk check (btrim(dose_unit) <> ''),
  constraint sanitario_produto_dose_rules_v2_weight_chk check (
    (min_weight_kg is null or min_weight_kg >= 0)
    and (max_weight_kg is null or max_weight_kg >= 0)
    and (min_weight_kg is null or max_weight_kg is null or min_weight_kg <= max_weight_kg)
  ),
  constraint sanitario_produto_dose_rules_v2_limitations_chk check (jsonb_typeof(limitations) = 'array')
);

create table if not exists public.sanitario_produto_carencia_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.sanitario_produtos_v2(id) on delete cascade,
  species_code public.sanitario_species_code_v2_enum not null,
  aptitude public.sanitario_aptitude_v2_enum not null,
  route text,
  dose_basis public.sanitario_dose_basis_v2_enum,
  meat_days integer,
  milk_days integer,
  milk_hours integer,
  applicability public.sanitario_withdrawal_applicability_v2_enum not null,
  zero_requires_explicit_source boolean not null default true,
  valid_from date,
  valid_until date,
  status_curatorial public.sanitario_curatorial_status_v2_enum not null default 'precisa_validar',
  limitations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_produto_carencia_rules_v2_values_chk check (
    (meat_days is null or meat_days >= 0)
    and (milk_days is null or milk_days >= 0)
    and (milk_hours is null or milk_hours >= 0)
  ),
  constraint sanitario_produto_carencia_rules_v2_period_chk check (
    applicability <> 'period' or meat_days is not null or milk_days is not null or milk_hours is not null
  ),
  constraint sanitario_produto_carencia_rules_v2_dates_chk check (valid_from is null or valid_until is null or valid_from <= valid_until),
  constraint sanitario_produto_carencia_rules_v2_limitations_chk check (jsonb_typeof(limitations) = 'array'),
  constraint sanitario_produto_carencia_rules_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.sanitario_produto_carencia_fontes_v2 (
  withdrawal_rule_id uuid not null references public.sanitario_produto_carencia_rules_v2(id) on delete cascade,
  source_id uuid not null references public.sanitario_fontes_tecnicas_v2(id) on delete restrict,
  field_key text not null,
  created_at timestamptz not null default now(),
  primary key (withdrawal_rule_id, source_id, field_key),
  constraint sanitario_produto_carencia_fontes_v2_field_key_chk check (btrim(field_key) <> '')
);

create table if not exists public.sanitario_protocolos_v2 (
  id uuid primary key default gen_random_uuid(),
  family_code text not null,
  name text not null,
  scope public.sanitario_protocol_scope_v2_enum not null,
  fazenda_id uuid references public.fazendas(id) on delete cascade,
  species_scope jsonb not null default '[]'::jsonb,
  jurisdiction_scope jsonb not null default '{}'::jsonb,
  legal_status public.sanitario_protocol_legal_status_v2_enum not null,
  version integer not null,
  status public.sanitario_protocol_status_v2_enum not null default 'draft',
  source_refs_snapshot jsonb not null default '[]'::jsonb,
  approval_status public.sanitario_protocol_approval_status_v2_enum not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_protocolos_v2_family_chk check (btrim(family_code) <> ''),
  constraint sanitario_protocolos_v2_name_chk check (btrim(name) <> ''),
  constraint sanitario_protocolos_v2_scope_fazenda_chk check (
    (scope = 'fazenda' and fazenda_id is not null)
    or (scope in ('global','pack') and fazenda_id is null)
  ),
  constraint sanitario_protocolos_v2_version_chk check (version > 0),
  constraint sanitario_protocolos_v2_species_scope_chk check (jsonb_typeof(species_scope) = 'array'),
  constraint sanitario_protocolos_v2_jurisdiction_scope_chk check (jsonb_typeof(jurisdiction_scope) = 'object'),
  constraint sanitario_protocolos_v2_source_refs_snapshot_chk check (jsonb_typeof(source_refs_snapshot) = 'array'),
  constraint sanitario_protocolos_v2_metadata_chk check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.sanitario_protocolo_itens_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.sanitario_protocolos_v2(id) on delete cascade,
  logical_item_key text not null,
  version integer not null,
  item_status public.sanitario_protocol_item_status_v2_enum not null,
  action_type public.sanitario_action_type_v2_enum not null,
  product_requirement_kind public.sanitario_product_requirement_kind_v2_enum not null,
  product_id uuid references public.sanitario_produtos_v2(id) on delete restrict,
  product_class text,
  eligibility_rule jsonb not null,
  operational_window_rule jsonb not null,
  dose_rule jsonb,
  route_rule jsonb,
  booster_rule jsonb,
  species_authorization jsonb not null,
  source_refs_by_field jsonb not null,
  limitations jsonb not null default '[]'::jsonb,
  snapshot_template jsonb not null default '{}'::jsonb,
  allows_agenda_auto boolean not null default true,
  requires_mv_responsavel boolean not null default false,
  status public.sanitario_protocol_status_v2_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sanitario_protocolo_itens_versions_v2_key_chk check (btrim(logical_item_key) <> ''),
  constraint sanitario_protocolo_itens_versions_v2_version_chk check (version > 0),
  constraint sanitario_protocolo_itens_versions_v2_product_req_chk check (
    (product_requirement_kind = 'specific_product' and product_id is not null and product_class is null)
    or (product_requirement_kind = 'product_class' and product_id is null and product_class is not null and btrim(product_class) <> '')
    or (product_requirement_kind = 'none' and product_id is null and product_class is null)
  ),
  constraint sanitario_protocolo_itens_versions_v2_auto_agenda_chk check (
    item_status not in ('somente_alerta','bloqueado') or allows_agenda_auto = false
  ),
  constraint sanitario_protocolo_itens_versions_v2_json_chk check (
    jsonb_typeof(eligibility_rule) = 'object'
    and jsonb_typeof(operational_window_rule) = 'object'
    and (dose_rule is null or jsonb_typeof(dose_rule) = 'object')
    and (route_rule is null or jsonb_typeof(route_rule) = 'object')
    and (booster_rule is null or jsonb_typeof(booster_rule) = 'object')
    and jsonb_typeof(species_authorization) = 'array'
    and jsonb_typeof(source_refs_by_field) = 'object'
    and jsonb_typeof(limitations) = 'array'
    and jsonb_typeof(snapshot_template) = 'object'
  ),
  constraint sanitario_protocolo_itens_versions_v2_unique unique (protocol_id, logical_item_key, version)
);

create unique index if not exists ux_sanitario_produtos_v2_nome_registro
  on public.sanitario_produtos_v2 (lower(nome_comercial), coalesce(registro_orgao, ''), coalesce(registro_numero, ''))
  where deleted_at is null;
create index if not exists idx_sanitario_fontes_tecnicas_v2_kind on public.sanitario_fontes_tecnicas_v2(kind, strength, evidence_status) where deleted_at is null;
create index if not exists idx_sanitario_fontes_tecnicas_v2_scope on public.sanitario_fontes_tecnicas_v2(scope, fazenda_id) where deleted_at is null;
create index if not exists idx_sanitario_fonte_cobertura_campos_v2_source on public.sanitario_fonte_cobertura_campos_v2(source_id, field_key) where deleted_at is null;
create unique index if not exists ux_sanitario_produto_especie_autorizacao_v2_scope
  on public.sanitario_produto_especie_autorizacao_v2 (product_id, species_code, aptitude, coalesce(sexo, 'all'))
  where deleted_at is null;
create index if not exists idx_sanitario_produto_especie_aut_v2_product on public.sanitario_produto_especie_autorizacao_v2(product_id, species_code, authorization_status) where deleted_at is null;
create index if not exists idx_sanitario_produto_dose_rules_v2_product on public.sanitario_produto_dose_rules_v2(product_id, species_code, aptitude) where deleted_at is null;
create index if not exists idx_sanitario_produto_carencia_rules_v2_product on public.sanitario_produto_carencia_rules_v2(product_id, species_code, aptitude, applicability) where deleted_at is null;
create unique index if not exists ux_sanitario_protocolos_v2_family_scope_version
  on public.sanitario_protocolos_v2 (family_code, scope, coalesce(fazenda_id, '00000000-0000-0000-0000-000000000000'::uuid), version)
  where deleted_at is null;
create index if not exists idx_sanitario_protocolos_v2_scope on public.sanitario_protocolos_v2(scope, fazenda_id, status) where deleted_at is null;
create index if not exists idx_sanitario_protocolo_itens_versions_v2_protocol on public.sanitario_protocolo_itens_versions_v2(protocol_id, logical_item_key, status) where deleted_at is null;

drop trigger if exists set_updated_at_sanitario_fontes_tecnicas_v2 on public.sanitario_fontes_tecnicas_v2;
create trigger set_updated_at_sanitario_fontes_tecnicas_v2 before update on public.sanitario_fontes_tecnicas_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_fonte_cobertura_campos_v2 on public.sanitario_fonte_cobertura_campos_v2;
create trigger set_updated_at_sanitario_fonte_cobertura_campos_v2 before update on public.sanitario_fonte_cobertura_campos_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_produtos_v2 on public.sanitario_produtos_v2;
create trigger set_updated_at_sanitario_produtos_v2 before update on public.sanitario_produtos_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_produto_especie_autorizacao_v2 on public.sanitario_produto_especie_autorizacao_v2;
create trigger set_updated_at_sanitario_produto_especie_autorizacao_v2 before update on public.sanitario_produto_especie_autorizacao_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_produto_dose_rules_v2 on public.sanitario_produto_dose_rules_v2;
create trigger set_updated_at_sanitario_produto_dose_rules_v2 before update on public.sanitario_produto_dose_rules_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_produto_carencia_rules_v2 on public.sanitario_produto_carencia_rules_v2;
create trigger set_updated_at_sanitario_produto_carencia_rules_v2 before update on public.sanitario_produto_carencia_rules_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_protocolos_v2 on public.sanitario_protocolos_v2;
create trigger set_updated_at_sanitario_protocolos_v2 before update on public.sanitario_protocolos_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_sanitario_protocolo_itens_versions_v2 on public.sanitario_protocolo_itens_versions_v2;
create trigger set_updated_at_sanitario_protocolo_itens_versions_v2 before update on public.sanitario_protocolo_itens_versions_v2 for each row execute function public.set_updated_at();

alter table public.sanitario_fontes_tecnicas_v2 enable row level security;
alter table public.sanitario_fonte_cobertura_campos_v2 enable row level security;
alter table public.sanitario_produtos_v2 enable row level security;
alter table public.sanitario_produto_especie_autorizacao_v2 enable row level security;
alter table public.sanitario_produto_fontes_v2 enable row level security;
alter table public.sanitario_produto_dose_rules_v2 enable row level security;
alter table public.sanitario_produto_carencia_rules_v2 enable row level security;
alter table public.sanitario_produto_carencia_fontes_v2 enable row level security;
alter table public.sanitario_protocolos_v2 enable row level security;
alter table public.sanitario_protocolo_itens_versions_v2 enable row level security;

drop policy if exists sanitario_fontes_tecnicas_v2_select_auth on public.sanitario_fontes_tecnicas_v2;
create policy sanitario_fontes_tecnicas_v2_select_auth on public.sanitario_fontes_tecnicas_v2
  for select to authenticated
  using (
    deleted_at is null
    and (scope = 'global' or public.has_membership(fazenda_id))
  );
create policy sanitario_fontes_tecnicas_v2_write_fazenda_manager on public.sanitario_fontes_tecnicas_v2
  for all to authenticated
  using (
    scope = 'fazenda'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  )
  with check (
    scope = 'fazenda'
    and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[])
  );
create policy sanitario_fonte_cobertura_campos_v2_select_auth on public.sanitario_fonte_cobertura_campos_v2
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.sanitario_fontes_tecnicas_v2 f
      where f.id = source_id
        and f.deleted_at is null
        and (f.scope = 'global' or public.has_membership(f.fazenda_id))
    )
  );
create policy sanitario_produtos_v2_select_auth on public.sanitario_produtos_v2 for select to authenticated using (deleted_at is null);
create policy sanitario_produto_especie_autorizacao_v2_select_auth on public.sanitario_produto_especie_autorizacao_v2 for select to authenticated using (deleted_at is null);
create policy sanitario_produto_fontes_v2_select_auth on public.sanitario_produto_fontes_v2
  for select to authenticated
  using (
    exists (
      select 1 from public.sanitario_produtos_v2 p
      where p.id = product_id and p.deleted_at is null
    )
    and exists (
      select 1 from public.sanitario_fontes_tecnicas_v2 f
      where f.id = source_id
        and f.deleted_at is null
        and (f.scope = 'global' or public.has_membership(f.fazenda_id))
    )
  );
create policy sanitario_produto_dose_rules_v2_select_auth on public.sanitario_produto_dose_rules_v2 for select to authenticated using (deleted_at is null);
create policy sanitario_produto_carencia_rules_v2_select_auth on public.sanitario_produto_carencia_rules_v2 for select to authenticated using (deleted_at is null);
create policy sanitario_produto_carencia_fontes_v2_select_auth on public.sanitario_produto_carencia_fontes_v2
  for select to authenticated
  using (
    exists (
      select 1 from public.sanitario_produto_carencia_rules_v2 w
      where w.id = withdrawal_rule_id and w.deleted_at is null
    )
    and exists (
      select 1 from public.sanitario_fontes_tecnicas_v2 f
      where f.id = source_id
        and f.deleted_at is null
        and (f.scope = 'global' or public.has_membership(f.fazenda_id))
    )
  );

create policy sanitario_protocolos_v2_select_auth on public.sanitario_protocolos_v2
  for select to authenticated
  using (deleted_at is null and (scope in ('global','pack') or public.has_membership(fazenda_id)));
create policy sanitario_protocolos_v2_write_fazenda_manager on public.sanitario_protocolos_v2
  for all to authenticated
  using (scope = 'fazenda' and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]))
  with check (scope = 'fazenda' and public.role_in_fazenda(fazenda_id, array['owner','manager']::public.farm_role_enum[]));
create policy sanitario_protocolo_itens_versions_v2_select_auth on public.sanitario_protocolo_itens_versions_v2
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.sanitario_protocolos_v2 p
      where p.id = protocol_id
        and p.deleted_at is null
        and (p.scope in ('global','pack') or public.has_membership(p.fazenda_id))
    )
  );
create policy sanitario_protocolo_itens_versions_v2_write_fazenda_manager on public.sanitario_protocolo_itens_versions_v2
  for all to authenticated
  using (
    exists (
      select 1 from public.sanitario_protocolos_v2 p
      where p.id = protocol_id
        and p.scope = 'fazenda'
        and public.role_in_fazenda(p.fazenda_id, array['owner','manager']::public.farm_role_enum[])
    )
  )
  with check (
    exists (
      select 1 from public.sanitario_protocolos_v2 p
      where p.id = protocol_id
        and p.scope = 'fazenda'
        and public.role_in_fazenda(p.fazenda_id, array['owner','manager']::public.farm_role_enum[])
    )
  );

grant usage on type public.sanitario_source_kind_v2_enum to authenticated;
grant usage on type public.sanitario_source_scope_v2_enum to authenticated;
grant usage on type public.sanitario_source_strength_v2_enum to authenticated;
grant usage on type public.sanitario_evidence_status_v2_enum to authenticated;
grant usage on type public.sanitario_source_coverage_status_v2_enum to authenticated;
grant usage on type public.sanitario_curatorial_status_v2_enum to authenticated;
grant usage on type public.sanitario_species_code_v2_enum to authenticated;
grant usage on type public.sanitario_aptitude_v2_enum to authenticated;
grant usage on type public.sanitario_dose_basis_v2_enum to authenticated;
grant usage on type public.sanitario_withdrawal_applicability_v2_enum to authenticated;
grant usage on type public.sanitario_protocol_scope_v2_enum to authenticated;
grant usage on type public.sanitario_protocol_legal_status_v2_enum to authenticated;
grant usage on type public.sanitario_protocol_status_v2_enum to authenticated;
grant usage on type public.sanitario_protocol_approval_status_v2_enum to authenticated;
grant usage on type public.sanitario_protocol_item_status_v2_enum to authenticated;
grant usage on type public.sanitario_action_type_v2_enum to authenticated;
grant usage on type public.sanitario_product_requirement_kind_v2_enum to authenticated;

grant select on public.sanitario_fontes_tecnicas_v2, public.sanitario_fonte_cobertura_campos_v2, public.sanitario_produtos_v2, public.sanitario_produto_especie_autorizacao_v2, public.sanitario_produto_fontes_v2, public.sanitario_produto_dose_rules_v2, public.sanitario_produto_carencia_rules_v2, public.sanitario_produto_carencia_fontes_v2, public.sanitario_protocolos_v2, public.sanitario_protocolo_itens_versions_v2 to authenticated;
grant insert, update on public.sanitario_fontes_tecnicas_v2 to authenticated;
grant insert, update on public.sanitario_protocolos_v2, public.sanitario_protocolo_itens_versions_v2 to authenticated;

comment on table public.sanitario_fontes_tecnicas_v2 is 'Fonte tecnica canonica v2 para produto, protocolo, dose, especie e carencia. Guideline de apoio nao substitui fonte forte.';
comment on column public.sanitario_fontes_tecnicas_v2.scope is 'Fonte global e compartilhada ou fonte da fazenda. MV responsavel deve ser scope=fazenda.';
comment on column public.sanitario_fontes_tecnicas_v2.strength is 'forte permite campo critico somente quando a cobertura por field_key tambem cobre o campo.';
comment on table public.sanitario_fonte_cobertura_campos_v2 is 'Cobertura explicita de fonte tecnica por field_key critico.';
comment on table public.sanitario_produtos_v2 is 'Produto sanitario/veterinario canonico v2. Produto planejado nao e produto executado.';
comment on table public.sanitario_produto_especie_autorizacao_v2 is 'Autorizacao por especie. Bubalino nao herda autorizacao bovina.';
comment on table public.sanitario_produto_dose_rules_v2 is 'Dose, via e base de dose estruturadas; nao usar payload livre para campo critico.';
comment on table public.sanitario_produto_carencia_rules_v2 is 'Regra de carencia por produto/contexto. Carencia zero exige fonte forte explicita fora de constraint SQL simples.';
comment on table public.sanitario_protocolos_v2 is 'Protocolo sanitario v2 e regra/configuracao versionada, nao execucao.';
comment on table public.sanitario_protocolo_itens_versions_v2 is 'Item fisico versionado de protocolo sanitario v2. Alteracao semantica exige nova versao.';
comment on table public.produtos_veterinarios is 'LEGADO operacional: nao canonico para Produto Sanitario v2. Mantido por dependencia ativa de UI/offline/sync.';
comment on table public.protocolos_sanitarios is 'LEGADO operacional: nao canonico para Protocolo Sanitario v2. Mantido por dependencia ativa de UI/offline/sync.';
comment on table public.protocolos_sanitarios_itens is 'LEGADO operacional: nao canonico para Item Versionado v2. Mantido por dependencia ativa de UI/offline/sync.';
