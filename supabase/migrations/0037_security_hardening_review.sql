-- 0037_security_hardening_review.sql
-- Security Hardening Review (2026-02-11)
-- 1. Fix vulnerability in get_user_emails (restrict to farm members)
-- 2. Ensure RLS is enabled on all tables
-- 3. Verify search_path on sensitive RPCs

-- =========================================================
-- 1. Fix get_user_emails RPC
-- Vulnerability: Previously allowed enumeration of any user email by ID.
-- Fix: Restrict to users who share at least one active farm membership with the requester.
-- =========================================================

create or replace function public.get_user_emails(user_ids uuid[])
returns table (
  user_id uuid,
  email text
)
language sql
security definer
set search_path = public
as $$
  select au.id as user_id, au.email
  from auth.users au
  where au.id = any(user_ids)
  and exists (
    select 1
    from public.user_fazendas uf_requester
    join public.user_fazendas uf_target on uf_target.fazenda_id = uf_requester.fazenda_id
    where uf_requester.user_id = auth.uid()
      and uf_target.user_id = au.id
      and uf_requester.deleted_at is null
      and uf_target.deleted_at is null
  );
$$;

revoke all on function public.get_user_emails(uuid[]) from public;
grant execute on function public.get_user_emails(uuid[]) to authenticated;

-- =========================================================
-- 2. Ensure RLS is Enabled (Idempotent Safety Net)
-- =========================================================

alter table public.fazendas enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_fazendas enable row level security;

-- Core Domain
alter table public.pastos enable row level security;
alter table public.lotes enable row level security;
alter table public.animais enable row level security;
alter table public.contrapartes enable row level security;
alter table public.protocolos_sanitarios enable row level security;
alter table public.protocolos_sanitarios_itens enable row level security;

-- Event & Agenda
alter table public.agenda_itens enable row level security;
alter table public.eventos enable row level security;
alter table public.eventos_sanitario enable row level security;
alter table public.eventos_pesagem enable row level security;
alter table public.eventos_nutricao enable row level security;
alter table public.eventos_movimentacao enable row level security;
alter table public.eventos_reproducao enable row level security;
alter table public.eventos_financeiro enable row level security;

-- Extensions
alter table public.animais_sociedade enable row level security;
alter table public.categorias_zootecnicas enable row level security;

-- =========================================================
-- 3. Review & Fix Search Path on Critical RPCs (Defensive)
-- =========================================================

-- Ensure create_fazenda has correct search_path
-- (Already handled in 0017, but reinforcing here doesn't hurt if definition matches)
-- Skipped to avoid noise as 0017 is recent and correct.

-- Ensure seed_default_sanitary_protocols has correct search_path
-- (Already handled in 0027, correct).

-- Ensure sanitario_* engine functions have correct search_path
-- (Already handled in 0028, correct).
