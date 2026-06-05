# Current Phase Handoff — RebanhoSync

Atualizado em: 2026-06-05
**Baseline Commit:** `0f2fd8e`

## 1. Fase atual

Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado — em andamento.

Subfase 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado — concluída documentalmente, sem patch funcional.

Subfase 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos — concluída localmente.

Subfase 11C — Ocupação, lotação e movimentações — concluída localmente.

Subfase 11D — Desempenho read-only se houver fonte suficiente — preparada, não iniciada.

Plano específico: `docs/review/PLANO_FASE_11.md`.

Commit local analisado na 11A: `0d350b8`.

Baseline documental de entrada preservado: `0f2fd8e`.

Contexto anterior citava commit `8a62445`; a 11A registrou drift entre contexto colado, baseline documental e commit local. Não houve atualização automática de baseline.

---

## 1.1 Fase anterior

Fase 10 — UX Operacional dos Fluxos Centrais — concluída localmente.

Subfase 10A — Diagnóstico UX e mapa de fricção — concluída sem patch.

Subfase 10B — Agenda/Registrar: clareza de intenção futura vs execução real — concluída localmente.

Subfase 10C — Home/Central Operacional — concluída localmente.

Subfase 10D — Animal, Eventos e Histórico — concluída localmente.

Subfase 10E — Integração via Histórico para Lotes/Pastos, Relatórios e Compra/Venda — concluída localmente.

Subfase 10F — Fechamento da Fase 10 e handoff — executada.

Fase 11 nomeada como fase seguinte no fechamento da 10F.

---

## 2. Estado consolidado

Fase 11A consolidou diagnóstico técnico/documental:

- estado atual identificado em `state_lotes`, `state_pastos` e `state_animais`;
- ocupação/read model identificado em `state_pasto_ocupacoes`;
- histórico identificado em `event_eventos` + `event_eventos_movimentacao`;
- peso/GMD identificado em `event_eventos_pesagem` com `event_eventos.occurred_at`;
- lotação UA/ha depende de pesos explícitos e `state_pastos.area_ha`;
- `state_pasto_ocupacoes` é read model útil para ocupação atual, mas não fonte histórica primária completa;
- GMD por lote/pasto não comprova permanência no lote/pasto sem movimentações suficientes no período;
- ocupação histórica exige eventos consistentes de entrada/saída;
- desempenho parcial não autoriza decisão operacional crítica.

Nenhum código funcional, Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado na 11A.

Fase 11B consolidou patch pequeno/read-only no cockpit de Lotes/Pastos:

- `GMD` agora comunica leitura baseada nos animais atuais com pesagens válidas, sem comprovar desempenho histórico completo do lote/pasto;
- `state_pasto_ocupacoes` é apresentado como read model parcial de ocupação atual, não fonte histórica primária completa;
- permanência por movimentações declara limitação histórica;
- taxa UA/ha explicita dependência de `area_ha` válida e peso explícito;
- labels de permanência em `LoteDetalhe` e `PastoDetalhe` foram ajustados para leitura atual;
- testes focados de `src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts` passaram;
- `git diff --check`, `pnpm run lint` e `pnpm run build` passaram, com warnings conhecidos de Browserslist/chunks no build.

Nenhum Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado na 11B.

Fase 11C consolidou patch pequeno/read-only para ocupação, lotação e movimentações:

- movimentações apenas de entrada agora são leitura atual parcial, sem afirmar permanência histórica completa;
- limitação de permanência por eventos explicita que histórico completo exige eventos completos de entrada e saída;
- UA total do lote explicita dependência de peso explícito dos animais atuais;
- testes focados de `src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts` passaram com 22 testes;
- `git diff --check`, `pnpm run lint` e `pnpm run build` passaram, com warnings conhecidos de Browserslist/chunks no build.

Nenhum Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado na 11C.

Próximo passo mínimo: iniciar 11D por diagnóstico, avaliando desempenho read-only apenas se houver fonte suficiente.

Fases 1-8 permanecem consolidadas em baseline `3fe7a81`.

Fase 9 permanece concluída localmente, com 9A, 9B, 9C e 9D preservadas como fechadas.

Fase 10A consolidou o diagnóstico UX/produto dos fluxos centrais sem patch funcional:

- Home/Central Operacional já separa pendência, execução, histórico e estado atual em alto nível;
- Agenda/Registrar foi identificada como maior ponto de fricção por ambiguidade de CTAs;
- Eventos se mantém como histórico operacional;
- Relatórios indicam fonte primária e custo parcial;
- Lotes/Pastos e insights já mostram estados e limitações.

Fase 10B aplicou patch UX mínimo em Agenda:

- `Registrar` virou `Registrar execução` no CTA global da Agenda;
- `Registrar` virou `Registrar execução` no estado vazio da Agenda;
- `Concluir` virou `Fechar pendência` para ação direta de item;
- hints reforçam que Registrar grava execução real e que fechar pendência encerra apenas tarefa futura;
- teste de renderização/UX atualizado em `src/pages/Agenda/__tests__/AgendaMacroPanels.test.tsx`.

