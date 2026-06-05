# Roadmap — RebanhoSync

Atualizado em: 2026-06-04
**Baseline documental auditado:** `17f4f76`

## Objetivo

Definir os próximos focos de desenvolvimento do RebanhoSync em nível de produto.

Este documento não é backlog detalhado.
Não deve substituir issues, tarefas técnicas ou prompts de implementação.

---

## Princípios do roadmap

- Estabilizar antes de expandir.
- Proteger offline-first.
- Proteger RLS/multi-tenant.
- Reduzir risco operacional.
- Melhorar UX dos fluxos centrais.
- Evitar automação crítica sem fonte técnica.
- Diferenciar sinal sanitário de autorização comercial.
- Entregar valor prático ao produtor.
- Preservar Agenda/Eventos/`state_*`/Protocolo separados.

---

## Fase atual — Fase 11 (Lotes, Pastos e Desempenho Operacional Ampliado)

Status: **a iniciar**
Fase anterior: **Fase 10 — UX Operacional dos Fluxos Centrais — concluída localmente**

### Conduta inicial

A Fase 11 deve começar por diagnóstico de lote, pasto, ocupação e desempenho operacional ampliado, sem patch direto, sem regra crítica nova, sem custo por arroba, sem DRE/ROI/margem e sem venda/abate automático.

### Escopo inicial sugerido

- diagnóstico de lote/pasto/desempenho;
- GMD por período somente com fonte explícita;
- movimentações e ocupação como eventos/read models;
- relatórios e leituras read-only com limitações explícitas;
- sem motor de decisão ou autorização comercial.

---

## Fase 10 — concluída localmente

### Status das subfases

- 10A — Diagnóstico UX e mapa de fricção: concluída.
- 10B — Agenda/Registrar: concluída localmente.
- 10C — Home/Central Operacional: concluída localmente.
- 10D — Animal, Eventos e Histórico: concluída localmente.
- 10E — Integração via Histórico para Lotes/Pastos, Relatórios e Compra/Venda: concluída localmente.
- 10F — Fechamento da Fase 10 e handoff: executada.

### Resultado

A Fase 10 fechou a UX operacional dos fluxos centrais sem criar regra crítica nova:

- Agenda ficou mais clara como intenção/tarefa futura;
- Registrar ficou mais claro como execução real;
- Home/Central Operacional ficou mais clara como painel de ação/leitura;
- Animal diferencia estado atual de histórico;
- Eventos são apresentados como histórico executado;
- histórico virou eixo de rastreabilidade;
- Lotes/Pastos diferenciam estado atual de movimentações executadas;
- Relatórios aparecem como leitura derivada/parcial;
- Compra/Venda aparece como registro manual, não recomendação;
- nenhum fluxo virou autorização crítica.

---

## Fase 9 — concluída localmente

### Status das subfases

- 9A — Inventário Operacional: concluída localmente.
- 9B — Relatórios Operacionais de Custo Parcial: concluída localmente.
- 9C — Sociedade Patrimonial e Classificação Operacional Read-only: concluída localmente.
- 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase: executada.

### Objetivo da Fase 9

- consolidar base comercial e patrimonial após Fase 8;
- validar custo operacional por inventário;
- garantir idempotência de baixa;
- mapear sociedade patrimonial;
- preparar classificação operacional como leitura apenas;
- impedir que classificação, snapshot ou sinal virem autorização crítica.

### Critério de aceite da Fase 9

- 9A e 9B permanecem concluídas localmente;
- 9C mapeia sociedade patrimonial e classificação operacional com evidência local;
- 9D fecha o gate e define explicitamente a próxima fase;
- nenhuma autorização automática de venda/abate é criada;
- nenhum avanço indevido para DRE, ROI, margem, custo por arroba ou motor comercial avançado ocorre.

Status final: cumprido localmente.

Referência: `docs/review/LAST_PHASE_RESULT.md` e `docs/review/PLANO_FASE_9_GATE_POS_MVP_COMERCIAL_PATRIMONIAL_CLASSIFICACAO_CUSTO.md`

---

## Fases anteriores consolidadas

### Consolidação SLC (Fases 1-6 e Gates)

Concluído em baseline `3fe7a81`:

- `docs/context/`, `docs/domain/`, `docs/technical/`, `docs/product/` consolidados;
- Sanitário (Fase 6): append-only, correcção idempotente, evento original preservado;
- RLS validado para sanitário, estoque e sociedade;
- Suite de 1744 testes passando, lint limpo, build sem erros bloqueantes.

Detalhes em `docs/context/PROJECT_STATUS.md` e `docs/review/LAST_PHASE_RESULT.md`.

---

## Matriz de realidade por fase

Status real usa apenas: `CONCLUÍDA`, `PARCIAL`, `HARDENING_RESIDUAL`, `A_INICIAR`, `FUTURA`, `NÃO_CONFIRMADA`.

