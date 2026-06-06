# ACTIVE_PHASE_PLAN - Fase 12A

**Status:** Fase 12A em escopo documental/diagnóstico; nenhuma implementação funcional iniciada
**Foco:** Auditoria do fluxo legado e decisão de schema da Agenda Sanitária v2
**Criado:** 2026-06-05
**Atualizado:** 2026-06-06
**Plano específico:** `docs/review/PLANO_FASE_12A_AUDITORIA_FLUXO_LEGADO_SCHEMA_SANITARIO.md`

---

## Objetivo em 1 parágrafo

Executar a 12A como subfase preparatória da Fase 12, limitada a diagnóstico e documentação. O objetivo é auditar o fluxo legado `protocolos_sanitarios_itens -> agenda_itens/state_agenda_itens -> eventos/eventos_sanitario -> insumo_movimentacoes`, decidir a direção de schema da Agenda Sanitária v2 e registrar requisitos mínimos de dados legados, idempotência, RLS, Dexie/offline-first e testes sentinela para 12B+. Não implementar migration, Dexie, sync-batch, RLS, RPC, UI, seed ou alteração funcional nesta etapa.

---

## Decisão 12A

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Recomendação de schema: criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória.

Justificativa:

- `agenda_itens` atual mistura domínios e usa `status='agendado'|'concluido'|'cancelado'`;
- `status='concluido'` é ambíguo para sanitário v2;
- o SQL legado ainda lidera recompute/materialização;
- a RPC `sanitario_complete_agenda_with_event` ainda cria evento e conclui agenda;
- contratos 11.5 existem como core puro, sem persistência real;
- substituir tudo de uma vez elevaria risco em UI, Dexie, sync-batch, views e RLS;
- reaproveitar só `agenda_itens` manteria payload opaco e duplicidade semântica.

Escopo permitido nesta subfase:

- documentação da auditoria e decisão;
- atualização de continuidade;
- definição de testes sentinela.

Escopo proibido:

- migration SQL, enum, tabela, FK, RLS, RPC, Edge Function, sync-batch, Dexie, UI, seed, regra sanitária, evento real, baixa de estoque, carência ativa, venda, abate ou aptidão operacional.

---

## Status da Fase 11.5

- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado: concluída localmente.
- Fase 11.5 — Agenda Sanitária v2: fechada localmente pela 11.5H, reconciliada pela 11.5I e rebaselineada pela 11.5J.
- Fase 12A — Auditoria do fluxo legado e decisão de schema: iniciada somente em documentação/diagnóstico.

Próximo passo sugerido:

- Após fechar 12A documentalmente, seguir para 12B somente com decisão de schema, matriz de dados legados, riscos de `status='concluido'`, impacto Dexie/sync/RLS e testes sentinela definidos.

---

## Contrato planejado

```txt
Protocolo
-> contrato bibliográfico/legal/bula da regra e produto
-> janela operacional sanitária
-> elegibilidade individual
-> demanda sanitária agrupada
-> preview/editável
-> agenda materializada de forma idempotente
-> evento sanitário executado
```

---

## Princípios obrigatórios

- Protocolo = regra/configuração.
- Produto = fonte primária de dose, via, apresentação e carência.
- Carência deve ser vinculada primariamente ao produto e exige fonte explícita.
- Agenda = intenção operacional futura.
- Evento = fato histórico executado.
- Demanda sanitária = leitura derivada, não agenda nem evento.
- Elegibilidade = cálculo derivado de animal + protocolo + eventos.
- Tags, sinais e insights = auxiliares, nunca fonte primária.
- Agenda sanitária antiga pode ser substituída.
- Dados antigos da agenda sanitária não precisam ser preservados, desde que documentado.
- Materialização de agenda não cria evento.
- Materialização de agenda não baixa estoque.
- Baixa de estoque ocorre apenas na execução real.
- `completed` sanitário depende de evento executado, não de agenda concluída.
- Agenda, preview e demanda agrupada não geram carência.
- Evento executado deve futuramente gravar snapshot da carência calculada.
- “Livre de carência”, “apto para abate” e “pronto para venda” seguem bloqueados como autorização operacional.
- RPC não deve ser caminho principal porque o app é offline-first.

---

## Subfases planejadas

