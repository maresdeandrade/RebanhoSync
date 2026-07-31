# Handoff atual — Fase 12 / Sync Sanitário v2

Atualizado em: 2026-07-30
Baseline funcional atual: `2006286`
Status: **Fase 12 ativa; rollout não autorizado**
Próximo incremento: **3.8 — Push/pull de histórico sanitário externo/documental**

## Resumo executivo

A Conformidade Sanitária v2 foi validada localmente e documentada como read model derivado/somente leitura. A fundação remota, o `sync-batch`, o typecheck Deno, o worker/reconcile e o cutover local Dexie do Sync Sanitário v2 foram implementados sob gates desligados.

As validações locais estão completas no baseline registrado pelos commits recentes. A validação E2E remota é parcial: criação de agenda, replay e substituição de animais foram aprovados, mas o cenário de conflito `expected_revision` fica retido no caminho Edge Function/PostgREST/gateway até timeout, embora o PostgreSQL produza imediatamente o erro esperado.

Decisão atual: desenvolver o item 3.8 sob gate fail-closed, sem rollout e sem atribuir ao SQL uma causa não comprovada.

## Fontes autoritativas

- plano corrente: [ACTIVE_PHASE_PLAN.md](./ACTIVE_PHASE_PLAN.md);
- decisão permanente: [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md);
- estado macro: [ROADMAP.md](../product/ROADMAP.md);
- contratos de domínio: [SANITARIO.md](../domain/SANITARIO.md) e [SOURCE_OF_TRUTH.md](../context/SOURCE_OF_TRUTH.md);
- contratos técnicos: [OFFLINE_SYNC.md](../technical/OFFLINE_SYNC.md) e [SUPABASE_RLS.md](../technical/SUPABASE_RLS.md).

Planos encerrados e evidências em `docs/review/evidence/` permanecem históricos e não substituem este handoff.

## Estado consolidado da Fase 12

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync Remoto Sanitário v2 — **em andamento**.

| Subitem | Estado |
|---|---|
| 3.1 Diagnóstico schema local/remoto | Concluído |
| 3.2 Migrations necessárias | Fundação concluída |
| 3.3 RLS/multi-tenant/fazenda | Concluído tecnicamente |
| 3.4 Agenda sanitária | Implementada; E2E remoto parcial |
| 3.5 Agenda animais | Implementada; E2E remoto parcial |
| 3.6 Evento sanitário | Implementado; E2E remoto pendente |
| 3.7 Detalhe sanitário | Implementado; E2E remoto pendente |
| 3.8 Histórico externo/documental | Próximo incremento |
| 3.9 Movimento de estoque sanitário | Pendente |
| 3.10 Retry/replay/idempotência | Implementado; validação remota parcial |
| 3.11 Sucesso parcial | Validado localmente; E2E remoto pendente |
| 3.12 Conflito multi-dispositivo | Código e SQL validados; plataforma bloqueada |
| 3.13 Recalcular Conformidade após pull | Pendente de integração explícita |

Nem o item 3 nem a Fase 12 estão concluídos.

## Componentes implementados

### Fundação remota

- migration expand do Sync Sanitário v2;
- `revision` e `expected_revision`;
- `client_op_id`, `client_tx_id` e `domain_op_id`;
- vínculo Evento → Agenda Sanitária v2;
- relação append-only Evento–Animal;
- ledger de idempotência;
- gate autoritativo fail-closed;
- comandos `create_agenda`, `replace_agenda_animals`, `apply_factual_core` e `close_agenda`.

### Transporte e processamento

- `sync-batch` v19;
- typecheck Deno limpo;
- worker com resultados canônicos `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- retry/replay sem assumir `23505` genérico como sucesso;
- sucesso parcial por operação;
- fila compartilhada existente, sem `queue_ops` paralelo;
- pull/reconcile não destrutivo.

### Cutover local

- Dexie v28;
- store factual `event_eventos_animais`;
- manifesto idempotente com estados `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- preservação das filas de outros domínios;
- feature flag local fail-closed e mantida em `false`.

## Contratos de domínio preservados

- Agenda é intenção/tarefa futura.
- Evento é fato histórico executado.
- Closure administrativa encerra a intenção; não prova execução.
- `state_*` é estado atual/read model.
- Protocolo é regra/configuração.
- Conformidade é leitura derivada e não fonte primária.
- Agenda concluída sem Evento não comprova execução.
- Cancelamento e dispensa não criam fato sanitário.
- Execução parcial vale apenas para animais vinculados ao Evento.
- `external_declared` não comprova regra crítica.
- `external_documented` exige referência de evidência para comprovação crítica.
- Estoque depende de Evento factual.
- Carência depende de produto executado e fonte técnica explícita.
- Tags, sinais, insights e status de sync não são fontes críticas.
- Nenhuma resposta de sync libera venda, abate, leite ou aptidão operacional.

## Ambiente e rollout

| Item | Estado confirmado |
|---|---|
| Supabase staging | `zqloazqzhwauamcejmuz` |
| Produção | Não alterada |
| Gate sanitário remoto | Desligado |
| Feature flag local | `false` |
| Rollout para usuários | Não autorizado |
| Fixtures sintéticas residuais | Zero |

O staging não é produção. Este documento não registra credenciais, secrets, tokens ou dados pessoais de fixtures.

## Risco externo atual

Código: `SANITARIO_V2_E2E_PLATFORM_BLOCKED`

Fatos confirmados:

- criação de Agenda remota aprovada;
- replay aprovado;
- substituição de animais aprovada;
- revisão chegou corretamente a `1`;
- PostgreSQL produz imediatamente `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`;
- no caminho Edge Function/PostgREST/gateway, a resposta não retorna antes do timeout;
- o worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Inferência vedada: não há evidência atual para atribuir defeito ao SQL ou à regra de domínio.

Conduta:

- não aumentar timeout;
- não alterar RPC sem nova evidência;
- manter rollout bloqueado;
- continuar desenvolvimento sob gate remoto desligado e feature flag local `false`.

IDs e rastros detalhados da execução remota devem permanecer em relatório técnico/evidência específica, sem reprodução nas fontes resumidas.

## Validações registradas nos incrementos recentes

- migration expand e sentinelas SQL;
- rebaseline completo do staging;
- baseline funcional Supabase;
- testes focados do `sync-batch`;
- `deno check` e `deno fmt --check`;
- testes focados do worker/reconcile;
- testes do cutover e pull;
- suíte local completa, lint e build nos respectivos incrementos;
- limpeza remota com zero fixtures sintéticas residuais.

Este handoff registra resultados já executados; não afirma que essas validações foram reexecutadas por uma alteração puramente documental.

## Próximo incremento oficial

Implementar 3.8 — push/pull de histórico sanitário `external_declared` e `external_documented`:

- preservar origem e evidência;
- exigir referência documental para comprovação crítica;
- usar fila compartilhada, UUID e idempotência;
- respeitar tenant/`fazenda_id`;
- usar pull não destrutivo;
- tratar replay, conflito e sucesso parcial;
- recalcular Conformidade conservadoramente após pull;
- não criar Agenda, Evento executado, estoque, carência ou liberação operacional.

Sequência posterior:

```txt
3.9 movimento de estoque sanitário
→ 3.13 recálculo explícito da Conformidade após pull
→ reexecutar E2Es remotos quando a plataforma estiver estável
→ 4 produto técnico e fonte por campo
→ 5 correção append-only
→ 6 carência operacional
→ 7 fechamento formal da Fase 12
```
