# Plano Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado

Atualizado em: 2026-06-05
**Baseline documental de entrada:** `0f2fd8e`
**Commit local analisado na 11A:** `0d350b8`

## Objetivo

Ampliar a leitura operacional de lotes, pastos, ocupação, movimentações e desempenho, preservando fontes explícitas, período e limitações. A fase deve manter tudo read-only até haver fonte suficiente, sem criar regra crítica nova, custo por arroba, DRE, ROI, margem, motor de decisão, venda/abate automático ou autorização operacional crítica.

## Subfases

### 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado

Status: concluída documentalmente.

- confirmar fontes reais para lote, pasto, animais, ocupação, movimentação e pesagem;
- separar estado atual, histórico e leitura derivada;
- registrar lacunas para GMD, permanência, ocupação histórica e lotação;
- preparar patch pequeno para 11B, sem alteração funcional nesta subfase.

### 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos

Status: concluída localmente.

- ajustar linguagem operacional do cockpit;
- explicitar limitações de GMD, permanência e ocupação;
- evitar que `state_pasto_ocupacoes` seja tratado como histórico completo;
- manter leitura read-only;
- preservar schema, Supabase, migrations, RLS, RPC, sync e edge functions sem alteração.

Resultado:

- GMD limitado semanticamente a animais atuais com pesagens válidas;
- `state_pasto_ocupacoes` tratado como read model parcial de ocupação atual;
- permanência e lotação passaram a declarar limitações de fonte;
- telas de detalhe só foram tocadas para labels de permanência montados fora do adapter;
- testes focados cobrem os cenários críticos de GMD, ocupação/read model e UA/ha.

Arquivos candidatos:

```txt
src/features/occupancy/cockpitManejoAdapter.ts
src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts
src/pages/LoteDetalhe.tsx
src/pages/PastoDetalhe.tsx
```

Componentes de tela só devem ser tocados se o texto exibido estiver fora do adapter.

### 11C — Ocupação, lotação e movimentações

Status: concluída localmente.

- revisar ocupação atual, lotação e movimentações com fonte declarada;
- manter `state_*` como estado atual/read model;
- manter eventos de movimentação como histórico executado;
- declarar limitação quando área, peso ou histórico estiverem incompletos.

Resultado:

- movimentações apenas de entrada tratadas como leitura atual parcial;
- permanência histórica completa continua dependente de eventos completos de entrada e saída;
- UA total do lote explicita dependência de peso explícito dos animais atuais;
- testes focados atualizados no adapter.

### 11D — Desempenho read-only se houver fonte suficiente

Status: preparada; não iniciada.

- avaliar desempenho apenas como leitura operacional parcial;
- calcular GMD por período somente com pesagens explícitas e vínculo temporal adequado;
- não afirmar desempenho de lote/pasto sem permanência suficiente no período.

### 11E — Relatórios operacionais ampliados

Status: futura.

- ampliar relatórios read-only com fonte, período e limitação;
- preservar custo parcial, saldo e leituras financeiras como parciais quando aplicável;
- não criar DRE, ROI, margem ou custo por arroba.

### 11F — Fechamento

Status: futura.

- consolidar entregas da Fase 11;
- registrar validações;
- preservar riscos residuais reais;
- preparar próxima fase sem reabrir etapas fechadas.

## Fontes Permitidas por Domínio

| Domínio | Fonte permitida | Limitação obrigatória |
|---|---|---|
| Estado atual | `state_lotes`, `state_pastos`, `state_animais` | Estado atual/read model não substitui histórico completo. |
| Histórico | `event_eventos` + detail tables, especialmente `event_eventos_movimentacao` | Evento executado é a fonte histórica; lacunas devem ser declaradas. |
| Ocupação | `state_pasto_ocupacoes` | Read model útil para ocupação atual; não é fonte histórica primária completa. |
| Pesagens | `event_eventos_pesagem` + `event_eventos.occurred_at` | GMD exige ao menos duas pesagens válidas em dias distintos. |
| Área de pasto | `state_pastos.area_ha` | Lotação UA/ha exige área válida e fonte de peso. |

## Limitações Obrigatórias

- Read model não é fonte histórica primária.
- GMD exige pesagens explícitas.
- GMD por lote/pasto não prova permanência sem movimentação suficiente.
- Lotação UA/ha exige fonte de peso e `area_ha`.
- Desempenho parcial não autoriza decisão operacional crítica.
- Agenda continua sendo intenção/tarefa futura, não histórico executado.
- Evento continua sendo fato executado.

## Escopo Proibido

- Custo por arroba.
- DRE.
- ROI.
- Margem.
- Venda ou abate automático.
- Aptidão automática para venda ou abate.
- Recomendação zootécnica crítica.
- Carência liberatória.
- Schema, migration, RLS, RPC, edge functions, sync ou Supabase sem justificativa explícita e validação proporcional.

## Critério de Avanço da 11A para 11B

A 11A está aceita quando houver registro documental de:

- commit local analisado;
- baseline documental encontrado;
- divergência entre baseline documental, contexto colado e commit local;
- worktree limpo;
- documentos ativos lidos;
- fontes reais para lotes, pastos, animais, ocupação, movimentação e pesagem;
- lacunas para GMD, permanência, ocupação histórica e lotação;
- riscos de inferência indevida;
- escopo mínimo da 11B;
- ausência de patch funcional;
- ausência de alteração em Supabase, migrations, RLS, RPC, schema, sync ou edge functions.

## Validação Proporcional

Para patch documental:

```bash
git diff --check
git diff -- docs/review
```

Para 11B com patch funcional/read-only:

```bash
pnpm test -- src/features/occupancy/__tests__/cockpitManejoAdapter.test.ts
git diff --check
```

Adicionar `pnpm run lint` e `pnpm run build` se houver alteração relevante em UI ou domínio compartilhado.
