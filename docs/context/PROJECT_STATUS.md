# Project Status — RebanhoSync

Atualizado em: 2026-06-06
**Baseline Commit:** `91e0775`

## Objetivo

Registrar o estado vivo do projeto RebanhoSync em formato curto, operacional e útil para agentes, revisões e priorização.

Este documento não é changelog detalhado, auditoria histórica ou roadmap completo.

---

## Status atual

RebanhoSync está em beta interno, com MVP operacional.

A fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado — está concluída localmente.

Foi criada a fase extra 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente — antes da Fase 12.

A Fase 11.5 foi fechada localmente pela 11.5H, reconciliada documentalmente pela 11.5I e rebaselineada estrategicamente pela 11.5J. A Fase 12 foi aberta apenas em 12A documental/diagnóstica, sem implementação funcional.

Último gate validado:

- Fase 9A Inventário Operacional concluída localmente;
- unidade de compra/apresentação, unidade base e unidade de consumo/evento separadas;
- custo total, custo por entrada e custo unitário/base separados;
- baixa nutricional idempotente por evento/source validada local e remotamente;
- snapshot econômico preservado como derivado/read-only;
- Fase 9B Relatórios Operacionais de Custo Parcial concluída localmente;
- `inventory.partialCost` implementado como leitura derivada/read model;
- custo conhecido e custo ausente separados;
- `0` tratado como custo válido e `null`/`undefined` como custo ausente;
- baseline funcional Supabase passou após reset local;
- suite global `pnpm test` passou (260 arquivos, 1747 testes);
- lint e build passaram.

Último avanço local:

- Subfase 9C — Sociedade Patrimonial e Classificação Operacional Read-only concluída localmente;
- sociedade patrimonial mapeada em tipos, Dexie, pull/tableMap, migrations/RLS e Registrar;
- participação/sociedade e isolamento por `fazenda_id` confirmados;
- `classificationSnapshot` revisado como leitura/snapshot com `source` e `limitations`;
- teste de contrato adicionado para confirmar que classificação não expõe autorização de venda, abate ou carência;
- nenhum avanço para DRE, ROI, margem, custo por arroba, motor comercial avançado, carência liberatória ou autorização crítica.
- Subfase 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase executada;
- Fase 9 concluída localmente;
- Fase 10A — Diagnóstico UX e mapa de fricção concluída sem patch;
- Fase 10B — Agenda/Registrar: clareza de intenção futura vs execução real concluída localmente.
- Fase 10C — Home/Central Operacional concluída localmente.
- Fase 10D — Animal, Eventos e Histórico concluída localmente.
- Fase 10E — Integração via Histórico para Lotes/Pastos, Relatórios e Compra/Venda concluída localmente.
- Fase 10F — Fechamento da Fase 10 e handoff executada;
- Fase 10 — UX Operacional dos Fluxos Centrais concluída localmente.
- Fase 11A — Diagnóstico de Lotes, Pastos e Desempenho Operacional Ampliado concluída documentalmente.
- Fase 11B — Ajuste semântico/read-only do cockpit de Lotes/Pastos concluída localmente.
- Fase 11C — Ocupação, lotação e movimentações concluída localmente.
- Fase 11D — Desempenho read-only se houver fonte suficiente concluída localmente.
- Fase 11E — Relatórios operacionais ampliados concluída localmente.
- Fase 11F — Fechamento documental executada.
- Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado concluída localmente.
- Fase 11.5A — Diagnóstico + contrato alvo da Agenda Sanitária v2 concluída localmente.
- Fase 11.5B0 — Contrato bibliográfico de regra sanitária e produto concluída localmente.
- Fase 11.5B1 — Motor puro de elegibilidade sanitária por janela concluída localmente.
- Fase 11.5B1.1 — Hardening de dose múltipla e âncora por evento concluída localmente.
- Fase 11.5C — Demanda sanitária agrupada concluída localmente.
- Fase 11.5D — Preview operacional editável concluída localmente.
- Fase 11.5E — Materialização idempotente da agenda sanitária concluída localmente.
- Fase 11.5F — Execução sanitária como evento concluída localmente em escopo reduzido.
- Fase 11.5G — Semântica final de fechamento da agenda concluída localmente em core puro.
- Fase 11.5H — Fechamento e handoff concluída localmente como etapa documental.
- Fase 11.5I — Reconciliação de contratos normativos pós-Agenda Sanitária v2 concluída localmente.
- Fase 11.5J — Rebaseline estratégico do roadmap técnico executada documentalmente.
- Fase 12A — Auditoria do fluxo legado e decisão de schema da Agenda Sanitária v2 executada documentalmente em escopo reduzido.

