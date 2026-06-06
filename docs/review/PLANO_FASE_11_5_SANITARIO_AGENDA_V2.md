# Plano Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente

**Atualizado em:** 2026-06-06
**Status:** 11.5C concluída localmente / pronta para iniciar 11.5D
**Baseline documental de entrada:** `91e0775`
**Commit local de entrada:** `91e0775`

---

## 1. Objetivo

Redesenhar de forma controlada o fluxo sanitário `Protocolo → Agenda → Evento`, substituindo o contrato atual da Agenda Sanitária por um modelo baseado em:

```txt
Protocolo
→ janela operacional sanitária
→ elegibilidade individual
→ demanda sanitária agrupada
→ preview operacional editável
→ agenda materializada de forma idempotente
→ evento sanitário executado

```

A Fase 11.5 é uma fase extra entre a Fase 11 e a Fase 12.
A Fase 12 permanece bloqueada até fechamento formal da 11.5.

---

## 2. Decisão arquitetural

A proposta original identificou riscos reais, mas a ordem de implementação precisa preservar segurança contratual antes de UX.
A Fase 11.5 deixa de ser apenas hardening conservador e passa a ser uma evolução estrutural controlada da Agenda Sanitária.

**Decisão**

**Autorizar:**

* redesenho do contrato da Agenda Sanitária;
* mudança de schema se tecnicamente necessária;
* substituição do contrato antigo da agenda sanitária;
* descarte/reset de dados sanitários de agenda em ambiente controlado;
* criação de modelo baseado em janela sanitária, elegibilidade, demanda agrupada e materialização idempotente;
* revisão de tipos, stores, seeds, testes e documentação.

**Manter obrigatório:**

* offline-first;
* idempotência;
* rastreabilidade;
* isolamento por fazenda;
* multi-tenant/RLS;
* separação entre regra, intenção e fato.

**Proibido:**

* tratar agenda como histórico;
* tratar agenda concluída como evento executado;
* criar evento sem execução real;
* baixar estoque no planejamento;
* criar carência liberatória;
* criar venda, abate ou aptidão automática;
* transformar tag/sinal/insight em regra crítica.

---

## 3. Problema operacional

O modelo atual tende a tratar protocolos sanitários como datas exatas. Isso é inadequado para a rotina de fazenda.

**Exemplo:**

> Brucelose: fêmeas bovinas entre 3 e 8 meses.

Essa regra não significa “vacinar em um dia exato”. Ela define uma janela operacional.

O app deve apoiar o produtor a:

* identificar animais que entrarão em janela;
* quantificar animais já elegíveis;
* sinalizar animais próximos ao limite;
* identificar atrasados;
* agrupar demanda por lote/protocolo/janela;
* programar manejo em data operacional escolhida;
* registrar execução real como evento.

O app não deve induzir vacinação animal-a-animal diária quando houver possibilidade de agrupamento operacional.

---

## 4. Contrato conceitual

**Antes**

```txt
Protocolo → data exata → item de agenda sanitária

```

**Depois**

```txt
Protocolo
→ contrato bibliográfico/legal/bula da regra e produto
→ janela sanitária
→ elegibilidade individual
→ demanda agrupada
→ preview operacional
→ agenda materializada
→ evento executado

```

---

## 5. Princípios obrigatórios

| Conceito | Regra |
| --- | --- |
| **Protocolo** | Regra/configuração sanitária. Não é execução. |
| **Fonte técnica** | Referência bibliográfica, norma oficial, bula ou MV responsável para campo crítico. |
| **Produto sanitário** | Fonte primária de dose, via, apresentação e carência quando houver produto vinculado. |
| **Janela sanitária** | Período operacional recomendado/limite para ação. |
| **Elegibilidade** | Cálculo derivado de animal + protocolo + eventos executados. |
| **Demanda sanitária** | Leitura derivada de elegibilidade, lote e janela. Não é agenda nem evento. |
| **Preview** | Simulação operacional antes de materializar agenda. Não cria evento. |
| **Agenda** | Intenção operacional futura materializada. |
| **Evento** | Fato histórico executado. |
| **`state_*`** | Estado atual/read model. |
| **Tags/sinais/insights** | Auxiliares visuais/consulta. Não são fonte primária. |

**Regras críticas:**

* `completed` sanitário depende de evento executado, não de agenda concluída.
* Agenda concluída não prova execução sanitária.
* Produto é fonte primária de dose, via, apresentação e carência.
* Protocolo pode exigir produto específico ou classe de produto.
* Carência deve ser primariamente vinculada ao produto; protocolo pode complementar quando houver fonte explícita.
* Evento executado deve futuramente gravar snapshot da carência calculada.
* Agenda, preview e demanda agrupada não geram carência.
* Baixa de estoque ocorre apenas na execução real.
* Materialização de agenda não cria evento.
* Materialização de agenda não baixa estoque.
* Tags, sinais e insights não são fonte de carência.
* “Livre de carência”, “apto para abate” e “pronto para venda” continuam bloqueados como autorização operacional.
* RPC não deve ser caminho principal por causa do offline-first.

---

## 6. Escopo permitido

* Diagnosticar o contrato atual da Agenda Sanitária.
* Definir contrato alvo da Agenda Sanitária v2.
* Definir contrato bibliográfico/legal/bula para regra sanitária e produto antes do motor de elegibilidade.
* Modelar janela operacional sanitária.
* Criar motor puro de elegibilidade sanitária.
* Criar demanda sanitária agrupada.
* Criar preview operacional editável.
* Criar materialização idempotente de agenda.
* Separar execução sanitária real como evento.
* Revisar semântica de fechamento da agenda.
* Alterar schema/migrations se a 11.5A justificar.
* Usar migration destrutiva se houver decisão documentada.
* Atualizar tipos, stores, seeds, testes e documentação.
* Criar teste sentinela obrigatório de retry/offline/sync.