Fase 10C aplicou patch UX mínimo em Home/Central Operacional:

- Home reforça que pendências vêm da agenda e execução real deve ser registrada no Registrar;
- CTA principal passou para `Registrar execucao`;
- atalhos foram renomeados como registros de evento executado;
- copy deixa explícito que atalhos/sinais não autorizam venda, abate ou carência;
- painel de insights reforça estados de dado completo, parcial, vazio e bloqueado;
- sinais auxiliares permanecem leitura, sem persistir tags e sem autorizar ação operacional;
- testes focados de Home e OperationalInsights passaram.

Nenhuma regra de negócio, Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado.

Fase 10D aplicou patch UX mínimo em Animal/Eventos/Histórico:

- ficha do animal explicita `Estado atual`;
- hint no topo do animal reforça que estado, status e classificação são leitura operacional, sem autorizar venda ou abate;
- CTA comercial do animal passou para `Registrar venda manual`;
- Eventos passou a `Historico de eventos executados`;
- CTA de Eventos passou para `Novo registro manual`;
- copy de Eventos reforça fatos já registrados, registro manual e separação de agenda vs histórico;
- quick action de Registrar passou para `Venda manual`, com helper de limitação comercial;
- testes focados de AnimalDetalhe, Eventos e quick action passaram.

Nenhuma regra crítica nova, cálculo de classificação/evento/relatório, Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado.

Fase 10E aplicou patch UX mínimo em Lotes/Pastos, Relatórios e Compra/Venda:

- Lotes/Pastos reforçam estado atual vindo de `state_*` e histórico de movimentos/manejos executados;
- detalhes de lote/pasto explicitam que timeline, movimentações, rondas e operações são fatos históricos executados;
- operações comerciais do lote aparecem como registros manuais informados pelo usuário, sem recomendação ou aptidão comercial;
- Relatórios passam a explicitar leitura derivada/parcial de eventos, `state_*` e agenda;
- relatório financeiro operacional reforça que saldo e custo parcial não são DRE, ROI, margem ou custo por arroba;
- seção comercial do Registrar apresenta `Compra manual` e `Venda manual`, sem validar aptidão comercial;
- testes focados de LoteDetalhe, PastosP2, Relatorios e RegistrarComercialSection passaram.

Nenhuma regra crítica nova, cálculo de relatório/insight/classificação, Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado.

Fase 10F fechou documentalmente a Fase 10:

- 10A, 10B, 10C, 10D e 10E preservadas como concluídas;
- ausência de P0/P1 aberta em `docs/review/OPEN_REVIEW_ITEMS.md` confirmada;
- riscos residuais P2 preservados;
- Fase 10 marcada como concluída localmente;
- Fase 11 nomeada como próxima fase.

Nenhum código, teste, Supabase, RLS, migration, RPC, edge function, schema ou sync foi alterado na 10F.

Fase 9A consolidou o inventário operacional no escopo técnico autorizado:

- unidade de compra/apresentação separada da unidade base;
- unidade base separada da unidade de consumo/evento;
- custo total, custo por entrada e custo unitário/base separados;
- lote persistido com custo unitário/base;
- snapshot econômico preservado como derivado/read-only;
- baixa nutricional automática testada por `eventId`;
- retry/replay nutricional testado preservando `client_op_id`, `record.id` e `source_evento_id`;
- conflito remoto `23505` em `insumo_movimentacoes` tratado como `APPLIED`;
- índice único parcial remoto `ux_insumo_movimentacoes_consumo_nutricao_evento` criado para `consumo_nutricao`.

Fase 9B fechou documentalmente a leitura operacional parcial de custo:

- `inventory.partialCost` em `src/lib/reports/operationalSummary.ts`;
- cálculo fora da UI;
- apresentação em `src/pages/Relatorios.tsx`;
- custo operacional parcial conhecido;
- entradas com custo conhecido;
- saídas/consumos com custo conhecido;
- saldo econômico parcial conhecido por lote ativo;
- custo ausente separado;
- `0` tratado como custo válido;
- `null`/`undefined` tratados como custo ausente;
- sem inferência de custo quando snapshot está ausente.

Referência completa: `docs/review/LAST_PHASE_RESULT.md`.

---

## 2.1 Realidade de fases para o roadmap

Auditoria documental/local em 2026-06-04:

- Fase 5 — Exceções/Correções/Reconciliação Sanitária: `CONCLUÍDA`; manter apenas hardening residual.
- Fase 6 — Robustez Sanitária em Staging/RLS/sync: `HARDENING_RESIDUAL`; não reabrir como fase de produto sem bug objetivo.
- Fase 7 — Compra/Venda/Sociedade: `PARCIAL`; tratar como hardening e lacunas, não criação do zero.
- Fase 8 — Relatórios/Baseline: `PARCIAL`; usar como base para KPIs operacionais ampliados.
- Fase 9A e 9B: `CONCLUÍDA` localmente.
- Fase 9C: `CONCLUÍDA` localmente.
- 9D: `CONCLUÍDA` localmente; gate da Fase 9 fechado.

