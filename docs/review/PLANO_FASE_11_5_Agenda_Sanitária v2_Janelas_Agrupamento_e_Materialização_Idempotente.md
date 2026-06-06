```markdown
# Plano Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente

**Atualizado em:** 2026-06-05  
**Status:** planejada / pronta para iniciar 11.5A  
**Baseline documental de entrada:** a confirmar localmente  
**Commit local de entrada:** a confirmar localmente  

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
* Baixa de estoque ocorre apenas na execução real.
* Materialização de agenda não cria evento.
* Materialização de agenda não baixa estoque.
* RPC não deve ser caminho principal por causa do offline-first.

---

## 6. Escopo permitido

* Diagnosticar o contrato atual da Agenda Sanitária.
* Definir contrato alvo da Agenda Sanitária v2.
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

**Status:** próxima execução.

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

### 11.5B — Motor puro de elegibilidade sanitária por janela

**Status:** futura, dependente da 11.5A.

**Objetivo**
Calcular elegibilidade sanitária por janela de ação, sem IO e sem UI.

**Arquivos prováveis**

* `src/lib/sanitario/eligibility/sanitaryEligibility.ts`
* `src/lib/sanitario/eligibility/__tests__/sanitaryEligibility.test.ts`

**Função conceitual**

```typescript
computeSanitaryEligibility({
  animal,
  protocolItem,
  executedEvents,
  referenceDate,
  thresholds
});

```

**Status propostos**

```typescript
type SanitaryEligibilityStatus =
  | "not_applicable"
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
  | "estimated_age"
  | "missing_sex"
  | "missing_lote"
  | "missing_protocol_window"
  | "insufficient_event_history";

```

### 11.5C — Demanda sanitária agrupada

**Status:** futura.

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

### 11.5D — Preview operacional editável

**Status:** futura.

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
| **11.5B** | `src/lib/sanitario/eligibility/**` |
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

**Para core puro**

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
| **Constraint prematura em `source_evento_id**` | Quebra fluxo legado/fechamento administrativo | Auditar status antes de aplicar constraint |

```

```