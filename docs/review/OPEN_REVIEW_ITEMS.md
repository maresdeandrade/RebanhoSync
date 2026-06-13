# Open Review Items — RebanhoSync

Atualizado em: 2026-06-13
**Baseline Commit:** `797a692`

## Objetivo

Registrar apenas pendências abertas, acionáveis e ainda não resolvidas do RebanhoSync.

Este arquivo não é histórico longo.
Itens resolvidos devem sair deste documento e permanecer registrados apenas no relatório correspondente em `docs/review/`.

---

## Critérios de prioridade

| Prioridade | Critério |
|---|---|
| `P0` | Risco de erro operacional, segurança, RLS, perda de dados ou decisão crítica falsa. |
| `P1` | Risco de drift documental, duplicidade de fonte, regressão funcional ou alto consumo de contexto. |
| `P2` | Melhoria de manutenção, DX, testes, build, clareza ou suporte. |
| `P3` | Ajuste cosmético/documental não bloqueante. |

---

## Status

| Status | Significado |
|---|---|
| `ABERTO` | Ainda não iniciado. |
| `EM_ANDAMENTO` | Está sendo tratado. |
| `BLOQUEADO` | Depende de decisão, fonte ou validação. |
| `PRONTO_PARA_VALIDAR` | Patch feito, falta validação. |
| `FECHADO` | Resolvido; deve sair deste documento em próxima limpeza. |

---

# Pendências abertas

## P1 — Cursor incremental por `updated_at` para catalogos sanitarios v2

**Status:** `ABERTO`
**Área:** offline / sync / catalogos sanitarios v2
**Risco:** pull full fetch/merge crescer em custo e latencia conforme o catalogo tecnico sanitario v2 aumentar.

### Descrição

As Fases 12E2 e 12E3 seguiram o padrao local existente de pull com fetch completo e merge em Dexie para catalogos v2. Esse padrao preserva `deleted_at`, `updated_at`, metadata e tombstones, mas ainda nao possui cursor incremental por tabela baseado em `updated_at` com desempate por `id`.

### Regra de tratamento

Implementar em fase propria, sem misturar com push, UI, agenda ou protocolo:

- cursor por tabela/stores de catalogo;
- filtro remoto por `updated_at` sem ignorar tombstones;
- desempate por `id` se necessario;
- compatibilidade com catalogo global pull-only e dados de fazenda;
- testes cobrindo soft-delete incremental.

### Critério de aceite

- Pull incremental reduz fetch sem perder registros atualizados ou soft-deletados.
- Full fetch inicial continua possivel.
- Nenhum push, `queue_ops`, sync-batch ou UI e introduzido por esse ajuste.

---

## P1 — Cursor incremental por `updated_at` para Agenda Sanitaria v2

**Status:** `ABERTO`
**Área:** offline / sync / Agenda Sanitaria v2
**Risco:** pull full fetch/merge crescer em custo e latencia conforme a agenda operacional acumular historico e tombstones.

### Descrição

A Fase 12E4 seguiu o padrao local existente de pull por tabela com fetch completo e merge em Dexie para `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`. Esse padrao preserva `updated_at`, `deleted_at` quando existente, metadata e tombstones, mas ainda nao possui cursor incremental por tabela baseado em `updated_at`.

### Regra de tratamento

Implementar em fase propria de hardening, sem misturar com UI, protocolo, evento executado, estoque ou carencia ativa:

- cursor por tabela/stores `ops_*`;
- filtro remoto por `updated_at` sem ignorar tombstones;
- desempate por chave estavel quando necessario;
- conciliacao segura quando houver `queue_ops` pendente de closure;
- testes cobrindo soft-delete incremental e sucesso parcial.

### Critério de aceite

- Pull incremental reduz fetch sem perder registros atualizados ou soft-deletados.
- Full fetch inicial continua possivel.
- Nenhum push de `catalog_*`, `state_*`, agenda/animais v2, evento, estoque ou UI e introduzido por esse ajuste.

---

## P2 — Ruído residual em `stderr/stdout` de testes

**Status:** `ABERTO`
**Área:** testes / DX
**Risco:** ruído conhecido mascarar erro novo em execuções futuras.

### Descrição

Após o Gate de Higiene de Testes pós-Fase 6, os ruídos críticos foram reduzidos, mas ainda existem logs residuais fora do escopo do gate.

Ruídos conhecidos:

- Avisos de Dialog/act.
- Logs esperados de rollback/rejeição em testes de sync.
- Logs informativos do sync worker em testes offline.