---

## 7. Escopo proibido

* Implementar UI antes da 11.5A.
* Criar migration antes do diagnóstico.
* Alterar schema sem contrato alvo documentado.
* Alterar RLS sem necessidade explícita.
* Alterar sync-batch antes de provar lacuna.
* Tratar agenda como histórico executado.
* Tratar agenda concluída como evento.
* Criar evento sem execução real.
* Baixar estoque na materialização da agenda.
* Criar carência liberatória.
* Criar aptidão para venda ou abate.
* Criar venda ou abate automático.
* Criar recomendação sanitária crítica automática sem fonte técnica.
* Usar tag, sinal ou insight como fonte primária.
* Colocar regra técnica em modal, página ou hook.
* Usar RPC como caminho principal.
* Gerar múltiplas agendas animal-a-animal por padrão quando houver agrupamento possível.
* Duplicar o protocolo completo dentro da agenda.

---

## 8. Subfases

### 11.5A — Diagnóstico + contrato alvo da Agenda Sanitária v2

**Status:** concluída localmente em 2026-06-05.

**Objetivo**
Mapear o contrato atual Protocolo → Agenda → Evento, definir o contrato alvo da Agenda Sanitária v2 e criar/reforçar teste sentinela de retry/offline/sync.

**Escopo**
Auditar:

* `source_evento_id`;
* `dedup_key`;
* `client_op_id`;
* `queue_ops`;
* `sync-batch`;
* criação de evento;
* materialização/conclusão de agenda;
* baixa de estoque;
* status atual da agenda;
* semântica de `concluido`;
* pontos onde agenda pode estar sendo usada como histórico.

Definir:

* o que será descartado;
* o que será preservado;
* se haverá migration/reset;
* contrato alvo v2;
* critérios mínimos de idempotência;
* riscos de regressão;
* plano incremental para 11.5B.

**Entregáveis**

* diagnóstico do contrato atual;
* lista de tabelas, stores, tipos, hooks, telas e testes afetados;
* decisão explícita sobre descarte/migração da agenda sanitária antiga;
* contrato alvo documentado;
* teste sentinela de retry/offline/sync;
* plano incremental para 11.5B.

**Critérios de aceite**

* contrato alvo documentado;
* uso atual de `concluido` documentado;
* risco de duplicidade confirmado ou descartado;
* retry da mesma operação não duplica agenda;
* retry da mesma operação não duplica evento;
* retry da mesma operação não duplica baixa de estoque, se aplicável;
* `client_op_id`, `dedup_key` e `source_evento_id` preservados quando aplicável;
* nenhuma UI implementada;
* nenhum motor de elegibilidade implementado;
* nenhuma migration criada sem justificativa.

#### Resultado 11.5A

Escopo executado:

* diagnóstico do contrato atual `Protocolo -> Agenda -> Evento`;
* contrato alvo v2 documentado;
* estratégia destrutiva/controlada documentada;
* teste sentinela de retry/offline/sync reforçado;
* nenhuma UI, migration, schema, RPC, materialização, preview ou motor de elegibilidade implementado.

##### Diagnóstico do contrato atual

Fluxo atual confirmado:

```txt
protocolos_sanitarios_itens
-> sanitario_recompute_agenda_core / sanitario_recompute_agenda_for_fazenda
-> agenda_itens / state_agenda_itens
-> sanitario_complete_agenda_with_event ou INSERT eventos via sync-batch
-> eventos + eventos_sanitario
-> insumo_movimentacoes somente quando o registro de evento pede baixa
```

Pontos confirmados:

* `agenda_itens` mistura agenda sanitária, agenda de outros domínios e pendências corretivas, com `dominio`, `tipo`, `status`, `data_prevista`, `animal_id`, `lote_id`, `dedup_key`, `source_kind`, `source_ref`, `source_evento_id`, `protocol_item_version_id`, `interval_days_applied` e `payload`.
* `status` persistido atual é apenas `agendado | concluido | cancelado`; `concluido` ainda mistura fechamento operacional com conclusão por execução, embora o fluxo sanitário correto exija `source_evento_id`.
* `source_evento_id` é o vínculo factual quando uma agenda é encerrada por execução real. Agenda sem `source_evento_id` não prova execução sanitária. Agenda concluída sem `source_evento_id` não é fato histórico confiável.
* `dedup_key` é usado na materialização sanitária automática; índice parcial `ux_agenda_dedup_active` protege apenas agenda aberta (`status='agendado'`, não deletada).
* Recompute SQL materializa agenda sanitária e evita recriar item quando já existe agenda concluída com `source_evento_id` e evento sanitário válido, ou quando existe evento sanitário com `payload.sanitary_completion.sanitary_completion_key`.
* `client_op_id` é metadado obrigatório de sync; o baseline cria índices únicos por `client_op_id` nas tabelas com coluna correspondente, e `sync-batch` normaliza violação única genérica como `APPLIED`.
* A conclusão sanitária direta por agenda ainda usa RPC `sanitario_complete_agenda_with_event`, que cria `eventos`, cria `eventos_sanitario`, marca `agenda_itens.status='concluido'`, grava `source_evento_id` e chama recompute. Isso é transacional, mas não é o caminho alvo principal da v2 por ser RPC-first.
* `sync-batch` aceita `agenda_itens`, `eventos`, `eventos_sanitario` e `insumo_movimentacoes`, força `fazenda_id`, valida duplicidade de agenda já concluída por evento, aplica mutação e trata `23505`.
* Baixa de estoque sanitário não nasce de agenda. Ela nasce de evento sanitário real quando `buildEventGesture` adiciona `insumo_movimentacoes` via `buildConsumoMovimentacaoOp`, com `source_evento_id` igual ao evento e `id` determinístico igual ao `eventId`.
* `state_agenda_itens` é a store local de leitura/materialização da agenda. `queue_ops` guarda operações pendentes por `client_op_id`, `client_tx_id` e `fazenda_id`.