Conduta pós-Fase 9: iniciar Fase 10 por diagnóstico UX/produto, usando a sequência corrigida do `docs/product/ROADMAP.md`, mantendo sanitário/reconciliação como trilha residual contínua e evitando antecipar DRE, ROI, margem, custo por arroba ou motor comercial.

---

## 3. Validação consolidada

Validações executadas na 9A:

```txt
pnpm test -- testes focados de inventário/sync/sync-batch: passou
pnpm test: passou (260 arquivos, 1746 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos
supabase db reset: passou
node scripts/codex/validate-supabase-baseline-functional.mjs: passou
git diff --check: passou
```

Warnings conhecidos permanecem não bloqueantes e documentados em `docs/review/OPEN_REVIEW_ITEMS.md`.

Validações executadas na 9B:

```txt
git diff --check: passou
pnpm test -- src/lib/reports/__tests__/operationalSummary.test.ts: passou
pnpm test -- src/pages/__tests__/Relatorios.e2e.test.tsx: passou
pnpm test: passou (260 arquivos, 1747 testes)
pnpm run lint: passou
pnpm run build: passou com warnings conhecidos de Browserslist/chunks
```

---

## 4. Pendências abertas

Não há pendência aberta conhecida para:

- separação de custo por entrada vs custo unitário/base;
- idempotência local/remota da baixa nutricional;
- índice único parcial remoto de `consumo_nutricao`;
- snapshot econômico como derivado/read-only;
- leitura parcial de custo operacional da 9B.

Pendências residuais não bloqueantes:

1. Ruído residual em `stderr/stdout` de testes.
2. Warnings conhecidos de build.
3. Revisão futura de avisos de Dialog/act em testes.

---

## 5. Resultado da Fase 9

Fase 9 concluída localmente pela Subfase 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase.

Resultado da 9C:

- sociedade patrimonial mapeada no modelo local, Dexie, pull/tableMap, migrations/RLS e Registrar;
- isolamento por `fazenda_id` confirmado em stores, FKs compostas, índices e policies RLS;
- `classificationSnapshot` revisado como leitura/snapshot com `source` e `limitations`;
- consumo de classificação confirmado como agregação operacional de categoria predominante;
- teste de contrato adicionado para impedir interpretação de classificação como autorização de venda, abate ou carência;
- nenhuma regra de DRE, ROI, margem, custo por arroba, motor comercial avançado, carência liberatória ou autorização crítica criada.

Resultado da 9D:

- 9A, 9B e 9C preservadas como concluídas localmente;
- ausência de P0/P1 bloqueante aberta em `docs/review/OPEN_REVIEW_ITEMS.md` confirmada;
- riscos residuais P2 preservados;
- Fase 10 nomeada como próxima fase.

---

## 6. Escopo permitido no próximo passo

Permitido para 11D:

- avaliar desempenho read-only somente se houver fonte suficiente;
- manter GMD vinculado a pesagens explícitas e período;
- não afirmar desempenho de lote/pasto sem permanência comprovada no período;
- declarar limitações quando a fonte de desempenho for parcial;
- manter leitura read-only;
- propor patch pequeno, reversível e testável com testes focados;
- preservar regras críticas fora da UI;
- não criar custo por arroba, DRE, ROI, margem, motor de decisão ou venda/abate automático.

---

## 7. Escopo proibido permanente para esta transição

Não fazer sem tarefa explícita:

- reabrir ou alterar o fechamento da Fase 9 sem tarefa explícita;
- reabrir Fase 9A, 9B ou 9C;
- criar DRE, ROI, venda, abate ou custo por arroba;
- transformar classificação operacional em autorização;
- transformar snapshot/read model em fonte primária;
- criar nova fonte de verdade paralela;
- alterar contrato Sanitário, Agenda, Evento ou Protocolo fora do escopo autorizado.

---

## 8. Áreas candidatas para Fase 11

Áreas candidatas para diagnóstico inicial devem ser definidas conforme o recorte de Lotes/Pastos/Desempenho. Começar por documentação ativa e arquivos diretamente relacionados:

```txt
docs/domain/LOTES_PASTOS.md
docs/context/PROJECT_STATUS.md
src/pages/Lotes.tsx
src/pages/Pastos.tsx
src/pages/LoteDetalhe.tsx
src/pages/PastoDetalhe.tsx
src/features/occupancy
```

Áreas protegidas:

```txt
supabase/migrations
supabase/functions
src/lib/sanitario
src/lib/eventos
```

Só tocar Supabase/migrations/RLS se houver tarefa explícita e validação proporcional.

---

## 9. Checklist antes de nova implementação

Executar no início de nova rodada:

```bash
git status --short --untracked-files=all
git diff --check
```

Se houver patch funcional:

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se houver Supabase, RLS, RPC, migration, sync-batch ou baseline:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
