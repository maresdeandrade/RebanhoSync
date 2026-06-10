# Roadmap — RebanhoSync

Atualizado em: 2026-06-06
**Baseline documental auditado:** `91e0775`

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

## Fase atual — Fase 12

Status: **Fase 12D5 concluída como contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy**
Fase anterior: **Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente — concluída localmente**
Fase seguinte: **Fase 12D6 — Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass — a iniciar**

### Conduta inicial

As subfases 11.5A a 11.5J (Agenda Sanitária v2 core/documental), 12A (auditoria), 12B (modelagem clean/reset), 12C (migration clean SQL), 12D0 (modelo canônico), 12D1 (schema/contratos mínimos v2), 12D2 (builders/adapters puros de snapshots), 12D3 (extração curatorial), 12D4 (rebaseline conceitual das matrizes) e 12D5 (contratos TypeScript de ProductClass) foram concluídas localmente. O desenvolvimento segue focado na fundação do módulo sanitário v2 antes do acoplamento com o offline e sincronização.

### Handoff para Fase 12D6

A próxima etapa 12D6 criará as tabelas físicas para armazenar as classes de produto e seus relacionamentos no Supabase, definindo as políticas de RLS correspondentes.

Riscos residuais vindos da 12D5:
- Compatibilidade profunda e gradativa das agendas ativas locais com o novo campo estruturado `productRequirementRule`.
- Garantir que as migrations futuras de seed não reintroduzam registros não curados.

### Escopo da Fase 12D6+
- Migrations físicas no Supabase para as tabelas `sanitario_product_classes_v2` e vinculados.
- Criação e validação das regras de RLS baseadas no tenant (`fazenda_id`).

---

## Fase 11 — concluída localmente

### Status das subfases

- 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado: concluída documentalmente.
- 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos: concluída localmente.
- 11C — Ocupação, lotação e movimentações: concluída localmente.
- 11D — Desempenho read-only se houver fonte suficiente: concluída localmente.
- 11E — Relatórios operacionais ampliados: concluída localmente.
- 11F — Fechamento: executada.

### Resultado

A Fase 11 consolidou leituras de lote, pasto e desempenho com fonte explícita, período e limitação. `state_*` permaneceu como estado atual/read model, eventos permaneceram como histórico/fato executado, GMD continuou dependente de pesagens explícitas e relatórios operacionais ampliados seguiram sem DRE, ROI, margem ou custo por arroba.

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

## Sequência rebaselineada após a Fase 11.5

1. Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout.
2. Fase 13 — Reprodução Operacional v1.
3. Fase 14 — Compra/Venda Operacional: Hardening e Lacunas.
4. Fase 15 — Relatórios/KPIs Operacionais Read-only Ampliados.
5. Fase 16 — Financeiro Gerencial Explícito.
6. Fase 17 — Motor de Decisão Assistida.
7. Fase 18 — Beta Externo / SLC / Hardening de Produto.

Fase 12 permanece não iniciada até novo diagnóstico, commit da 11.5J e atualização explícita do plano ativo.

Justificativa técnica:

- Compra/Venda não deve avançar antes da aplicação real da Agenda Sanitária v2, porque estoque, carência, aptidão e histórico sanitário dependem de evento real/produto executado, não de agenda.
- Reprodução é domínio estrutural ausente e afeta categoria operacional, estado animal, ciclo produtivo, agenda e decisões comerciais; deve anteceder KPIs e decisão assistida.
- KPIs e financeiro dependem de fontes consolidadas, períodos, limitações e separação entre fato, intenção e read model.
- Motor de decisão assistida depende de dados confiáveis, fontes explícitas e limites de não autorização automática.

Fases reclassificadas:

- Compra/Venda deixa de ser Fase 12 e passa a Fase 14.
- Relatórios/KPIs passam de Fase 13 para Fase 15.
- Financeiro Gerencial passa de Fase 14 para Fase 16.
- Motor de Decisão Assistida passa de Fase 15 para Fase 17.
- Beta Externo/SLC passa de Fase 16 para Fase 18.
- Reprodução ampliada deixa de ser apenas futuro genérico e passa a Fase 13 — Reprodução Operacional v1.

---

## Trilhas residuais contínuas

- Sanitário/reconciliação: apenas hardening residual das Fases 5/6, sem reabrir como fase de produto salvo bug objetivo.
- Build/testes/DX: higiene residual de warnings, logs e estabilidade de suite.
- Docs reconciliation: manter alinhamento entre status, roadmap, contratos normativos e handoffs.
- Compliance regulatório: módulo futuro com fonte oficial, versionamento e separação de alerta vs bloqueio.
- Eventos/paginação/performance: otimização incremental conforme gargalo real.
- UX incremental: melhorias sem criar regra crítica na UI.

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
