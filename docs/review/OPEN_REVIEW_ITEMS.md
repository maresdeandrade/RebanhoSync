# Pendências abertas — RebanhoSync

Atualizado em: 2026-08-05

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

## P1 — Próximo incremento reprodutivo

Status: `ABERTO`

Implementar parto e encerramento da gestação como novo fato histórico, reconstruindo a projeção atual sem reabrir a Fase 12. Aborto/perda gestacional, correção append-only e round-trip remoto permanecem incrementos posteriores.

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
