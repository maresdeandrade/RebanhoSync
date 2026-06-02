# Open Review Items — RebanhoSync

Atualizado em: 2026-06-02  
**Baseline Commit:** `32d7779`

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
| `FECHADO` | Resolvido; deve sair deste arquivo em próxima limpeza. |

---

# Pendências abertas

## P1 — Reconciliar continuidade final da Fase 7 antes de PR/merge

**Status:** `ABERTO`  
**Área:** documentação / preparação de PR  
**Risco:** PR com documentação divergente entre resultado, handoff e pendências abertas.

### Descrição

O diagnóstico pré-patch da Fase 7 identificou que a continuidade está funcional, mas ainda precisa de reconciliação final antes de PR/merge.

Pontos confirmados:

- `LAST_PHASE_RESULT.md` existe.
- `CURRENT_PHASE_HANDOFF.md` existe.
- `OPEN_REVIEW_ITEMS.md` existe.
- `PROJECT_STATUS.md` existe.
- `.agents/prompts/codex/SELF_UPDATE_CONTINUITY.md` existe.
- Suite global passou: `259` arquivos / `1743` testes.
- Worktree está suja.
- Nada staged.
- Nenhum arquivo untracked no status atual.
- Branch atual: `main`.

### Ações esperadas

- Corrigir `git diff --check`.
- Garantir que `LAST_PHASE_RESULT.md` não aponte para pendências inexistentes.
- Garantir que `OPEN_REVIEW_ITEMS.md` liste apenas pendências reais.
- Atualizar `CURRENT_PHASE_HANDOFF.md` como próxima etapa de PR/merge, não como nova feature.
- Reexecutar `lint` e `build` antes de PR/merge.

### Critério de aceite

- `git diff --check` passa.
- `pnpm test -- --run` passa.
- `pnpm run lint` passa.
- `pnpm run build` passa.
- `LAST_PHASE_RESULT.md`, `CURRENT_PHASE_HANDOFF.md`, `OPEN_REVIEW_ITEMS.md` e `PROJECT_STATUS.md` estão coerentes entre si.
- Nenhuma nova feature foi criada.

---

## P1 — Evitar PR/commit direto em `main`

**Status:** `ABERTO`  
**Área:** governança / Git  
**Risco:** alteração direta em `main` sem isolamento de revisão.

### Descrição

O diagnóstico da Fase 7 identificou que o trabalho está sendo feito diretamente na branch:

```txt
main
```

Para preparação de PR, o ideal é criar uma branch específica antes do commit.

### Ação recomendada

Criar branch de fechamento do gate:

```bash
git switch -c codex/fecha-fase-6-suite-global
```

Ou, se já houver política local de branch:

```bash
git switch -c codex/fase-7-preparacao-pr
```

### Critério de aceite

- Patch final está em branch dedicada.
- `git status --short --untracked-files=all` revisado.
- PR/merge preparado fora da `main`.

---

## P2 — Ruído residual em `stderr/stdout` de testes

**Status:** `ABERTO`  
**Área:** testes / DX  
**Risco:** ruído conhecido mascarar erro novo em execuções futuras.

### Descrição

Após o Gate de Higiene de Testes pós-Fase 6, os ruídos críticos foram reduzidos, mas ainda existem logs residuais fora do escopo do gate.

Ruídos conhecidos:

- React Router Future Flag warnings em outros wrappers.
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

## P2 — Formalizar contrato mínimo do fallback legado sanitário

**Status:** `ABERTO`  
**Área:** sanitário / scheduler / contrato legado  
**Risco:** fallback legado depender de shape implícito e voltar a gerar erro ruidoso ou comportamento parcial.

### Descrição

O Gate de Higiene de Testes corrigiu a fixture de `nextOccurrenceService.test.ts`, mas o fallback legado sanitário ainda depende de um shape mínimo esperado pelo scheduler.

O patch atual estabilizou o teste sem alterar comportamento funcional.

### Ação recomendada

Formalizar o shape mínimo aceito pelo fallback legado do scheduler sanitário.

Pontos a validar:

- campos mínimos obrigatórios;
- comportamento quando campo obrigatório está ausente;
- retorno parcial/bloqueado em vez de erro não controlado;
- compatibilidade com legado;
- ausência de inferência sanitária crítica.

### Critério de aceite

- Shape mínimo documentado ou tipado.
- Teste cobrindo campo ausente.
- Teste cobrindo fallback válido.
- Nenhuma alteração indevida em materialização sanitária.
- Nenhuma transformação de protocolo em execução.

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

## P2 — Revisar Future Flags do React Router em wrappers de teste

**Status:** `ABERTO`  
**Área:** testes / roteamento  
**Risco:** baixo agora; médio em futura migração para React Router v7.

### Descrição

Parte dos testes ainda emite avisos de Future Flags do React Router.

Um teste específico de Pasto já recebeu ajuste local com future flags e rota stub. Outros wrappers podem precisar de padronização futura.

### Ação recomendada

Mapear wrappers de teste que usam `MemoryRouter`, `RouterProvider` ou rotas customizadas e avaliar adoção controlada das flags:

```tsx
future={{
  v7_startTransition: true,
  v7_relativeSplatPath: true,
}}
```

### Critério de aceite

- Warnings reduzidos sem alterar expectativa funcional dos testes.
- Nenhuma navegação crítica quebrada.
- Testes de Agenda, Registrar, Pasto, Lote e Relatórios continuam verdes.

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

## FECHADO — Gate Suite Global Pós-Fase 6

**Resultado:** fechado no relatório correspondente.  
**Relatório:** `docs/review/RESULTADO_GATE_SUITE_GLOBAL_POS_FASE_6.md`

Consolidado:

- suite global verde;
- `259` arquivos de teste passaram;
- `1743` testes passaram;
- lint verde;
- build verde;
- `LoteEditarData.test.ts` estabilizado;
- `vitest.config.ts` com `maxWorkers: 2`.

---

## FECHADO — Gate de Higiene de Testes pós-Fase 6

**Resultado:** fechado no `LAST_PHASE_RESULT.md`.

Consolidado:

- mock de Supabase corrigido em teste de sync;
- `fake-indexeddb/auto` adicionado ao teste do Registrar;
- fixture segura criada para fallback legado sanitário;
- rota stub `/registrar` adicionada ao teste de Pasto;
- HTTP 503 esperado passou a ser controlado localmente;
- sem alteração em regra de domínio, Supabase, migrations, RLS ou RPC.

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