Abaixo está o plano **validado e reescrito** já com os ajustes necessários para aprovação (segurança + multi-fazenda + invite-only/híbrido), evitando armadilhas que já apareceram no projeto (campos server-managed, recursão em RLS, permissões indevidas).

---

# Onboarding Fix — Convites + Criação de Fazendas (Invite-First + Multi-Farm)

## Objetivo

Corrigir o onboarding para que **signup não crie fazenda automaticamente**, suportando:

* **Invite-first**: usuário novo pode existir sem pertencer a nenhuma fazenda.
* **Multi-farm**: um **owner** pode criar **mais de uma fazenda**.
* **Bootstrap controlado**: apenas usuários explicitamente autorizados conseguem criar a **primeira fazenda**.
* **Segurança**: criação de membership **somente via RPC security definer** (sem policies de INSERT em `user_fazendas`).

---

## Problema Identificado

O fluxo atual cria fazenda automaticamente no signup:

1. `/signup`
2. cria conta
3. chama `create_fazenda`
4. usuário vira owner de uma fazenda “vazia”
5. vai para `/home`

**Impacto**: qualquer signup vira owner → conflita com invite-only e polui tenant.

---

## Solução Aprovada (Modelo B Híbrido)

**Usuário pode criar fazenda somente se:**

1. já for **owner em qualquer fazenda**, **OU**
2. tiver `user_profiles.can_create_farm = true` (bootstrap explícito)

Assim:

* Signup aleatório → **não cria fazenda** e não vê nada.
* Convidado → cria conta / login com o email do convite → aceita → entra na fazenda.
* Owner existente → pode criar novas fazendas (multi-farm).
* Primeiro owner (bootstrap) → liberado via flag.

---

# Mudanças de Backend (SQL / Migrations)

## Migration 0010 — `can_create_farm` + função helper

**Arquivo:** `supabase/migrations/0010_add_can_create_farm.sql`

### O que faz

* Adiciona `can_create_farm` em `public.user_profiles` (default false)
* Cria função `public.can_create_farm()` que aplica a regra híbrida

### SQL (validado)

```sql
-- 0010_add_can_create_farm.sql
-- =========================================================
-- Onboarding gating: quem pode criar fazendas
-- Regra: (é owner em qualquer fazenda) OR (profiles.can_create_farm = true)
-- =========================================================

alter table public.user_profiles
  add column if not exists can_create_farm boolean not null default false;

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
```

**Notas de validação**

* `row_security=off` evita problemas de RLS e possíveis recursões.
* A função só consulta dados do próprio `auth.uid()` → não vaza dados de terceiros.

---

## Migration 0011 — Ajuste do RPC `create_fazenda` com gating + UPSERT seguro

**Arquivo:** `supabase/migrations/0011_fix_create_fazenda_permissions.sql`

### Ajustes importantes feitos aqui

* **Remove** insert “automático” de fazenda no signup (fica no frontend).
* `create_fazenda` passa a validar `public.can_create_farm()`.
* Insere apenas campos necessários; **não força** `server_received_at`, `deleted_at` etc.
* UPSERT em `user_settings` para evitar race com trigger.
* Opcionalmente: desliga `can_create_farm` após bootstrap (se quiser).

### SQL (validado)

```sql
-- 0011_fix_create_fazenda_permissions.sql
-- =========================================================
-- create_fazenda com gating híbrido + UPSERT robusto
-- =========================================================

create or replace function public.create_fazenda(
  _nome text,
  _codigo text default null,
  _municipio text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  _user_id uuid;
  _fazenda_id uuid;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Gating híbrido: owner existente OU can_create_farm=true
  if not public.can_create_farm() then
    raise exception 'Forbidden - você não tem permissão para criar fazendas';
  end if;

  -- 1) Criar fazenda
  insert into public.fazendas (
    nome,
    codigo,
    municipio,
    created_by,
    client_id,
    client_op_id,
    client_recorded_at
  )
  values (
    _nome,
    _codigo,
    _municipio,
    _user_id,
    'server',
    gen_random_uuid(),
    now()
  )
  returning id into _fazenda_id;

  -- 2) Criar membership owner
  insert into public.user_fazendas (
    user_id,
    fazenda_id,
    role,
    is_primary,
    invited_by,
    accepted_at,
    client_id,
    client_op_id,
    client_recorded_at
  )
  values (
    _user_id,
    _fazenda_id,
    'owner',
    true,
    _user_id,
    now(),
    'server',
    gen_random_uuid(),
    now()
  )
  on conflict (user_id, fazenda_id) do update
    set role = excluded.role,
        is_primary = excluded.is_primary,
        invited_by = excluded.invited_by,
        accepted_at = excluded.accepted_at,
        deleted_at = null,
        updated_at = now();

  -- 3) UPSERT active farm
  insert into public.user_settings (user_id, active_fazenda_id)
  values (_user_id, _fazenda_id)
  on conflict (user_id) do update
    set active_fazenda_id = excluded.active_fazenda_id,
        deleted_at = null,
        updated_at = now();

  -- 4) (Opcional) Desarmar bootstrap depois da 1ª criação
  -- update public.user_profiles
  -- set can_create_farm = false, updated_at = now()
  -- where user_id = _user_id;

  return _fazenda_id;
end;
$$;

grant execute on function public.create_fazenda(text, text, text) to authenticated;
```

