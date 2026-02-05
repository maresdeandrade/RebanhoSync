-- 0004_rls_hardening.sql
-- =========================================================
-- RLS Hardening: fecha brechas e padroniza policies
-- - user_fazendas: SOMENTE SELECT (membership só via RPC security definer)
-- =========================================================

-- =========================================================
-- Enable RLS (garantir ligado)
-- =========================================================
alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.fazendas enable row level security;
alter table public.user_fazendas enable row level security;

alter table public.pastos enable row level security;
alter table public.lotes enable row level security;
alter table public.animais enable row level security;

alter table public.agenda_itens enable row level security;
alter table public.eventos enable row level security;

alter table public.contrapartes enable row level security;
alter table public.protocolos_sanitarios enable row level security;
alter table public.protocolos_sanitarios_itens enable row level security;

alter table public.eventos_sanitario enable row level security;
alter table public.eventos_pesagem enable row level security;
alter table public.eventos_nutricao enable row level security;
alter table public.eventos_movimentacao enable row level security;
alter table public.eventos_reproducao enable row level security;
alter table public.eventos_financeiro enable row level security;

-- =========================================================
-- user_profiles: self only (ALL)
-- =========================================================
drop policy if exists user_profiles_self on public.user_profiles;

create policy user_profiles_self
on public.user_profiles
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================================================
-- user_settings: self only (ALL)
-- =========================================================
drop policy if exists user_settings_self_all on public.user_settings;

create policy user_settings_self_all
on public.user_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =========================================================
-- fazendas: select by membership; insert by created_by; update/delete by owner
-- =========================================================
drop policy if exists fazendas_select_by_membership on public.fazendas;
drop policy if exists fazendas_insert_self on public.fazendas;
drop policy if exists fazendas_update_owner on public.fazendas;
drop policy if exists fazendas_delete_owner on public.fazendas;

create policy fazendas_select_by_membership
on public.fazendas
for select
using (public.has_membership(id));

create policy fazendas_insert_self
on public.fazendas
for insert
with check (created_by = auth.uid());

create policy fazendas_update_owner
on public.fazendas
for update
using (public.has_membership(id) and public.role_in_fazenda(id) = 'owner')
with check (public.has_membership(id) and public.role_in_fazenda(id) = 'owner');

create policy fazendas_delete_owner
on public.fazendas
for delete
using (public.has_membership(id) and public.role_in_fazenda(id) = 'owner');

-- =========================================================
-- user_fazendas: SOMENTE SELECT (sem insert/update/delete direto)
-- =========================================================
drop policy if exists user_fazendas_select_members on public.user_fazendas;
drop policy if exists user_fazendas_select_self on public.user_fazendas;
drop policy if exists user_fazendas_insert_self on public.user_fazendas;
drop policy if exists user_fazendas_update_owner on public.user_fazendas;

create policy user_fazendas_select_members
on public.user_fazendas
for select
using (
  user_id = auth.uid()
  or public.has_membership(fazenda_id)
);

-- NÃO crie policies para insert/update/delete aqui.
-- Membership deve acontecer via RPC security definer:
-- - create_fazenda(...)
-- - admin_set_member_role(...)
-- - accept_invite(...) (futuro)

-- =========================================================
-- State tables: pastos, lotes, animais
-- =========================================================
drop policy if exists pastos_select_by_membership on public.pastos;
drop policy if exists pastos_write_manager_owner on public.pastos;

create policy pastos_select_by_membership
on public.pastos
for select
using (public.has_membership(fazenda_id));

create policy pastos_write_manager_owner
on public.pastos
for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);

drop policy if exists lotes_select_by_membership on public.lotes;
drop policy if exists lotes_write_by_membership on public.lotes;

create policy lotes_select_by_membership
on public.lotes
for select
using (public.has_membership(fazenda_id));

-- Lotes: create/delete owner/manager; update também pode cowboy se você quiser.
-- Aqui deixo write para owner/manager por padrão.
create policy lotes_write_by_membership
on public.lotes
for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);

drop policy if exists animais_select_by_membership on public.animais;
drop policy if exists animais_write_by_membership on public.animais;
drop policy if exists animais_insert_manager on public.animais;

create policy animais_select_by_membership
on public.animais
for select
using (public.has_membership(fazenda_id));

-- Animais: no seu modelo a matriz permite cowboy criar/editar/deletar.
create policy animais_write_by_membership
on public.animais
for all
using (public.has_membership(fazenda_id))
with check (public.has_membership(fazenda_id));

-- =========================================================
-- Agenda (mutável): select by membership, write by membership
-- =========================================================
drop policy if exists agenda_select_by_membership on public.agenda_itens;
drop policy if exists agenda_write_by_membership on public.agenda_itens;

