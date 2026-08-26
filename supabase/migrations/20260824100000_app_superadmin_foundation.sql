-- 20260824100000_app_superadmin_foundation.sql
-- ============================================================================
-- RebanhoSync — Admin Track A1: Fundação de Segurança SuperAdmin
-- ============================================================================
-- 1. Tabela app_superadmins (registro restrito de administradores da plataforma)
-- 2. Função public.is_app_admin() (validação server-side hardened)
-- 3. Tabela app_admin_audit_events (trilha de auditoria append-only)
-- 4. RLS policies, triggers de imutabilidade e grants mínimos
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela app_superadmins
-- ----------------------------------------------------------------------------
create table if not exists public.app_superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.app_superadmins enable row level security;

-- RLS: Usuário autenticado só pode consultar o próprio registro se for superadmin
create policy app_superadmins_select_self on public.app_superadmins
  for select
  to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Função de Segurança is_app_admin()
-- ----------------------------------------------------------------------------
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_superadmins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Tabela app_admin_audit_events (Trilha de auditoria append-only)
-- ----------------------------------------------------------------------------
create table if not exists public.app_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  state_before jsonb,
  state_after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Trigger de imutabilidade (proíbe UPDATE e DELETE)
create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'app_admin_audit_events is append-only and cannot be updated or deleted'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_prevent_admin_audit_mutation on public.app_admin_audit_events;

create trigger trg_prevent_admin_audit_mutation
  before update or delete on public.app_admin_audit_events
  for each row
  execute function public.prevent_admin_audit_mutation();

alter table public.app_admin_audit_events enable row level security;

-- RLS: Apenas SuperAdmins podem consultar eventos de auditoria
create policy app_admin_audit_events_select_admin on public.app_admin_audit_events
  for select
  to authenticated
  using (public.is_app_admin());

-- ----------------------------------------------------------------------------
-- 4. Grants restritos
-- ----------------------------------------------------------------------------
revoke all on table public.app_superadmins from public, anon;
revoke all on table public.app_admin_audit_events from public, anon;

grant select on table public.app_superadmins to authenticated, service_role;
grant select on table public.app_admin_audit_events to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Bootstrap Note (NÃO incluir dados fixos de usuários na migration versionada):
-- Para conceder acesso de SuperAdmin a um usuário específico por ambiente,
-- execute com credenciais administrativas / service_role:
--
-- insert into public.app_superadmins(user_id, notes)
-- values ('<TARGET_AUTH_USER_UUID>', 'Bootstrap SuperAdmin');
-- ----------------------------------------------------------------------------