---

# Mudanças de Frontend

## 1) SignUp: remover auto-criação de fazenda

**Arquivo:** `src/pages/SignUp.tsx`

* Remover chamada automática ao `create_fazenda`.
* Após signup:

  * Se `authData.session` existe → redireciona para `/select-fazenda` (não `/home`).
  * Se `authData.session` não existe (Confirm Email ON) → mostrar mensagem “confirme seu email”.

✅ Resultado: signup não cria fazenda e não dá “owner acidental”.

---

## 2) SelectFazenda: estado “Sem fazendas” + botões essenciais

**Arquivo:** `src/pages/SelectFazenda.tsx`

### Ajustes

* Se `fazendas.length === 0`:

  * Mostrar mensagem “Você ainda não tem fazendas. Aceite um convite…”
  * Mostrar botão **Sair**
  * Se `can_create_farm()` retornar true → mostrar **Criar nova fazenda**
* Sempre mostrar:

  * **Sair (logout)**
  * (Se já está em AppShell) botão **Trocar fazenda** em menu/Perfil

### Como checar can_create_farm (correto)

* Buscar via `useEffect`:

  * `supabase.rpc('can_create_farm')`

---

## 3) Criar Fazenda: tela simples (ou dialog)

**Novo arquivo recomendado:** `src/pages/CriarFazenda.tsx`

* Form: nome (+ opcionais código/município)
* `supabase.rpc('create_fazenda', { _nome, _codigo, _municipio })`
* On success:

  * chamar `setActiveFarm(fazendaId)` (política já existente no `useAuth`)
  * redirect `/home`

---

## 4) AcceptInvite UX: mostrar “convite é para X” + ajuda para mismatch

**Arquivo:** `src/pages/AcceptInvite.tsx`

* Mostrar email/phone do convite.
* Se usuário logado com email diferente → CTA para **Logout** e instrução “entre com o email correto”.
* (Opcional) Se quiser reduzir fricção: permitir “trocar conta” com botão logout.

> Importante: **a lógica NÃO está invertida** — o convidado primeiro cria conta/loga **com o email do convite**, depois aceita. O que estava faltando era UX clara.

---

# Fluxos após mudança

## Novo usuário sem convite

1. signup
2. vai para `/select-fazenda`
3. vê: “Sem fazendas. Aceite um convite.”
4. **não vê** “Criar fazenda” (salvo bootstrap liberado)

## Usuário convidado

1. abre `/invites/:token`
2. vê “Convite para: maria@…”
3. faz login/signup com **maria@…**
4. aceita convite
5. vai para `/home` com `active_fazenda_id` setado (RPC já faz isso se vazio)

## Owner multi-fazenda

1. já é owner em alguma fazenda
2. em `/select-fazenda` vê “Criar nova fazenda”
3. cria e entra na nova fazenda

## Bootstrap do 1º owner

* Admin set: `update user_profiles set can_create_farm=true where user_id='...'`
* Usuário cria fazenda
* (Opcional) flag é desligada; usuário continua criando porque agora é owner.

---

# Validações de Segurança

* ✅ `user_fazendas` continua **sem policy de INSERT/UPDATE/DELETE** (somente RPCs security definer)
* ✅ `create_fazenda` bloqueado por regra híbrida
* ✅ convites continuam exigindo identidade (email/phone)
* ✅ usuário sem membership não vê dados de fazenda nenhuma (RLS)

---

# Plano de Testes (DoD)

## DB

* Usuário novo sem flag:

  * `select public.can_create_farm()` → false
  * `rpc create_fazenda` → erro Forbidden
* Owner existente:

  * `can_create_farm()` → true
  * `create_fazenda` → cria nova fazenda + membership owner + ativa
* Bootstrap:

  * set `can_create_farm=true`
  * `create_fazenda` → ok

## App

* Signup novo → `/select-fazenda` com estado “Sem fazendas”
* Invite:

  * convite para email A
  * login com email B → UI avisa mismatch
  * login com email A → aceita → entra

---

# Próximos Passos

1. Aplicar migrations 0010 e 0011
2. Atualizar `SignUp.tsx`
3. Atualizar `SelectFazenda.tsx` (estado vazio + checagem can_create_farm + botões logout/criar)
4. Criar `CriarFazenda.tsx` (ou dialog)
5. Melhorar `AcceptInvite.tsx` (mismatch UX)
6. Rodar testes manuais + `pnpm run build` + `pnpm exec tsc --noEmit`

---

Se você quiser, eu já adapto o plano para **combinar com as migrations existentes** (numeração real do seu repo) e incluir exatamente **quais arquivos/rotas** entram no `App.tsx` e no menu (Trocar Fazenda / Sair).