Lacunas do contrato atual:

* protocolo ainda tende a ser traduzido em data exata por animal, não em janela operacional agrupável;
* `agenda_itens` não separa janela, demanda agrupada, preview e agenda materializada;
* `concluido` é insuficiente para distinguir execução real, cancelamento, dispensa e fechamento administrativo;
* o contrato sanitário ainda depende de RPC para conclusão direta da agenda;
* o índice de dedup atual protege agenda aberta, mas a v2 precisará deduplicar materialização agrupada de preview confirmado;
* demanda sanitária calculada ainda não existe como leitura derivada separada da agenda;
* não há contrato persistido de preview/editabilidade/exclusões antes da materialização.

##### Contrato alvo v2

Contrato alvo:

```txt
Protocolo/regra
-> janela operacional sanitária
-> elegibilidade individual derivada
-> demanda sanitária agrupada derivada
-> preview operacional editável
-> agenda materializada idempotente
-> evento sanitário executado
-> fechamento administrativo da agenda
```

Separação obrigatória:

| Camada | Papel | Persistência alvo |
| --- | --- | --- |
| Protocolo/regra | regra versionada, fonte de calendário, produto, dose e janela | `protocolos_sanitarios` / `protocolos_sanitarios_itens` |
| Janela sanitária | início/fim operacional derivado da regra e da referência técnica | snapshot mínimo na demanda/preview/agenda materializada |
| Elegibilidade | cálculo puro por animal + protocolo + eventos executados | não persistir como fonte primária; pode alimentar read model derivado |
| Demanda agrupada | leitura derivada por lote/protocolo/item/janela/status | derivada/recalculável, não evento e não agenda |
| Preview | simulação editável antes de confirmar planejamento | contrato local ou tabela futura de planejamento, sem evento e sem baixa |
| Agenda materializada | intenção futura confirmada pelo usuário ou regra operacional | agenda v2 ou `agenda_itens` redesenhada, com `dedup_key` determinístico |
| Evento executado | fato histórico do manejo realizado | `eventos` + `eventos_sanitario` |
| Fechamento administrativo | encerramento/cancelamento/dispensa da intenção | status próprio com motivo, sem virar execução |

Regras alvo:

* `completed` sanitário depende somente de evento sanitário compatível.
* Agenda materializada não cria evento.
* Agenda materializada não baixa estoque.
* Preview não cria agenda automaticamente.
* Demanda agrupada é recalculável e não deve ser fonte de histórico.
* Evento pode referenciar agenda/demanda/preview, mas continua fonte histórica.
* Baixa de estoque ocorre somente na execução real e deve ser idempotente por evento/source.
* Fechamento administrativo deve exigir motivo quando não houver execução.
* RPC pode permanecer apenas como compatibilidade temporária, reconciliação ou administração, não caminho principal offline-first.

##### Dados, tabelas e stores que podem ser apagados/resetados

Autorizado para v2, desde que em migration/reset explícito:

* apagar dados antigos de agenda sanitária em `agenda_itens` onde `dominio='sanitario'` e origem seja materialização antiga;
* preservar ou recriar separadamente pendências corretivas sanitárias vinculadas a ocorrência real quando a subfase correspondente decidir o contrato;
* resetar `state_agenda_itens` local para itens sanitários antigos;
* limpar `queue_ops`/`queue_gestures` pendentes que apontem para o contrato antigo de agenda sanitária durante janela controlada de rollout/reset;
* recriar seeds/dados demo de agenda sanitária;
* remover payloads/dedup legados de agenda sanitária se a v2 substituir o schema;
* manter eventos históricos (`eventos`, `eventos_sanitario`) e baixas já executadas (`insumo_movimentacoes`) como fatos, salvo ambiente demo/resetado explicitamente.

Não apagar como parte da agenda v2:

* `eventos` e detail tables que representem fato executado real;
* `insumo_movimentacoes` já vinculadas a evento real;
* protocolos versionados usados por eventos históricos, salvo seed/demo controlado;
* catálogos oficiais/regulatórios.

##### Migrations/resets recomendados para 11.5E/11.5G

Recomendações destrutivas/controladas:

* migration para remover ou arquivar agenda sanitária antiga de `agenda_itens` (`dominio='sanitario'`) antes da primeira materialização v2;
* migration para substituir `agenda_status_enum` ou criar novo status sanitário compatível com `aberta`, `programada`, `concluido_executado`, `cancelado`, `dispensado`, `fechado_sem_execucao`;
* nova constraint futura: `concluido_executado` exige `source_evento_id`, mas somente após remover/limpar legado;
* índice único novo para materialização v2 por `fazenda_id` + `dedup_key` de agenda planejada agrupada, cobrindo o status aberto/programado;
* revisão de FKs compostas por `fazenda_id` em novos vínculos de planejamento/preview, se novas tabelas forem criadas;
* migration/local Dexie para reset controlado de `state_agenda_itens` sanitário e, se houver nova store v2, bump de schema local;
* seeds v2 devem criar protocolo, demanda/preview ou agenda demo coerente com janela, sem criar evento nem baixa automaticamente.

##### Arquivos, tipos, telas e testes afetados

Áreas afetadas pelo redesenho:

