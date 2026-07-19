# Open Review Items — RebanhoSync

Atualizado em: 2026-07-18
**Baseline Commit (commit-base do worktree):** `dbe37a8`
**Baseline funcional documentado:** `fcf42bc`

A validação passou no worktree local baseado em dbe37a8. O commit funcional que contém a implementação validada no worktree é fcf42bc. evidenceReference: validação local executada com Vitest, ESLint e build Vite em 2026-07-18. A evidência textual local não garante existência, integridade ou disponibilidade futura de arquivo remoto.

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
| `FECHADO` | Resolvido; não deve permanecer neste documento. Registrar no resultado/handoff ou arquivar o relatório correspondente. |

---

# Pendências abertas

Sem P0/P1 aberto de runtime após a validação funcional local da execução e Conformidade Sanitária v2.

Observacao 12G: o importador controlado esta em `scripts/codex/import-sanitario-protocols-v2.mjs` e usa somente `docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`. Apply real executado localmente com 33 `create`, 0 `update`, 0 `skip`, 16 `reject`; dry-run pos-apply confirmou 0 `create`, 0 `update`, 33 `skip`, 16 `reject`. Os 16 ProductClassGroup members continuam bloqueados por `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.

Observação 12H/12I: a leitura read-only dos Protocolos Sanitários v2 usa o catálogo local/offline e permanece separada da execução operacional.

Observação pós-12I: agenda sanitária pode ser executada somente com confirmação explícita. O evento resultante é o único fato histórico; estoque e carência continuam condicionados a evento, produto real e regra explícita. Não há `queue_ops` paralelo ou liberação operacional.

Observação Conformidade v2: read model derivado/somente leitura validado por animal, lote, protocolo e item. Evidência `external_documented` sem referência vinculada não comprova regra crítica; execução parcial não se generaliza e retry/reabertura não duplicam efeitos locais. Retry/replay não duplicou evento, movimento de estoque, baixa de lote, carência ou vínculo agenda-evento.

Observação UI catálogo v2: `/protocolos-sanitarios/catalogo-v2` permite visualizar o catálogo local/offline em modo read-only. A tela usa `readLocalSanitaryProtocolCatalogV2` e não lê JSON 12F10 em runtime.

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