- 11.5A — Diagnóstico + contrato alvo da Agenda Sanitária v2: concluída localmente.
- 11.5B0 — Contrato bibliográfico de regra sanitária e produto: concluída localmente.
- 11.5B1 — Motor puro de elegibilidade sanitária por janela: concluída localmente.
- 11.5B1.1 — Hardening de elegibilidade por dose múltipla e âncora por evento: concluída localmente.
- 11.5C — Demanda sanitária agrupada: concluída localmente.
- 11.5D — Preview sanitário editável: concluída localmente.
- 11.5E — Materialização idempotente da agenda sanitária: concluída localmente.
- 11.5F — Execução sanitária como evento: concluída localmente em escopo reduzido.
- 11.5G — Semântica final de fechamento da agenda: concluída localmente em core puro.
- 11.5H — Fechamento e handoff: concluída localmente como etapa documental.

---

## Resultado da 11.5C

- Core puro criado em `src/lib/sanitario/demand/sanitaryDemand.ts`.
- Testes focados criados em `src/lib/sanitario/demand/__tests__/sanitaryDemand.test.ts`.
- Demanda agrupada consome elegibilidades já calculadas ou chama `computeSanitaryEligibility` sem IO.
- Agrupamento considera protocolo, item/produto/classe, ação, lote, janela e status derivado.
- Nomes de produto e lote são campos de exibição, não identidade primária do grupo.
- `insufficient_data` permanece pendência de cadastro.
- `not_applicable` é contado e excluído da demanda acionável.
- Demanda permanece derivada e não materializa agenda, evento, baixa de estoque ou carência.

## Resultado da 11.5D

- Core puro criado em `src/lib/sanitario/preview/sanitaryOperationalPreview.ts`.
- Testes focados criados em `src/lib/sanitario/preview/__tests__/sanitaryOperationalPreview.test.ts`.
- Preview operacional é derivado de `SanitaryDemandGroup[]` recebido por parâmetro.
- Grupos operacionais são gerados apenas para demandas acionáveis.
- `insufficient_data` permanece bloqueio/cadastro pendente, com identidade operacional.
- `not_applicable` não entra como item operacional.
- `previewGroupId` e `sourceDemandKey` preservam protocolo, item, produto, classe, ação, lote e janela.
- Data sugerida respeita a janela quando possível.
- Campos editáveis são declarados sem persistência.
- Preview permanece simulação derivada, não agenda nem evento, com `materialization: "none"`.

## Resultado da 11.5E

- Core puro criado em `src/lib/sanitario/agenda/sanitaryAgendaMaterialization.ts`.
- Testes focados criados em `src/lib/sanitario/agenda/__tests__/sanitaryAgendaMaterialization.test.ts`.
- Materialização consome `SanitaryOperationalPreview` ou `SanitaryPreviewGroup[]` recebidos por parâmetro.
- Resultado gera comandos `agenda_intent`, não persistência em agenda.
- `dedupKey` usa protocolo, item, `productId`, `productClass`, ação, lote, data agendada, janela e animais ordenados.
- `dedupKey` separa `productId`/`productClass` e não usa `productName` nem `loteName`.
- Overrides permitem data, responsável e observação.
- Rejeições cobrem grupo sem animais, data ausente, data inválida e data fora da janela.
- Saída preserva `previewGroupId` e `sourceDemandKey`, é determinística e não muta inputs.
- Resultado declara `createsEvent: false` e `createsInventoryMovement: false`.
- Não houve Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch, seed, evento, baixa de estoque, carência ativa ou autorização de venda/abate.

## Resultado da 11.5F

- Core puro criado em `src/lib/sanitario/execution/sanitaryEventExecution.ts`.
- Testes focados criados em `src/lib/sanitario/execution/__tests__/sanitaryEventExecution.test.ts`.
- Resultado gera comando/intenção `event_execution_intent`, com `createsEvent: true` e `persistsEvent: false`.
- Execução pode partir de agenda materializada ou de protocolo explícito manual.
- `occurredAt` é obrigatório e validado.
- Animais executados são deduplicados e ordenados.
- Execução parcial exige motivo para animais planejados não executados.
- Execução vinculada rejeita animal fora do escopo planejado.
- `dedupKey` não usa `productName` nem `loteName`.
- Saída preserva `agendaDedupKey`, `previewGroupId` e `sourceDemandKey` quando houver origem.
- Resultado declara `createsAgenda: false`, `closesAgenda: false` e `createsInventoryMovement: false`.
- Não houve Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch, seed, persistência de evento, fechamento de agenda, baixa de estoque, carência ativa ou autorização de venda/abate.

## Resultado da 11.5G

