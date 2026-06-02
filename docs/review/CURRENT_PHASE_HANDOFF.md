# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-02  
**Baseline Commit:** `32d7779`

## 1. Fase atual

Preparação de commit/PR — Fechamento Fase 6 + Gates Pós-Fase 6.

---

## 2. Estado consolidado

A Fase 6 sanitária foi executada e as pendências posteriores de suite global, higiene de testes e preparação de PR foram regularizadas localmente.

Consolidado:

- correção sanitária append-only validada;
- replay corretivo com `idempotency_key` determinístico validado;
- retry corretivo sem duplicidade validado;
- evento original preservado;
- payload corretivo mínimo formalizado no builder;
- payload legado tratado como `partial`, com limitações explícitas;
- sociedade validada como vínculo patrimonial;
- sociedade validada sem efeitos automáticos sanitários, de conformidade ou financeiros;
- baseline funcional Supabase passou com RLS para sanitário, estoque e sociedade;
- suite global `pnpm test -- --run` passou;
- suite global final: `259` arquivos / `1743` testes;
- lint passou;
- build passou com warnings conhecidos não bloqueantes;
- Vitest usa `maxWorkers: 2` para estabilizar execução global local;
- Gate de Higiene de Testes pós-Fase 6 concluído;
- Fase 7 Preparação de PR concluída localmente;
- continuidade documental reconciliada.

Não houve alteração em:

- migrations;
- schema;
- policies RLS;
- RPCs;
- edge functions;
- venda;
- abate;
- DRE;
- ROI;
- custo por arroba;
- motor comercial.

---

## 3. O que não deve ser refeito

Não refazer sem regressão comprovada:

- contrato de payload corretivo sanitário implementado em `sanitaryCorrections.ts`;
- testes focados de replay/idempotência corretiva;
- teste de isolamento patrimonial da sociedade no Registrar;
- ampliação do baseline Supabase para sanitário, estoque e sociedade;
- validações focadas de `src/lib/sanitario`, `src/lib/inventory`, `src/lib/events`, `src/lib/comercial` e `src/pages/Registrar`;
- estabilização da suite global via `vitest.config.ts`;
- correção de mock Supabase em `sync_insumo_movimentacoes.test.ts`;
- adição de `fake-indexeddb/auto` em `Registrar.test.tsx`;
- fixture segura do fallback legado sanitário em `nextOccurrenceService.test.ts`;
- rota stub `/registrar` em `PastoAvaliacao.test.tsx`.

---

## 4. Pendências abertas

Não há pendência bloqueante para commit/PR.

Pendências residuais não bloqueantes estão registradas em:

```txt
docs/review/OPEN_REVIEW_ITEMS.md
```

Itens residuais:

1. Ruído residual em `stderr/stdout` fora do escopo do Gate de Higiene de Testes.
2. Contrato mínimo do fallback legado sanitário.
3. Warnings conhecidos de build:
   - Browserslist/caniuse-lite desatualizado;
   - chunks grandes no Vite.
4. Padronização futura de Future Flags do React Router em wrappers de teste.
5. Revisão futura de avisos de Dialog/act em testes.

Essas pendências não bloqueiam o fechamento da Fase 6, do Gate Suite Global, do Gate de Higiene de Testes ou da Fase 7.

---

## 5. Próximo objetivo

Preparar commit/PR do fechamento:

```txt
Fase 6 sanitária + Gate Suite Global + Gate de Higiene de Testes + Fase 7
```

Antes do commit/PR:

- revisar branch atual;
- evitar commit direto em `main`, se a política do projeto exigir PR;
- criar branch dedicada, se necessário;
- revisar arquivos alterados;
- revisar diff por área;
- montar mensagem de commit;
- montar descrição de PR;
- confirmar que nenhuma feature nova entrou no patch.

---

## 6. Escopo permitido na próxima etapa

Permitido:

- revisar `git status`;
- revisar `git diff --name-only`;
- revisar `git diff --stat`;
- revisar `git diff --check`;
- confirmar se há arquivos staged;
- criar branch dedicada;
- preparar commit message;
- preparar descrição de PR;
- revisar se os 3 documentos de continuidade estão atualizados;
- ajustar documentação apenas se houver inconsistência real.

