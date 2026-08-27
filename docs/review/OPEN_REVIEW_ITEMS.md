# Pendências abertas — RebanhoSync

Atualizado em: 2026-08-26

## Objetivo

Registrar apenas itens abertos e acionáveis. Histórico concluído permanece nos relatórios e evidências.

## P0 — Rollout do Sync Sanitário v2 bloqueado

Status: `BLOQUEADO`
Código: `SANITARIO_V2_E2E_PLATFORM_BLOCKED`

Fatos:

- criação de Agenda, replay e substituição de animais aprovados;
- revisão remota chegou a `1`;
- PostgreSQL produz imediatamente `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`;
- a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout;
- worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Conduta:

- manter gate remoto desligado;
- manter feature flag local `false`;
- não autorizar rollout;
- não aumentar timeout nem alterar RPC sem nova evidência;
- reexecutar E2Es remotos quando a plataforma estiver estável.

Não há evidência atual de defeito no SQL ou na regra de domínio.

## P1 — Validação Remota E2E de Movimentação (Gate de Entrada F22C)

Status: `PENDENTE_F22C`
Código: `B4_REMOTE_E2E_PENDING`

Fatos:

- inclusão canônica de `eventos_movimentacao` em `STANDARD_EVENT_DETAIL_REMOTE_TABLES` implementada e testada com sucesso no pull local (`AUTOMATED_CONVERGENCE_VERIFIED`);
- não bloqueia a Fase 21 (Inteligência Operacional v2);
- E2E remoto multi-device (Device A -> Push -> Supabase Staging -> Device B -> Pull -> Integridade/Isolamento) permanece como gate de entrada obrigatório para a Fase 22C.


## P1 — Promoção de Migrations e Backoffice para Produção

Status: `PENDENTE_PRODUCAO`

Fatos:

- staging alinhado com 42 migrations aplicadas (`42 local == 42 staging`), incluindo privilégios de tabelas autenticadas, SuperAdmin e financeiro determinístico;
- ambiente de produção permanece 100% inalterado. Promoção exige janela formal de release na Fase 24.

## P1 — Trilha C: Hardening de Banco e Advisor (C2–C7)

Status: `PENDENTE_TRILHA_C`

Fatos:

- C0 (inventário autoritativo de 34 funções `SECURITY DEFINER`) e C1 (hardening de privilégios `EXECUTE`, isolamento tenant de `get_user_emails` e resolução de search_path blocker em `seed_default_finance_categories`) concluídos com sucesso e validados localmente (migrations `20260827100000`, `20260827110000`, `20260827120000`);
- C2–C7 (search_path mutable global, auth_rls_initplan, multiple_permissive_policies, FK indexes, workload, unused indexes) permanecem pendentes como subtrilhas de infraestrutura técnica;
- Não bloqueia a abertura da Fase 21 — Inteligência Operacional v2.


## P2 — Ruído residual em testes

Status: `ABERTO`

Há logs esperados de rollback/rejeição e avisos de Dialog/`act` em testes. Não suprimir logs globalmente; controlar e assertar localmente quando fizerem parte do comportamento.

Critério de aceite:

- nenhum erro real ocultado;
- warnings reduzidos nos testes afetados;
- suíte permanece verde.

## P2 — Warnings conhecidos de build

Status: `ABERTO`

Browserslist/caniuse-lite desatualizado e chunks grandes do Vite permanecem como higiene de build/performance. Tratar em tarefa própria, sem misturar com Sanitário, sync ou RLS.

## Checklist antes de merge

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
pnpm test
pnpm run lint
pnpm run build
```

Se houver alteração em Supabase, `sync-batch`, RLS, RPC, schema ou migration:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