| Fase/tema | Estado documental | Evidência local | Status real | Lacunas | Conduta no roadmap |
|---|---|---|---|---|---|
| Fase 5 — Exceções/Reconciliação Sanitária | Consolidada em documentação ativa; há trecho legado em `docs/domain/SANITARIO.md` tratando como planejada. | `src/lib/sanitario/reconciliation/sanitaryCorrections.ts`, `sanitaryExceptions.ts`, testes e consumo em relatórios/eventos. | `CONCLUÍDA` | Hardening residual e contrato legado, sem bug objetivo novo. | Não duplicar como fase futura. |
| Fase 6 — Robustez Sanitária em Staging | Consolidada como gate anterior; pendências residuais não bloqueantes continuam abertas. | `docs/review/FASE_6_SANITARIA_STAGING_SYNC_RLS_HANDOFF.md`, `sync-batch`, RLS, retry/rollback e validações registradas. | `HARDENING_RESIDUAL` | Ruídos de teste/build e higiene DX. | Trilha residual contínua, não fase de produto. |
| Fase 7 — Compra/Venda/Sociedade | Documentada como já executada parcialmente; preparação de PR fechada. | `eventos_comercial`, `commercialOperation*`, `RegistrarComercialSection`, `sociedades_pecuarias`, `sociedade_animais` e testes comerciais/sociedade. | `PARCIAL` | Hardening operacional, UX, sync e relatórios. | Hardening/lacuna, não criação do zero. |
| Fase 8 — Relatórios/Baseline | Documentada como relatórios/baseline estável; 9B ampliou custo parcial. | `operationalSummary.ts`, `Relatorios.tsx`, `Home.tsx`, `finance/gerencial.ts` e testes de relatório. | `PARCIAL` | KPIs ampliados ainda exigem fonte/limitação explícita. | Base para próximos KPIs. |
| Fase 9A — Inventário/Custo/Snapshot | Concluída localmente. | Handoff, `LAST_PHASE_RESULT`, plano da Fase 9 e validações registradas. | `CONCLUÍDA` | Nenhuma pendência específica aberta. | Manter concluída. |
| Fase 9B — Custo parcial em relatórios | Concluída localmente. | `inventory.partialCost`, `operationalSummary.test`, `Relatorios.e2e` e validações registradas. | `CONCLUÍDA` | Nenhuma pendência específica aberta. | Manter concluída. |
| Fase 9C — Sociedade/Classificação read-only | Concluída localmente. | `classificationSnapshot.ts`, teste de contrato, occupancy; sociedade em Dexie/migrations/UI/RLS. | `CONCLUÍDA` | Hardening futuro de UX/sync/relatórios. | Manter concluída. |
| Fase 9D — Fechamento do Gate | Executada. | `LAST_PHASE_RESULT`, `CURRENT_PHASE_HANDOFF`, `ACTIVE_PHASE_PLAN`, `PROJECT_STATUS`, `ROADMAP` e plano da Fase 9 alinhados. | `CONCLUÍDA` | Nenhuma P0/P1 aberta. | Gate fechado; handoff para Fase 10. |
| Financeiro/DRE/Margem | Limites documentados; ledger gerencial existe, DRE/ROI/margem conclusivos não. | `finance_transactions`, `finance_categories`, docs financeiros e testes bloqueando métricas comerciais indevidas. | `PARCIAL` | Método, período, rateio, fonte explícita e limitações. | Fase futura explícita, sem prometer DRE/ROI agora. |
| Lotes/Pastos/Desempenho | MVP/capability indicam base parcial. | `pastos`, `lotes`, occupancy, movimentação e relatórios. | `PARCIAL` | Desempenho ampliado/GMD por período e fonte declarada. | Fase futura ou hardening. |
| KPIs operacionais | Relatórios operacionais existem; KPIs ampliados são planejados. | `operationalSummary`, `Relatorios`, `Home`, docs de KPI/limites financeiros. | `PARCIAL` | KPIs read-only ampliados com fonte, período e limitação. | Fase futura read-only. |

---

## Sequência prevista a partir da Fase 11

1. Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado.
2. Fase 12 — Compra/Venda Operacional: Hardening e Lacunas.
3. Fase 13 — Relatórios/KPIs Operacionais Read-only Ampliados.
4. Fase 14 — Financeiro Gerencial Explícito.
5. Fase 15 — Motor de Decisão Assistida.
6. Fase 16 — Beta Externo / SLC / Hardening de Produto.

Fase 11 é a próxima fase definida pelo fechamento local da Fase 10.

---

## Trilhas residuais contínuas

- Sanitário/reconciliação: apenas hardening residual das Fases 5/6, sem reabrir como fase de produto salvo bug objetivo.
- Build/testes/DX: higiene residual de warnings, logs e estabilidade de suite.
- Compliance regulatório: módulo futuro com fonte oficial, versionamento e separação de alerta vs bloqueio.
- Reprodução ampliada: módulo futuro com contrato de domínio, eventos, agenda, estado atual e testes.

---

## Futuro — Compliance regulatório avançado

Objetivo futuro:

- catálogo regulatório;
- overlay estadual;
- biossegurança;
- feed-ban;
- doenças notificáveis;
- alertas documentais.

Requisito:

- fonte oficial;
- aplicabilidade;
- versionamento;
- separação de alerta vs bloqueio;
- não transformar compliance em evento;
- não transformar checklist ou ausência de ocorrência em liberação final.

---

## Futuro — Reprodução ampliada

Objetivo futuro:

- IATF;
- IA;
- cobertura;
- diagnóstico de gestação;
- estação de monta;
- indicadores reprodutivos.

Requisito:

- contrato de domínio;
- modelagem de eventos;
- agenda;
- estado atual;
- testes;
- limites bem definidos.

---

## Bloqueios estratégicos