---

## 7. Escopo proibido

Não criar feature nova.

Não alterar sem autorização explícita:

- regra de domínio;
- domínio sanitário;
- sync/offline;
- Supabase;
- migrations;
- schema;
- policies RLS;
- RPCs;
- edge functions;
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

Não transformar:

- agenda em histórico;
- protocolo em execução;
- tag/sinal/insight em fonte primária;
- sociedade em conformidade sanitária;
- snapshot em valor retroativo.

---

## 8. Áreas alteradas no fechamento atual

Áreas principais:

```txt
src/lib/sanitario/reconciliation
src/lib/offline/__tests__
src/lib/sanitario/__tests__
src/pages/Registrar/__tests__
src/pages/__tests__
scripts/codex
docs/review
docs/context
vitest.config.ts
```

Áreas que não devem ser tocadas sem regressão comprovada:

```txt
supabase/migrations
supabase/functions
src/features/occupancy
src/lib/comercial
src/lib/finance
```

---

## 9. Validação já fechada

Validações já executadas e aprovadas:

```bash
pnpm test -- --run
pnpm run lint
pnpm run build
git diff --check
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Resultado consolidado:

```txt
Test Files  259 passed (259)
Tests       1743 passed (1743)
Lint        passed
Build       passed
```

Build passou com warnings conhecidos não bloqueantes:

- Browserslist/caniuse-lite desatualizado;
- chunks acima de 500 kB.

---

## 10. Validação recomendada antes do commit/PR

Antes do commit/PR, rodar pelo menos:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

Se houver qualquer alteração posterior, reexecutar validação proporcional.

Se tocar código runtime, runner ou testes:

```bash
pnpm test -- --run
pnpm run lint
pnpm run build
```

Se tocar Supabase, sync-batch, schema, RLS, RPC ou migration:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## 11. Critérios de aceite da próxima etapa

Para considerar o commit/PR pronto:

- branch dedicada criada ou risco de `main` aceito explicitamente;
- `git status --short --untracked-files=all` revisado;
- `git diff --name-only` revisado;
- `git diff --stat` revisado;
- `git diff --check` sem falhas;
- arquivos staged conferidos;
- mensagem de commit definida;
- descrição de PR definida;
- pendências residuais documentadas;
- nenhuma feature nova adicionada;
- nenhum avanço para escopo comercial proibido.

---

## 12. Prompt recomendado para a próxima conversa

Usar o prompt abaixo:

```md
Você é o arquiteto técnico sênior do RebanhoSync.

Continue a partir de:

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/review/RESULTADO_FASE_7_PREPARACAO_PR.md`
- `docs/context/PROJECT_STATUS.md`
- `AGENTS.md`
- `.agents/rules/CORE_RULES.md`
- `.agents/rules/CONTEXT_LOADING.md`

Objetivo:

Preparar commit/PR do fechamento da Fase 6 + Gate Suite Global + Gate de Higiene de Testes + Fase 7.

Antes de alterar qualquer arquivo, entregue:

1. branch atual;
2. status do worktree;
3. arquivos alterados;
4. arquivos untracked;
5. resumo do diff por área;
6. se há risco de commit direto em `main`;
7. plano mínimo para preparar PR.

Escopo permitido:

- revisar status/diff;
- sugerir branch;
- sugerir commit message;
- sugerir descrição de PR;
- ajustar documentação apenas se houver inconsistência real.

Escopo proibido:

- criar feature nova;
- alterar regra de domínio;
- alterar Supabase, migrations, RLS, RPC ou schema;
- avançar para venda, abate, DRE, ROI, custo por arroba ou motor comercial.

Validação esperada antes do PR:

```bash
git diff --check
pnpm test -- --run
pnpm run lint
pnpm run build
```
```

---

## 13. Status final do handoff

```txt
Fase 6 sanitária: concluída localmente.
Gate Suite Global: concluído.
Gate de Higiene de Testes: concluído.
Fase 7: concluída localmente.
Próxima etapa: commit/PR.
```