- Core puro criado em `src/lib/sanitario/agenda/sanitaryAgendaClosure.ts`.
- Testes focados criados em `src/lib/sanitario/agenda/__tests__/sanitaryAgendaClosure.test.ts`.
- Resultado gera comando/intenção `agenda_closure_intent`, com `createsEvent: false`, `persistsEvent: false`, `createsHistoricalFact: false`, `createsInventoryMovement: false` e `calculatesWithdrawal: false`.
- Fechamento administrativo cobre execução total com evento, execução parcial com evento, fechamento sem execução, cancelamento e dispensa.
- Fechamentos executados exigem evento compatível com `agendaDedupKey`.
- Fechamentos sem execução, cancelamento e dispensa exigem motivo.
- Execução parcial preserva animais planejados não executados com motivo.
- Fechamentos sem execução rejeitam evento informado por engano.
- Fechamentos executados rejeitam animal executado fora do escopo planejado.
- Fechamento parcial rejeita execução total classificada como parcial.
- `closedAt` é obrigatório, validado e recebido por parâmetro.
- `dedupKey` não usa `productName` nem `loteName`.
- Não houve Supabase, Dexie, React, UI, storage, RPC, Edge Function, migration, schema, RLS, sync-batch, seed, persistência de agenda/evento, fechamento real no banco, baixa de estoque, carência ativa ou autorização de venda/abate.

## Resultado da 11.5H

- Fechamento documental da Fase 11.5 consolidado.
- Contratos 11.5A a 11.5G registrados como concluídos.
- Invariantes `Agenda = intenção`, `Evento = fato`, `state_* = read model` e `Protocolo = regra/configuração` preservados.
- `completed` sanitário depende de evento compatível, não de agenda concluída.
- Baixa de estoque depende de evento real.
- Carência depende de produto executado e fonte técnica explícita.
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` permanecem comandos/intenção de core puro, ainda sem aplicação em Supabase/Dexie/sync.
- Persistência, sync, schema, RLS, UI, RPC, Edge Functions, Dexie e seed seguiram fora do escopo.
- Fase 12 ainda não teve implementação funcional; 12A foi aberta apenas como auditoria documental.

## Escopo da execução atual

- Manter 12A como auditoria documental.
- Auditar fluxo legado de agenda antes de qualquer migration/constraint.
- Decidir explicitamente a direção de schema, dados legados, Dexie/local-first, sync-batch, Supabase/RLS, rollback/replay e idempotência real.
- Não aplicar contratos sanitários v2 em persistência/sync nesta subfase.

## Roadmap rebaselineado

1. Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout.
2. Fase 13 — Reprodução Operacional v1.
3. Fase 14 — Compra/Venda Operacional: Hardening e Lacunas.
4. Fase 15 — Relatórios/KPIs Operacionais Read-only Ampliados.
5. Fase 16 — Financeiro Gerencial Explícito.
6. Fase 17 — Motor de Decisão Assistida.
7. Fase 18 — Beta Externo / SLC / Hardening de Produto.

Justificativa:

- Compra/Venda depende da aplicação real da Agenda Sanitária v2 para não inferir histórico, estoque ou carência a partir de agenda.
- Reprodução é domínio estrutural ausente e precisa anteceder KPIs, financeiro e decisão assistida.
- KPIs e financeiro dependem de fontes consolidadas.
- Decisão assistida depende de dados confiáveis e limites explícitos.

## Escopo proibido nesta subfase

- Criar migrations.
- Alterar schema, RLS, sync-batch, Supabase, edge functions ou telas.
- Criar UI, persistir evento ou baixar estoque.
- Materializar agenda sem idempotência explícita.
- Calcular carência ativa ou autorizar venda/abate.
- Avançar para 12B sem fechar os critérios documentais da 12A.
- Atualizar profundamente docs permanentes de contexto, arquitetura ou sync.

## Riscos residuais para a próxima fase

- Contratos core ainda não estão conectados à persistência real.
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` ainda não são aplicados em Supabase/Dexie/sync.
- `status='concluido'` legado permanece semanticamente ambíguo até futura auditoria/migração.
- Integração offline-first exigirá idempotência real, replay, rollback e sucesso parcial.
- RLS/multi-tenant precisam ser validados antes de qualquer persistência remota.

---

## Validação registrada da 11.5B1/11.5B1.1

```bash
pnpm test -- src/lib/sanitario/eligibility
pnpm test
pnpm run lint
pnpm run build
git diff --check
git status --short --untracked-files=all
```

## Validação mínima antes da 11.5C

```bash
git diff --check
git status --short --untracked-files=all
```