Último avanço local da Fase 10:

- Home usa `Registrar execucao` como CTA principal;
- Home reforça que agenda é pendência e Registrar grava execução real;
- atalhos da Home indicam registro de evento executado, sem autorizar venda, abate ou carência;
- painel da Central explicita estados completo, parcial, vazio e bloqueado;
- sinais auxiliares seguem leitura read-only, sem persistir tags e sem autorização operacional;
- testes focados de Home e OperationalInsights passaram;
- nenhuma regra crítica nova foi criada;
- nenhum cálculo de insight/relatório foi alterado;
- nenhuma alteração em Supabase/RLS/migrations/RPC/sync.
- AnimalDetalhe diferencia `Estado atual` de histórico e reforça que status/classificação não autorizam venda ou abate;
- venda no detalhe do animal e quick action de Registrar aparecem como registro manual;
- Eventos explicita histórico de eventos executados e novo registro manual;
- nenhum cálculo de classificação, evento ou relatório foi alterado;
- nenhuma alteração em Supabase/RLS/migrations/RPC/sync.
- Lotes/Pastos reforçam estado atual/read model e histórico de movimentos/manejos executados;
- Relatórios reforçam leitura derivada/parcial, sem DRE, ROI, margem ou custo por arroba;
- Compra/Venda aparece como registro manual informado pelo usuário, sem recomendação ou autorização comercial;
- histórico operacional foi usado como ponte entre 10D e os fluxos finais da 10E;
- nenhum cálculo de relatório/insight/classificação foi alterado;
- nenhuma alteração em Supabase/RLS/migrations/RPC/sync.

Último avanço local da Fase 11:

- leituras de lote/pasto/desempenho preservam fonte explícita, período e limitação;
- `state_*` permanece estado atual/read model;
- eventos permanecem histórico/fato executado;
- `state_pasto_ocupacoes` permanece read model parcial de ocupação atual;
- GMD depende de pesagens explícitas válidas;
- GMD agregado de lote/pasto permanece parcial sem permanência comprovada no período;
- UA/ha depende de `area_ha` válida e peso explícito;
- relatórios operacionais ampliados declaram fonte, período e limitação;
- custo operacional parcial não é DRE, ROI, margem ou custo por arroba;
- nenhuma alteração em Supabase/RLS/migrations/RPC/schema/sync/edge functions.

Último avanço local da Fase 11.5:

- 11.5H fechou documentalmente a Agenda Sanitária v2;
- contratos 11.5A a 11.5G foram consolidados;
- `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` permanecem comandos/intenção de core puro;
- Agenda permanece intenção/tarefa futura;
- Evento permanece fato histórico executado;
- fechamento administrativo permanece estado da intenção, sem virar histórico sanitário;
- `completed` sanitário depende de evento compatível;
- baixa de estoque depende de evento real;
- carência depende de produto executado e fonte técnica explícita;
- venda, abate e aptidão operacional seguem bloqueados sem fonte técnica explícita;
- persistência, sync, schema, RLS, UI, RPC, Edge Functions, Dexie e seed continuam fora do implementado na 11.5;
- riscos residuais para persistência real, fluxo legado de agenda, `status='concluido'`, replay/rollback/idempotência e RLS/multi-tenant foram documentados.
- 11.5I alinhou docs normativos e skills de agente aos contratos da Agenda Sanitária v2.
- 11.5J reordenou o roadmap técnico para aplicar a fundação sanitária antes de Compra/Venda, KPIs, financeiro e decisão assistida.

Último avanço local da Fase 12:

- 12A documentou a auditoria do fluxo legado sanitário sem alterar código funcional;
- fluxo atual confirmado: `protocolos_sanitarios_itens -> sanitario_recompute_agenda_core -> agenda_itens/state_agenda_itens -> eventos/eventos_sanitario -> insumo_movimentacoes`;
- `status='concluido'` legado confirmado como ambíguo e insuficiente para `completed` sanitário v2;
- `source_evento_id` confirmado como vínculo factual quando há execução real;
- baixa de estoque permanece dependente de evento real;
- decisão recomendada de schema: criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória;
- dados factuais (`eventos`, `eventos_sanitario`, `insumo_movimentacoes`) não podem ser apagados em migration comum;
- dados antigos de agenda sanitária materializada por motor legado podem ser resetados/arquivados apenas em rollout controlado e documentado;
- testes sentinela futuros definidos para retry, replay, conflitos, RLS/FK, fechamento administrativo e preservação de dados factuais.