### Regra de tratamento

Não suprimir `console.error`, `console.warn`, `console.log` ou `console.debug` globalmente sem assertiva local.

Logs esperados devem ser:

- controlados localmente no teste;
- assertados quando forem parte do comportamento;
- preservados quando validarem rollback/rejeição;
- removidos apenas se forem ruído sem valor de teste.

### Critério de aceite

- Testes corrigidos continuam verdes.
- Nenhum erro real é escondido globalmente.
- Logs esperados de rollback/rejeição continuam testados.
- `pnpm test -- --run` permanece verde.

---

## P2 — Warnings conhecidos de build

**Status:** `ABERTO`
**Área:** build / performance
**Risco:** baixo no produto atual; médio para manutenção se ignorado por muito tempo.

### Descrição

O build permanece verde, mas mantém warnings conhecidos:

- Browserslist/caniuse-lite desatualizado.
- Chunks grandes no Vite.

Esses avisos não bloqueiam a Fase 6 nem o Gate de Higiene de Testes.

### Ação recomendada

Tratar em tarefa própria de build/performance, sem misturar com sanitário, sync, RLS ou domínio comercial.

### Critério de aceite

- Warnings revisados em tarefa específica.
- Nenhuma alteração funcional indevida.
- Build permanece verde.
- Se houver split de chunks, validar navegação e carregamento das telas principais.

---

## P2 — Revisar avisos de Dialog/act em testes

**Status:** `ABERTO`
**Área:** testes / UI
**Risco:** baixo funcional; médio para confiabilidade de teste.

### Descrição

Persistem avisos relacionados a Dialog/act em alguns testes de UI.

Esses avisos não quebraram a suite global, mas indicam que algum efeito assíncrono ou interação pode não estar completamente aguardado.

### Ação recomendada

Tratar em gate futuro de higiene residual:

- identificar testes que emitem warning;
- usar `await user.click(...)`, `waitFor(...)` ou `findBy...` quando apropriado;
- evitar `act` manual sem necessidade;
- não suprimir warning globalmente.

### Critério de aceite

- Warnings reduzidos nos testes afetados.
- Sem alteração funcional.
- Suite global permanece verde.

---

# Itens fechados nesta etapa

## FECHADO — Baseline P1 sem escrita sanitária legada em agenda_itens

**Resultado:** fechado na Fase 12E2.

Consolidado:

- `scripts/codex/validate-supabase-baseline-functional.mjs` deixou de inserir agenda sanitária legada em `agenda_itens`.
- A etapa sanitária do baseline passou a validar evento/detalhe sanitário direto, preservando `eventos` + `eventos_sanitario` como superfície factual.
- Teste de contrato impede regressão para escrita legada sanitária em `agenda_itens`.
- O bloqueio introduzido na Fase 12C permanece preservado.

## FECHADO — Fase 7 Preparação de PR + Auditoria de Regressão

**Resultado:** fechado no `docs/review/RESULTADO_FASE_7_PREPARACAO_PR.md`.

Consolidado:

- suite global verde;
- lint verde;
- build verde;
- continuidade documental reconciliada;
- pendências residuais registradas;
- nenhuma feature nova criada.

---

## FECHADO — Formalização Contrato Mínimo Fallback Legado Sanitário

**Resultado:** fechado no `docs/review/RESULTADO_FASE_8_FORMALIZACAO_FALLBACK_SANITARIO.md`.

Consolidado:

- Shape mínimo definido: `family_code` e `item_code` obrigatórios no payload.
- Adapter interno `tryLegacyCompatibleCompute` implementado.
- Testes cobrindo campo ausente implementados.
- Nenhuma alteração indevida em materialização sanitária.

---

# Checklist antes de PR/merge

Executar:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
pnpm test -- --run
pnpm run lint
pnpm run build
```

Se houver alteração posterior em Supabase, sync-batch, RLS, RPC, schema ou migration, executar também:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

# Restrições permanentes

Não avançar para:

- venda;
- abate;
- DRE;
- ROI;
- custo por arroba;
- motor comercial avançado;
- aptidão automática para venda;
- aptidão automática para abate;
- carência liberatória;
- financeiro automático.

Preservar:

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico append-only.
state_* = read model / estado atual.
Protocolo = regra/configuração, não execução.
Snapshot = evidência histórica congelada.
Financeiro = ledger explícito separado.
Sociedade = vínculo patrimonial.
Classificação = leitura operacional, não autorização crítica.
Tags/sinais/insights = auxiliares, nunca fonte primária.
```
