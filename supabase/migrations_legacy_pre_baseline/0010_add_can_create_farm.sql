-- 0010_add_can_create_farm.sql
-- =========================================================
-- Onboarding gating: quem pode criar fazendas
-- Regra: (é owner em qualquer fazenda) OR (profiles.can_create_farm = true)
-- =========================================================

-- Adicionar campo para controlar quem pode criar fazendas
alter table public.user_profiles
  add column if not exists can_create_farm boolean not null default false;

-- Criar helper function para verificar se usuário pode criar fazenda
create or replace function public.can_create_farm()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    coalesce(
      exists (
        select 1
          from public.user_fazendas uf
          where uf.user_id = auth.uid()
            and uf.role = 'owner'
            and uf.deleted_at is null
      ),
      false
    )
    or
    coalesce(
      (select up.can_create_farm
       from public.user_profiles up
       where up.user_id = auth.uid()
       limit 1),
      false
    );
$$;

grant execute on function public.can_create_farm() to authenticated;