Próximo foco sugerido:

- fechar 12A com validações git obrigatórias;
- preparar 12B — Desenho técnico persistido e testes sentinela sem migration destrutiva;
- manter migrations, Dexie, sync-batch, RLS, RPC, UI e seed fora do escopo até decisão explícita de implementação.

Realidade validada para o roadmap pós-Fase 9:

- Fase 5 Sanitário/Exceções/Reconciliação: concluída; só hardening residual.
- Fase 6 Robustez Sanitária/RLS/sync: hardening residual, não fase de produto nova.
- Fase 7 Compra/Venda/Sociedade: parcial; tratar lacunas e hardening, não criação do zero.
- Fase 8 Relatórios/Baseline: parcial; base para KPIs operacionais read-only ampliados.
- Fase 9A e 9B: concluídas localmente.
- Fase 9C: concluída localmente.
- 9D: executada.
- Fase 9: concluída localmente.

Sequência corrigida pós-Fase 9:

1. Fase 10 — UX Operacional dos Fluxos Centrais: concluída localmente.
2. Fase 11 — Lotes, Pastos e Desempenho Operacional Ampliado: concluída localmente.
3. Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente: fechada localmente pela 11.5H, reconciliada pela 11.5I e rebaselineada pela 11.5J.
4. Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout: 12A documental/diagnóstica executada; implementação funcional não iniciada.
5. Fase 13 — Reprodução Operacional v1.
6. Fase 14 — Compra/Venda Operacional: Hardening e Lacunas.
7. Fase 15 — Relatórios/KPIs Operacionais Read-only Ampliados.
8. Fase 16 — Financeiro Gerencial Explícito.
9. Fase 17 — Motor de Decisão Assistida.
10. Fase 18 — Beta Externo / SLC / Hardening de Produto.

---

## Produto

RebanhoSync é um app agropecuário offline-first para gestão pecuária de corte.

Foco atual:

- produtor pequeno/médio;
- operação de campo;
- manejo prático;
- baixa fricção;
- funcionamento offline;
- sincronização confiável;
- gestão de rebanho, fazenda, agenda, eventos e rotinas.

Não é objetivo imediato virar ERP fiscal completo.

---

## Stack principal

- React;
- TypeScript;
- Vite;
- Dexie/IndexedDB;
- Supabase/Postgres/Auth/RLS;
- sync local-remoto por gestures/transações;
- Vitest/Testing Library;
- pnpm.

---

## Princípios técnicos atuais

- Offline-first.
- RLS como barreira real.
- Multi-tenant por `fazenda_id`.
- Operações idempotentes.
- Rollback determinístico quando aplicável.
- Separação entre UI, domínio, offline/sync e Supabase.
- Patches pequenos, reversíveis e testáveis.
- Não refatorar por conveniência.

---

## Contratos de domínio vigentes

- Agenda = intenção/tarefa futura.
- Evento = fato histórico executado.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Tags, sinais e insights = auxiliares de UX/consulta.
- Decisões críticas exigem fonte técnica explícita.

Detalhes:

- `docs/context/SOURCE_OF_TRUTH.md`
- `docs/context/KNOWN_GAPS.md`

---

## Áreas funcionais em foco

### Agenda

Papel:

- tarefas futuras;
- pendências;
- vencimentos;
- próximos manejos.

Risco principal:

- ser tratada indevidamente como histórico.

---

### Eventos

Papel:

- fatos executados;
- histórico;
- KPIs;
- auditoria.

Risco principal:

- evento sem detail suficiente ser tratado como resposta completa.

---

### Animais

Papel:

- cadastro;
- identidade;
- estado atual;
- origem/destino;
- status operacional.

Riscos principais:

- duplicidade de identidade;
- status atual sem evento/fonte adequada;
- inferência indevida de peso/venda/abate.

---

### Sanitário

Papel:

- agenda sanitária;
- registro operacional;
- produtos;
- protocolos;
- estoque/custo quando aplicável;
- compliance/regulatório como camada separada.

Riscos principais:

- protocolo como execução;
- agenda como histórico;
- carência inferida;
- compliance como bloqueio universal sem fonte explícita.

Estado validado em 2026-06-02:

- correção sanitária permanece append-only;
- replay corretivo usa `idempotency_key` determinístico;
- evento original não deve ser editado por correção;
- payload corretivo legado sem contrato completo fica parcial, com limitações explícitas.
