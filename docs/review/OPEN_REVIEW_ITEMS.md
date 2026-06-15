# Open Review Items — RebanhoSync

Atualizado em: 2026-06-14
**Baseline Commit:** `3853b80`

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

Sem P0/P1 aberto de runtime apos a Fase 12F3.

Observacao 12F3: os bloqueios P0 documentados em `docs/review/PLANO_FASE_12F3_VALIDACAO_PAYLOADS_SCHEMA_REAL.md` sao bloqueios de import candidato, nao incidentes abertos de runtime. Eles impedem seed/import bruto dos payloads 12F2 ate a fase 12F4 adaptar ou rejeitar formalmente os registros incompatíveis.

Observacao tecnica: `sanitario_produto_fontes_v2` permanece em full fetch/merge porque nao possui `updated_at` no contrato implementado. Reavaliar apenas se futura migration/contrato adicionar timestamp de atualizacao a essa tabela.

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

## FECHADO — Cursor incremental por `updated_at` para catalogos sanitarios v2

**Resultado:** fechado na Fase 12E5.

Consolidado:

- `sync_pull_cursors` guarda cursor por tabela/store/escopo.
- ProductClass v2 e catalogo tecnico sanitario v2 com `updated_at` usam pull incremental.
- Pull global continua separado de tenant/fazenda e nao depende de `fazenda_id`.
- Tombstones com `deleted_at` continuam preservados.
- `sanitario_produto_fontes_v2` segue full fetch/merge por nao possuir `updated_at` no contrato implementado.
- Nenhum push de catalogo, `queue_ops`, sync-batch ou UI foi criado.

## FECHADO — Cursor incremental por `updated_at` para Agenda Sanitaria v2

**Resultado:** fechado na Fase 12E5.

Consolidado:

- Agenda v2, agenda_animais v2 e closures v2 usam cursor por tabela/fazenda.
- Full fetch inicial continua possivel.
- Pull incremental preserva `updated_at`, `deleted_at` quando existente e metadata por merge/upsert.
- Retry/replay, sucesso parcial e conflito de closures foram reforcados por testes.
- Agenda v2 e agenda_animais v2 permanecem sem push.

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
