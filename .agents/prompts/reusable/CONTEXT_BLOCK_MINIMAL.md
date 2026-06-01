# Context Block Minimal — RebanhoSync

Use este bloco quando precisar fornecer contexto mínimo para uma IA sem carregar documentação extensa.

## Projeto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

Stack principal:

- React/TypeScript
- Dexie/IndexedDB
- Supabase/Postgres/Auth/RLS
- sync local-remoto por gestos/transações

## Regras centrais

- Agenda = intenção/tarefa futura. Não é histórico.
- Evento = fato executado. Histórico vem de `eventos` + detail tables.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração. Não é execução.
- Tags, sinais e insights = auxiliares. Nunca fonte primária nem regra crítica.
- Carência, peso atual confiável, venda/abate e aptidão operacional exigem fonte técnica explícita.
- Preservar offline-first, RLS, multi-tenant e isolamento por `fazenda_id`.
- Não misturar UI com regra de negócio.
- Preferir patch pequeno, reversível, idempotente e testável.

## Contexto sob demanda

Carregue apenas o necessário:

- UX/UI: `docs/ux/*`
- Sanitário: `docs/domain/SANITARIO.md`
- Sync/offline: `docs/technical/OFFLINE_SYNC.md`
- RLS/Supabase: `docs/technical/SUPABASE_RLS.md`
- Fonte de verdade: `docs/context/SOURCE_OF_TRUTH.md`
- Validação: `.agents/rules/rtk.md`

Não usar `docs/archive/**` como fonte operacional.