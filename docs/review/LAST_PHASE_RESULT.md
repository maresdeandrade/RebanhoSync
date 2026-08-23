# Resultado funcional mais recente — Hardening transversal / PR #96

Atualizado em: 2026-08-23
Baseline integrado: `main@4e208ba090daa652f2735c94403317ed4ecbf045`
Feature head: `fcc977a9d6087ebbf76364e400bf03a9dd686bac`
PR: [#96](https://github.com/maresdeandrade/RebanhoSync/pull/96)
Decisão: **integrado**

## Resultado

O ciclo das Fases 1–6 da auditoria transversal foi integrado em um pacote único de hardening. Foram corrigidos isolamento local cross-farm, occupancy pelo read model canônico, uso operacional do contrato societário vigente, reconciliação mixed-result por operação, retry idempotente, sucesso parcial sanitário, locks de submit, acessibilidade dos dialogs e consistência dos gates de importação/lint.

O contrato factual e offline-first permaneceu preservado conforme o [mapa operacional canônico](../architecture/OPERATIONAL_FLOWS.md), com isolamento por `fazenda_id` e auditabilidade.

## Fechamento de sync

O hardening preservou resultado por operação, sucesso parcial, terminalidade, rollback e identidade de retry conforme o [mapa operacional canônico](../architecture/OPERATIONAL_FLOWS.md). Este resultado registra a evidência do fechamento, sem redefinir o contrato.

O último defeito funcional de CI foi corrigido em `7a551a325d9b631c02f43f6e5b487dde10b8e71d`. O cleanup de Supabase rastreado foi corrigido em `3a0cd1e24ef7209b14d1045992ef904e9f973942`. O arquivo `.agents/rules/GRAPHIFY_USAGE.md` foi excluído do pacote antes do merge por `fcc977a9d6087ebbf76364e400bf03a9dd686bac`.

## Banco e ambientes

A branch acumulada versionou `supabase/config.toml`, `supabase/.gitignore`, alterações do `sync-batch` e a migration `20260821000000_fix_pgcrypto_digest_search_path.sql`. O baseline funcional utilizou somente Supabase local descartável. Nenhuma migration, RLS, RPC ou Edge Function foi aplicada ou publicada em staging/produção durante o fechamento e merge do PR #96.

## Validação

- CI do PR no feature head: lint, 2.668 testes em 354 arquivos, build, gates documentais e repository-clean aprovados;
- pós-merge local em `main`: lint, build e 5/5 testes focados de reprodução/sync aprovados;
- CI oficial de `main`: [run 32619923698](https://github.com/maresdeandrade/RebanhoSync/actions/runs/32619923698), com 2.668/2.668 testes, lint, build, cleanup Supabase e repository-clean aprovados;
- merge commit: `4e208ba090daa652f2735c94403317ed4ecbf045`.

## Impacto arquitetural

Todo fechamento de fase deve registrar:

- mapa operacional consultado;
- fluxos afetados;
- invariantes alteradas;
- testes contratuais adicionados ou alterados;
- necessidade de atualização do [OPERATIONAL_FLOWS.md](../architecture/OPERATIONAL_FLOWS.md).

Uma fase com mudança arquitetural conhecida não pode ser declarada finalizada sem esse registro.

## Próximo estado

A Fase 17 — Decisão Assistida — permanece preparada para abertura formal e não é considerada iniciada por este hardening. O rollout sanitário continua separado e não foi autorizado.

Detalhes no [plano ativo](./ACTIVE_PHASE_PLAN.md), no [handoff atual](./CURRENT_PHASE_HANDOFF.md) e no [estado macro do projeto](../context/PROJECT_STATUS.md).