create policy agenda_select_by_membership
on public.agenda_itens
for select
using (public.has_membership(fazenda_id));

create policy agenda_write_by_membership
on public.agenda_itens
for all
using (public.has_membership(fazenda_id))
with check (public.has_membership(fazenda_id));

-- =========================================================
-- Eventos (append-only no negócio): select by membership; insert by membership
-- Update/Delete não são necessários no cliente (guardados por triggers).
-- =========================================================
drop policy if exists eventos_select_by_membership on public.eventos;
drop policy if exists eventos_insert_by_membership on public.eventos;

create policy eventos_select_by_membership
on public.eventos
for select
using (public.has_membership(fazenda_id));

create policy eventos_insert_by_membership
on public.eventos
for insert
with check (public.has_membership(fazenda_id));

-- =========================================================
-- Contrapartes: select by membership; write owner/manager
-- =========================================================
drop policy if exists contrapartes_select on public.contrapartes;
drop policy if exists contrapartes_write on public.contrapartes;

create policy contrapartes_select
on public.contrapartes
for select
using (public.has_membership(fazenda_id));

create policy contrapartes_write
on public.contrapartes
for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);

-- =========================================================
-- Protocolos sanitários: select by membership; write owner/manager
-- =========================================================
drop policy if exists protocolos_sanitarios_select on public.protocolos_sanitarios;
drop policy if exists protocolos_sanitarios_write on public.protocolos_sanitarios;

create policy protocolos_sanitarios_select
on public.protocolos_sanitarios
for select
using (public.has_membership(fazenda_id));

create policy protocolos_sanitarios_write
on public.protocolos_sanitarios
for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);

drop policy if exists protocolos_sanitarios_itens_select on public.protocolos_sanitarios_itens;
drop policy if exists protocolos_sanitarios_itens_write on public.protocolos_sanitarios_itens;

create policy protocolos_sanitarios_itens_select
on public.protocolos_sanitarios_itens
for select
using (public.has_membership(fazenda_id));

create policy protocolos_sanitarios_itens_write
on public.protocolos_sanitarios_itens
for all
using (public.has_membership(fazenda_id))
with check (
  public.has_membership(fazenda_id)
  and public.role_in_fazenda(fazenda_id) in ('owner','manager')
);

-- =========================================================
-- Eventos_* detalhes: select by membership; insert by membership
-- =========================================================
-- Sanitário
drop policy if exists eventos_sanitario_select on public.eventos_sanitario;
drop policy if exists eventos_sanitario_insert on public.eventos_sanitario;
create policy eventos_sanitario_select
on public.eventos_sanitario
for select using (public.has_membership(fazenda_id));
create policy eventos_sanitario_insert
on public.eventos_sanitario
for insert with check (public.has_membership(fazenda_id));

-- Pesagem
drop policy if exists eventos_pesagem_select on public.eventos_pesagem;
drop policy if exists eventos_pesagem_insert on public.eventos_pesagem;
create policy eventos_pesagem_select
on public.eventos_pesagem
for select using (public.has_membership(fazenda_id));
create policy eventos_pesagem_insert
on public.eventos_pesagem
for insert with check (public.has_membership(fazenda_id));

-- Nutrição
drop policy if exists eventos_nutricao_select on public.eventos_nutricao;
drop policy if exists eventos_nutricao_insert on public.eventos_nutricao;
create policy eventos_nutricao_select
on public.eventos_nutricao
for select using (public.has_membership(fazenda_id));
create policy eventos_nutricao_insert
on public.eventos_nutricao
for insert with check (public.has_membership(fazenda_id));

-- Movimentação
drop policy if exists eventos_movimentacao_select on public.eventos_movimentacao;
drop policy if exists eventos_movimentacao_insert on public.eventos_movimentacao;
create policy eventos_movimentacao_select
on public.eventos_movimentacao
for select using (public.has_membership(fazenda_id));
create policy eventos_movimentacao_insert
on public.eventos_movimentacao
for insert with check (public.has_membership(fazenda_id));

-- Reprodução
drop policy if exists eventos_reproducao_select on public.eventos_reproducao;
drop policy if exists eventos_reproducao_insert on public.eventos_reproducao;
create policy eventos_reproducao_select
on public.eventos_reproducao
for select using (public.has_membership(fazenda_id));
create policy eventos_reproducao_insert
on public.eventos_reproducao
for insert with check (public.has_membership(fazenda_id));

-- Financeiro
drop policy if exists eventos_financeiro_select on public.eventos_financeiro;
drop policy if exists eventos_financeiro_insert on public.eventos_financeiro;
create policy eventos_financeiro_select
on public.eventos_financeiro
for select using (public.has_membership(fazenda_id));
create policy eventos_financeiro_insert
on public.eventos_financeiro
for insert with check (public.has_membership(fazenda_id));
