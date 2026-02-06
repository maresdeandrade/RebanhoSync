-- 0005b_fix_user_fazendas_rls_recursion.sql
-- =========================================================
-- Fix: infinite recursion detected in policy for user_fazendas
-- Estratégia: helper functions SECURITY DEFINER com row_security=off
-- =========================================================

-- Helper: has_membership(fazenda_id)
create or replace function public.has_membership(_fazenda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.user_fazendas uf
    where uf.user_id = auth.uid()
      and uf.fazenda_id = _fazenda_id
      and uf.deleted_at is null
  );
$$;

-- Helper: role_in_fazenda(fazenda_id)
create or replace function public.role_in_fazenda(_fazenda_id uuid)
returns public.farm_role_enum
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select uf.role
  from public.user_fazendas uf
  where uf.user_id = auth.uid()
    and uf.fazenda_id = _fazenda_id
    and uf.deleted_at is null
  limit 1;
$$;

-- Recriar policy SELECT de user_fazendas sem recursão
drop policy if exists user_fazendas_select_members on public.user_fazendas;

create policy user_fazendas_select_members
on public.user_fazendas
for select
using (
  user_id = auth.uid()
  or public.has_membership(fazenda_id)
);