* Supabase: `agenda_itens`, `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, `protocolos_sanitarios`, `protocolos_sanitarios_itens`, `sanitario_recompute_agenda_core`, `sanitario_complete_agenda_with_event`, `sanitario_recompute_agenda_for_fazenda`.
* Sync/offline: `src/lib/offline/db.ts`, `src/lib/offline/types.ts`, `src/lib/offline/tableMap.ts`, `src/lib/offline/ops.ts`, `src/lib/offline/syncWorker.ts`, `supabase/functions/sync-batch/**`.
* Agenda: `src/lib/agenda/**`, `src/pages/Agenda/**`, `src/pages/Agenda/createAgendaActionController.ts`.
* Sanitário: `src/lib/sanitario/engine/**`, `src/lib/sanitario/infrastructure/**`, `src/lib/sanitario/operations/**`, `src/lib/sanitario/compliance/**`.
* Registrar/Eventos/Estoque: `src/pages/Registrar/**`, `src/lib/events/buildEventGesture.ts`, `src/lib/inventory/consumoGesture.ts`, `src/pages/Eventos.tsx`, `src/pages/Insumos.tsx`.
* Tipos atuais candidatos a mudança: `AgendaItem`, `AgendaStatusEnum`, `ProtocoloSanitarioItem`, `Evento`, `EventoSanitario`, `InsumoMovimentacao`, `Operation`, `SyncOperationResult`.
* Testes relacionados: `supabase/functions/sync-batch/rules.test.ts`, `src/lib/sanitario/__tests__/executionBoundary.test.ts`, `src/lib/sanitario/__tests__/sanitarioRecomputeAgendaCore.test.ts`, `src/pages/Agenda/__tests__/**`, `tests/integration/flows/**`, `tests/smoke/agenda_registrar_conclusao.smoke.test.ts`.

##### Teste sentinela

Teste reforçado:

* `supabase/functions/sync-batch/rules.test.ts`
* caso: `sentinela 11.5A: retry offline nao duplica agenda, evento sanitario nem baixa de estoque`

Comportamento documentado:

* retry de agenda por colisão de `dedup_key` retorna `APPLIED_ALTERED` com `dedup: collision_noop`;
* retry de evento sanitário por violação única genérica retorna `APPLIED`;
* retry de detail `eventos_sanitario` por PK retorna `APPLIED`;
* retry de `insumo_movimentacoes` por violação única retorna `APPLIED`.

Esse teste documenta a idempotência atual no envelope de sync. Ele não implementa materialização v2.

##### Riscos de regressão

* Quebrar fluxos não sanitários se `agenda_itens` for alterada sem separar `dominio`.
* Perder pendências corretivas sanitárias reais se o reset filtrar apenas por `dominio='sanitario'` sem separar origem.
* Manter RPC como caminho principal e violar offline-first se a v2 não deslocar materialização/execução para gesto local idempotente.
* Recriar agenda animal-a-animal e perder o objetivo de agrupamento por janela.
* Tratar fechamento administrativo como execução e inflar histórico, carência, custo ou baixa.

##### Plano incremental para 11.5B0

Próximo passo permitido:

* documentar contrato bibliográfico/legal/bula para regra sanitária e produto;
* separar fonte técnica por campo crítico: período de elegibilidade, intervalos, reforços, janelas de permissibilidade, critério de conclusão, produto, dose, via e carência;
* registrar que guideline é fonte técnica de apoio, não fonte única de verdade;
* exigir validação por norma oficial, bula ou MV responsável quando a regra for crítica;
* manter carência vinculada primariamente ao produto;
* preparar o motor de elegibilidade para retornar limitação/bloqueio quando faltar fonte explícita.

### 11.5B0 — Contrato bibliográfico de regra sanitária e produto

**Status:** concluída localmente em 2026-06-05.

**Objetivo**
Definir o contrato conceitual e técnico que permitirá ao motor de elegibilidade usar regras sanitárias rastreáveis por fonte bibliográfica, legal, bula ou MV responsável, sem transformar guideline genérico em fonte única de verdade.

**Motivo**
Antes de calcular elegibilidade por janela, o sistema precisa saber quais campos críticos têm fonte explícita e qual é o papel do produto sanitário no cálculo de dose, via, apresentação e carência.

**Análise de guideline como fonte técnica**

* Guideline técnico pode apoiar modelagem inicial, nomenclatura e hipóteses de janela.
* Guideline não é fonte única de verdade para regra crítica.
* Regra crítica deve ser validada por norma oficial, bula do produto, referência bibliográfica aceita ou MV responsável.
* Campo crítico sem fonte explícita deve retornar limitação ou bloqueio, não regra operacional silenciosa.
* Divergência entre guideline, norma, bula e MV responsável deve ser registrada como limitação até decisão técnica explícita.

**Campos críticos cobertos**

* período de elegibilidade;
* intervalos entre doses;
* reforços;
* janelas de permissibilidade;
* critérios de conclusão;
* produto sanitário vinculado;
* classe de produto permitida quando produto específico não for obrigatório;
* dose, via e apresentação;
* carência vinculada ao produto/protocolo;
* fonte bibliográfica/legal/bula/MV responsável por campo crítico.

**Contratos conceituais**

```typescript
type SourceRef = {
  kind: "norma_oficial" | "bula" | "bibliografia" | "mv_responsavel" | "guideline_apoio";
  title: string;
  issuer?: string;
  version?: string;
  url?: string;
  accessedAt?: string;
  fieldKeys: string[];
  limitation?: string;
};

type SanitaryProduct = {
  id?: string;
  name: string;
  classKey?: string;
  activeIngredient?: string;
  presentation?: string;
  dose?: {
    quantity: number;
    unit: string;
    per?: "animal" | "kg_peso_vivo" | "dose";
  };
  route?: string;
  withdrawalRules: WithdrawalRule[];
  sourceRefs: SourceRef[];
};

type WithdrawalRule = {
  species?: string;
  aptitude?: "corte" | "leite" | "mista";
  meatDays?: number | null;
  milkDays?: number | null;
  sourceRefs: SourceRef[];
  limitations?: string[];
};

type SanitaryProtocolRule = {
  id: string;
  name: string;
  eligibilityWindow?: {
    start: { anchor: "nascimento" | "evento" | "entrada_lote" | "manual"; offsetDays: number };
    end?: { anchor: "nascimento" | "evento" | "entrada_lote" | "manual"; offsetDays: number };
    permissibility?: "recommended" | "allowed" | "limit";
    sourceRefs: SourceRef[];
  };
  doseIntervals?: Array<{
    fromDose: number;
    toDose: number;
    minDays?: number;
    recommendedDays?: number;
    maxDays?: number;
    sourceRefs: SourceRef[];
  }>;
  boosters?: Array<{
    afterDays?: number;
    recurringEveryDays?: number;
    sourceRefs: SourceRef[];
  }>;
  completionCriteria: {
    requiresExecutedEvent: true;
    compatibleProductId?: string;
    compatibleProductClass?: string;
    requiredDoseCount?: number;
    sourceRefs: SourceRef[];
  };
  productRequirement?: {
    kind: "specific_product" | "product_class";
    productId?: string;
    classKey?: string;
    sourceRefs: SourceRef[];
  };
  limitations?: string[];
};

type WithdrawalSnapshotOnEvent = {
  productId?: string;
  productNameSnapshot: string;
  protocolRuleId?: string;
  meatWithdrawalDays?: number | null;
  milkWithdrawalDays?: number | null;
  meatWithdrawalUntil?: string | null;
  milkWithdrawalUntil?: string | null;
  calculatedAt: string;
  sourceRefs: SourceRef[];
  limitations?: string[];
};
```

**Regras**

* Protocolo é regra/configuração, não execução.
* Produto é fonte primária de dose, via, apresentação e carência.
* Carência deve ser primariamente vinculada ao produto.
* Protocolo pode exigir produto específico ou classe de produto.
* Protocolo pode complementar carência apenas quando houver fonte explícita compatível.
* Evento executado deve futuramente gravar `WithdrawalSnapshotOnEvent`.
* Agenda não gera carência.
* Preview não gera carência.
* Demanda agrupada não gera carência.
* Tags, sinais e insights não são fonte de carência.
* `completed` sanitário depende de evento executado.
* “Livre de carência”, “apto para abate” e “pronto para venda” continuam bloqueados como autorização operacional.

**Critérios de aceite**

* regra crítica sem fonte explícita retorna limitação ou bloqueio;
* carência está vinculada primariamente ao produto;
* evento futuro deve carregar snapshot de carência calculada;
* agenda, materialização, preview e demanda agrupada não geram carência;
* guideline está documentado como fonte técnica de apoio, não fonte única de verdade;
* necessidade de norma oficial, bula ou MV responsável está explícita para campos críticos.

**Não implementar nesta subfase**

* motor de elegibilidade;
* UI;
* schema;
* migrations;
* RLS;
* sync-batch;
* seeds;
* cálculo de carência em runtime.

**Resultado 11.5B0**

Contratos puros criados em `src/lib/sanitario/rules/sanitaryProtocolRule.ts`:

* `SourceRef`;
* `SanitaryProduct`;
* `WithdrawalRule`;
* `SanitaryProtocolRule`;
* `WithdrawalSnapshotOnEvent`.

Validações puras criadas:

* `validateSanitaryProtocolRule`;
* `validateSanitaryProduct`;
* `validateWithdrawalSnapshotOnEvent`.

Regras validadas localmente:

* regra crítica sem fonte explícita retorna bloqueio;
* guideline isolado não valida campo crítico como fonte forte;
* carência declarada no produto exige fonte;
* carência declarada no produto sem espécie ou finalidade mínima retorna limitação;
* protocolo que exige produto deve declarar `productRequirement`;
* `completionCriteria.requiresExecutedEvent` deve permanecer `true`;
* snapshot futuro de carência no evento preserva fonte técnica;
* contrato não importa Supabase, Dexie, React, UI ou agenda.

Nenhum motor de elegibilidade, demanda, preview, materialização, evento, cálculo runtime de carência, UI, migration, schema, RLS, sync-batch, seed, RPC, persistência, Supabase ou Dexie foi implementado.

### 11.5B1 — Motor puro de elegibilidade sanitária por janela

**Status:** concluída localmente em 2026-06-06, com hardening 11.5B1.1 aplicado.

**Objetivo**
Calcular elegibilidade sanitária por janela de ação, sem IO e sem UI.

**Arquivos criados**

* `src/lib/sanitario/eligibility/sanitaryEligibility.ts`
* `src/lib/sanitario/eligibility/__tests__/sanitaryEligibility.test.ts`

**Função conceitual**

```typescript
computeSanitaryEligibility({
  animal,
  protocolRule,
  executedEvents,
  referenceDate,
  thresholds
});

```

**Status propostos**

```typescript
type SanitaryEligibilityStatus =
  | "not_applicable"
  | "insufficient_data"
  | "not_yet_eligible"
  | "eligible_soon"
  | "in_action_window"
  | "near_deadline"
  | "overdue"
  | "completed";

```

**Regras**

* `completed` depende de evento sanitário compatível.
* `completed` não pode depender de agenda concluída.
* `overdue` deve ser cálculo derivado.
* `eligible_soon` exige threshold explícito.
* `near_deadline` exige threshold explícito.

**O motor não pode fazer:**

* IO;
* Supabase;
* Dexie;
* UI;
* `Date.now`;
* persistência;
* geração de agenda;
* geração de evento.

**Limitações obrigatórias**
O motor deve retornar limitações explícitas quando houver baixa confiança:

```typescript
type SanitaryEligibilityLimitation =
  | "missing_birth_date"
  | "invalid_birth_date"
  | "estimated_age"
  | "missing_sex"
  | "missing_species"
  | "missing_lote"
  | "missing_protocol_window"
  | "invalid_protocol_rule"
  | "invalid_reference_date"
  | "invalid_event_date"
  | "insufficient_event_history"
  | "missing_anchor_event"
  | "missing_anchor_event_criteria"
  | "ambiguous_anchor_event"
  | "unsupported_required_dose_count";

```

**Resultado 11.5B1 / 11.5B1.1**

Motor puro criado em `src/lib/sanitario/eligibility/sanitaryEligibility.ts`, com testes em `src/lib/sanitario/eligibility/__tests__/sanitaryEligibility.test.ts`.

Regras implementadas:

* entrada normalizada baseada em `SanitaryProtocolRule`, animal, eventos sanitários executados, data de referência e thresholds explícitos;
* `completed` depende apenas de evento sanitário compatível, executado, não cancelado/deletado, do mesmo animal e não futuro em relação à `referenceDate`;
* agenda concluída, campos estranhos de agenda e qualquer intenção futura não completam protocolo;
* aplicabilidade por sexo, espécie, categoria e lote retorna `not_applicable` apenas quando há incompatibilidade real;
* ausência de dado necessário retorna `insufficient_data` com limitação explícita;
* janelas por nascimento, entrada de lote, âncora manual e evento são resolvidas sem IO e sem `Date.now`;
* janela com âncora por evento exige `anchorEventCriteria` efetivo; critério ausente ou `{}` retorna `missing_anchor_event_criteria`;
* evento âncora ausente ou ambíguo retorna limitação própria;
* datas inválidas de nascimento, referência e evento são bloqueadas;
* thresholds alteram `eligible_soon` e `near_deadline`;
* `requiredDoseCount > 1` não retorna `completed` por contagem genérica de eventos compatíveis; enquanto não houver validação explícita de sequência de doses, retorna `unsupported_required_dose_count`;
* função não muta inputs.

Testes cobrem:

* `not_yet_eligible`, `eligible_soon`, `in_action_window`, `near_deadline`, `overdue` e `completed`;
* evento incompatível, futuro, cancelado/deletado ou de outro animal não completa;
* animal fora de aplicabilidade não completa mesmo com evento compatível;
* falta de nascimento, sexo, espécie, janela e âncora retorna limitação;
* idade estimada sinaliza limitação sem bloquear por si só;
* `requiredDoseCount > 1` com eventos genéricos não completa e retorna `unsupported_required_dose_count`;
* `anchorEventCriteria: {}` retorna `insufficient_data` e `missing_anchor_event_criteria`;
* ausência de imports/uso de agenda, Supabase, Dexie, React, UI, storage, RPC, `.at()` e `Date.now()`.

Validações registradas:

```bash
pnpm test -- src/lib/sanitario/eligibility
pnpm test
pnpm run lint
pnpm run build
git diff --check
git status --short --untracked-files=all
```

Nenhuma demanda agrupada, preview, materialização de agenda, evento, baixa de estoque, carência ativa, UI, schema, migration, RLS, sync-batch, Supabase, Dexie, worker ou read model foi implementado.

### 11.5C — Demanda sanitária agrupada

**Status:** concluída localmente em 2026-06-06.

**Objetivo**
Transformar elegibilidades individuais em demanda operacional por fazenda, protocolo, item, lote, categoria e janela.

**Fluxo**

```txt
Protocolo detecta animais elegíveis
→ app quantifica demanda por lote/protocolo/janela
→ produtor escolhe data de manejo
→ agenda materializa manejo agrupado
→ evento registra execução real

```

**Exemplo**

> Brucelose — Bezerras 2026
> * 18 em janela agora
> * 7 entram nos próximos 15 dias
> * 3 próximas ao limite
> * 1 atrasada
> * 62 já concluídas no ciclo
>
>
> Sugestão: manejo agrupado em 20/06/2026

**Estrutura conceitual**

```typescript
type SanitaryDemandGroup = {
  protocolId: string;
  protocolItemId: string;
  protocolName?: string;

  loteId?: string;
  loteName?: string;

  windowStart: string;
  windowEnd: string;
  suggestedHandlingDate?: string;

  statusSummary: {
    totalApplicable: number;
    completed: number;
    notYetEligible: number;
    eligibleSoon: number;
    inActionWindow: number;
    nearDeadline: number;
    overdue: number;
  };

  animalIdsPreview?: string[];
  totalAnimalIds?: number;

  source: {
    protocolSource: "protocolos_sanitarios_itens";
    animalSource: "state_animais";
    eventSource: "eventos";
  };

  limitations: SanitaryEligibilityLimitation[];
};

```

**Regras**

* Demanda não é agenda.
* Demanda não é evento.
* Demanda pode ser recalculada.
* Demanda deve preservar rastreabilidade de animais elegíveis.
* Agrupamento padrão deve evitar geração animal-a-animal.
* Exclusões devem exigir motivo quando houver preview/materialização.

**Resultado 11.5C**

Core puro criado em `src/lib/sanitario/demand/sanitaryDemand.ts`, com testes em `src/lib/sanitario/demand/__tests__/sanitaryDemand.test.ts`.

Regras implementadas:

* `createSanitaryDemandGroupsFromEligibilityResults` agrupa elegibilidades já calculadas.
* `computeSanitaryDemandGroups` pode chamar `computeSanitaryEligibility`, mantendo core puro, sem IO e com `referenceDate` recebido por parâmetro.
* Agrupamento considera protocolo, item/produto/classe, ação, lote, janela e status derivado.
* `productName` e `loteName` são preservados como campos de exibição, mas não entram na identidade primária do grupo.
* `insufficient_data` é preservado como pendência de cadastro.
* `not_applicable` é contado, mas não entra em `actionableAnimalIds`.
* Status acionáveis são `eligible_soon`, `in_action_window`, `near_deadline` e `overdue`.
* Limitações agregadas são deduplicadas.
* Saída é determinística e não muta inputs.
* Demanda permanece leitura derivada, não agenda e não evento, com `materialization: "none"`.

Testes cobrem:

* agrupamento por protocolo e lote;
* agrupamento por item/produto/classe;
* separação por janela;
* preservação de `insufficient_data`;
* exclusão de `not_applicable` da demanda acionável;
* soma de `completed`, `overdue`, `near_deadline`, `in_action_window` e `eligible_soon`;
* deduplicação de limitações;
* saída determinística;
* não fragmentar grupo quando apenas nomes de lote/produto divergem para o mesmo ID;
* ausência de agenda/evento/materialização;
* ausência de Supabase, Dexie, React, UI, storage e `Date.now()`;
* imutabilidade dos inputs.

Validações registradas:

```bash
pnpm test -- src/lib/sanitario/demand
pnpm test
pnpm run lint
pnpm run build
git diff --check
git status --short --untracked-files=all
```

### 11.5D — Preview operacional editável

**Status:** próxima execução.

**Objetivo**
Permitir revisão antes de materializar agenda.

**O preview deve mostrar**

* protocolo;
* item do protocolo;
* lote/categoria/animais previstos;
* janela de início;
* janela de fim;
* status da janela;
* data sugerida de manejo;
* responsável;
* quantidade total aplicável;
* quantidade concluída;
* quantidade ainda não elegível;
* quantidade elegível em breve;
* quantidade em janela;
* quantidade próxima ao limite;
* quantidade atrasada;
* limitações;
* fonte técnica;
* exclusões e motivos.

**Customização permitida no início**

```typescript
type AgendaPlanningOverride = {
  dataSugeridaManejo?: string;
  responsavelNome?: string;
  observacaoPlanejamento?: string;
  exclusoes?: Array<{
    animalId: string;
    motivo: string;
  }>;
};

```

**Não permitir no início**

* intervalo customizado
* recorrência customizada
* alteração de dose
* alteração de regra técnica

Esses pontos só entram depois com motivo explícito e trilha de exceção técnica.

**Regras**

* Preview não cria agenda automaticamente.
* Preview não cria evento.
* Preview não conclui agenda.
* Preview não baixa estoque.
* Preview pode ser editado antes da materialização.
* Modal apenas renderiza.
* Hook apenas orquestra.
* Regra técnica fica em core puro.
* Preview deve declarar que é simulação operacional, não histórico.

### 11.5E — Materialização idempotente da agenda sanitária

**Status:** futura.

**Objetivo**
Transformar preview confirmado em agenda planejada sem duplicidade.

**Fluxo correto**

```txt
preview local determinístico
→ confirmação gera operação local/queue op
→ materialização local idempotente
→ sync aplica remotamente sem duplicar
→ RPC fica apenas como reconciliação/admin

```

**Requisitos**

* Usar `dedup_key` determinístico.
* Preservar `client_op_id`.
* Retry não pode duplicar agenda.
* Sync não pode duplicar agenda.
* Materialização não cria evento.
* Materialização não conclui agenda.
* Materialização não baixa estoque.
* RPC não é caminho principal.
* RPC pode existir apenas como reconciliação/admin.

**Snapshot mínimo na agenda**
A agenda deve guardar apenas o necessário para explicar por que foi criada.

```typescript
type AgendaProtocolCalculationSnapshot = {
  protocoloId: string;
  protocoloItemId: string;
  protocoloVersion?: string;
  tipo: string;
  produtoId?: string;
  doseNum?: number;
  regraJanela?: {
    inicioOffsetDias?: number;
    fimOffsetDias?: number;
    unidadeReferencia: "nascimento" | "evento" | "entrada_lote" | "manual";
  };
  dataReferencia: string;
  janelaInicio?: string;
  janelaFim?: string;
  dataSugerida?: string;
};

```

O snapshot completo de execução pertence ao evento, não à agenda.

### 11.5F — Execução sanitária como evento

**Status:** futura.

**Objetivo**
Garantir que execução real permaneça em evento.

**Fluxo**

```txt
agenda planejada
→ manejo realizado
→ evento sanitário executado

```

**O evento deve carregar**

* animais efetivamente manejados;
* protocolo aplicado;
* item de protocolo aplicado;
* produto/insumo;
* dose/unidade;
* responsável;
* data real;
* vínculo com agenda/demanda, quando houver;
* animais previstos não executados;
* motivo de não execução, quando aplicável;
* baixa de estoque idempotente, quando aplicável.

**Regras**

* Execução real gera evento.
* Agenda não vira histórico.
* Evento é a fonte de verdade histórica.
* Estoque só baixa na execução, não no planejamento.
* `completed` sanitário depende de evento, não de agenda.
* Evento deve permitir execução parcial do manejo planejado.

### 11.5G — Semântica final de fechamento da agenda

**Status:** futura, dependente da 11.5A.

**Objetivo**
Separar fechamento administrativo de execução.

**Hipótese futura de status persistido**

* `aberta`
* `programada`
* `concluido_executado`
* `cancelado`
* `dispensado`
* `fechado_sem_execucao`

**Estados derivados preferenciais**

* `atrasada`
* `vence_hoje`
* `proximo_limite`
* `em_janela`
* `elegivel_em_breve`

**Regras**

* `concluido_executado` exige `source_evento_id`.
* `cancelado` exige motivo.
* `dispensado` exige motivo.
* `fechado_sem_execucao` exige motivo.
* `atrasada` deve ser preferencialmente derivada por data/janela, não persistida como status principal.
* `proximo_limite` deve ser derivado por threshold explícito.
* `em_janela` deve ser derivado da janela sanitária.
* Fechamento administrativo não pode ser usado como execução sanitária.
* Não aplicar constraint de `source_evento_id` antes de auditar dados e fluxos existentes.

### 11.5H — Fechamento e handoff

**Status:** futura.

**Objetivo**
Consolidar contrato, validações, riscos residuais e handoff para liberar a Fase 12.

**Entregáveis**

* contrato da Agenda Sanitária v2 documentado;
* migrations/schema registradas, se houver;
* testes executados e registrados;
* riscos residuais documentados;
* decisões de descarte/reset documentadas;
* documentação final atualizada;
* handoff técnico para próxima fase.

---

## 9. Arquivos/áreas candidatas

| Subfase | Áreas candidatas |
| --- | --- |
| **11.5A** | `src/lib/sanitario/**`, `src/lib/agenda/**`, `src/pages/Agenda/**`, `src/pages/Registrar/hooks/useRegistrarSanitarioPackage.ts`, `src/lib/offline/**`, `supabase/functions/sync-batch/**`, `supabase/migrations/**`, testes relacionados |
| **11.5B0** | `src/lib/sanitario/rules/**`, documentação de contrato sanitário, produto, carência e fontes técnicas |
| **11.5B1** | `src/lib/sanitario/eligibility/**` |
| **11.5C** | `src/lib/sanitario/eligibility/**`, `src/lib/sanitario/agenda/**` |
| **11.5D** | `src/lib/sanitario/agenda/preview.ts`, `src/pages/Registrar/components/**`, `src/pages/Registrar/hooks/**` |
| **11.5E** | `src/lib/sanitario/infrastructure/**`, `src/lib/offline/**`, `supabase/functions/sync-batch/**`, migrations se necessário |
| **11.5F** | `src/lib/events/**`, `src/lib/inventory/**`, `src/pages/Registrar/**` |
| **11.5G** | `src/pages/Agenda/**`, `src/lib/agenda/**`, migrations se necessário |
| **11.5H** | documentação de fase, handoff, status, contexto e arquitetura após contrato confirmado |

---

## 10. Comandos de inspeção para 11.5A

```bash
git grep -n "source_evento_id\|dedup_key\|client_op_id\|status.*concluido\|concluido" -- src supabase
git grep -n "agenda_itens\|AgendaItem\|completeAgenda\|concluir\|fechar" -- src supabase
git grep -n "computeNextSanitaryOccurrence\|agendaSchedule\|sanitario_recompute" -- src supabase
git grep -n "queue_ops\|sync-batch\|offline\|idempot" -- src supabase tests
git grep -n "estoque\|consumo\|baixa" -- src supabase tests

```

---

## 11. Validação proporcional

**Antes de qualquer patch**

```bash
git status --short --untracked-files=all
git diff --check

```

**Para 11.5A**

```bash
pnpm test -- tests/sync
pnpm test -- src/lib/offline
pnpm test -- src/lib/events
pnpm test -- src/pages/Agenda
git diff --check

```

**Para 11.5B0 documental**

```bash
git diff --check
git status --short --untracked-files=all

```

**Para core puro de elegibilidade**

```bash
pnpm test -- src/lib/sanitario/eligibility
pnpm run lint
pnpm run build
git diff --check

```

**Para demanda/preview**

```bash
pnpm test -- src/lib/sanitario
pnpm test -- src/lib/agenda
pnpm test -- src/pages/Registrar
pnpm run lint
pnpm run build
git diff --check

```

**Se houver Supabase, migrations, RLS, RPC, edge functions ou sync-batch**

```bash
supabase db reset
node scripts/codex/validate-supabase-baseline-functional.mjs
pnpm run lint
pnpm run build
git diff --check

```

---

## 12. Critério de aceite da Fase 11.5

A Fase 11.5 é aceita quando:

* contrato da Agenda Sanitária v2 estiver documentado e implementado;
* janelas sanitárias estiverem modeladas;
* elegibilidade sanitária por janela estiver em core puro;
* `completed` depender de evento executado, não de agenda;
* demanda agrupada estiver separada de agenda e evento;
* demanda agrupada permitir cobertura sanitária por protocolo/lote/janela;
* preview operacional não criar evento nem baixa de estoque;
* materialização da agenda for idempotente;
* materialização não gerar agenda animal-a-animal por padrão;
* execução real continuar em evento;
* baixa de estoque ocorrer apenas na execução real;
* fechamento administrativo não for confundido com execução;
* testes cobrirem retry/offline/sync e regras principais;
* Os contratos devem ser criados como core puro/documental ou tipos isolados, sem acoplamento com schema atual de Supabase/Dexie.
* Carência ativa não deve ser calculada nesta subfase; apenas o contrato para cálculo futuro deve ser definido.
* schema/migrations, se existirem, estiverem validados;
* documentação final estiver atualizada;
* Fase 12 continuar não iniciada até fechamento formal da 11.5.

---

## 13. Riscos principais

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| **Redesenho amplo demais** | Regressão em Agenda/Registrar | Executar por subfases e manter testes sentinela |
| **Agenda virar histórico** | Quebra conceitual grave | Evento continua única fonte de execução |
| **`completed` por agenda concluída** | Histórico falso | `completed` depende somente de evento compatível |
| **Geração animal-a-animal** | Fadiga operacional | Agrupamento por lote/protocolo/janela como padrão |
| **Migration destrutiva sem controle** | Perda indevida de dados | Diagnóstico 11.5A + plano explícito de reset/migration |
| **RPC virar caminho principal** | Quebra offline-first | Materialização por operação local/queue op |
| **Regra técnica em UI** | Duplicação e inconsistência | Core puro para elegibilidade/demanda |
| **Idade estimada não sinalizada** | Erro em protocolo por idade | Limitações explícitas no motor |
| **Estoque baixado no planejamento** | Erro operacional/financeiro | Baixa apenas no evento executado |
| **Constraint prematura em `source_evento_id`** | Quebra fluxo legado/fechamento administrativo | Auditar status antes de aplicar constraint |
