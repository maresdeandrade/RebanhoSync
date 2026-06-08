# Decision Log — RebanhoSync

Atualizado em: 2026-06-06
**Baseline Commit:** `91e0775`

## Objetivo

Registrar decisões consolidadas de produto e escopo.

Este documento não é changelog técnico.

Ele deve conter apenas decisões que ajudam a evitar retrabalho, ambiguidade ou expansão indevida.

---

## Formato

Cada decisão deve conter:

* data;
* decisão;
* motivo;
* impacto;
* status.

---

## Decisões consolidadas

### 2026-06-07 — Protocolo/produto/fonte técnica antes de offline/sync sanitário

**Decisão:** inserir a subfase 12D0 para definir o modelo canônico de Protocolo Sanitário v2, Produto, Fonte Técnica, Carência, Espécie, Bubalino e snapshots antes de implementar offline/sync da Agenda Sanitária v2.

* **Motivo:** implementar sync agora cristalizaria payloads de `agenda_intent`, handlers e snapshots enquanto o contrato de protocolo/produto/fonte ainda está frouxo. A curadoria bibliográfica e regulatória precisa estabilizar quais campos exigem bula, norma, fonte forte, guideline de apoio ou decisão veterinária responsável.
* **Impacto:** 12D0 é documental/contratual e usa o guideline de vacinação, imunização e controle parasitário apenas como fonte curatorial e matriz de casos. Offline/sync da Agenda v2 fica postergado para depois de 12D1 ou fase equivalente de contrato persistido. Guideline isolado não valida dose, via, carência, uso bubalino, venda, abate ou aptidão operacional.
* **Status:** aprovado na 12D0 em escopo reduzido documental. SQL, Dexie, sync-batch, UI, seed, agenda, evento, estoque e carência ativa permanecem fora desta decisão.

### 2026-06-06 — Fundação SQL/RLS da Agenda Sanitária v2

**Decisão:** criar a fundação SQL/RLS da Agenda Sanitária v2 em tabelas dedicadas e resetar o legado sanitário em `agenda_itens`, preservando fatos executados.

* **Motivo:** a decisão clean/reset da 12B removeu a agenda sanitária legada como restrição de produto. A 12C precisava materializar a fronteira persistida mínima sem conectar Dexie, sync-batch ou UI, mantendo agenda como intenção e evento como fato.
* **Impacto:** `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2` passam a ser a base SQL da agenda sanitária v2. `agenda_itens` sanitário foi resetado por soft-delete operacional e nova escrita sanitária legada foi bloqueada. `sanitario_recompute_agenda_core` passou a no-op para não repovoar o legado. `eventos`, `eventos_sanitario` e `insumo_movimentacoes` permanecem preservados e continuam sendo a fonte factual.
* **Status:** aprovado na 12C em escopo SQL/RLS/reset. Dexie, sync-batch, UI, seed funcional, carência ativa, venda, abate e aptidão operacional permanecem fora do implementado.

### 2026-06-06 — Persistência sanitária v2 clean com reset do legado

**Decisão:** substituir a direção transitória da 12A por um modelo clean da persistência sanitária v2, com estruturas dedicadas para agenda sanitária, animais planejados e closures administrativos, e com reset controlado da agenda sanitária legada.

* **Motivo:** a 12A confirmou que `agenda_itens` sanitário mistura intenção futura, status administrativo e ponte para execução; `status='concluido'` é ambíguo; e a nova diretriz de produto remove a necessidade de preservar compatibilidade reversa com payload/dedup/status antigos. O legado passa a servir apenas como auditoria do que deve ser removido/substituído.
* **Impacto:** 12C+ deve criar schema v2 dedicado, com `fazenda_id`, FKs compostas, RLS, idempotência por `client_op_id`/`dedup_key` e reset explícito de dados operacionais sanitários antigos. `agenda_itens` sanitário, `state_agenda_itens` sanitário, filas antigas incompatíveis e seeds/demo sanitários obsoletos podem ser resetados. `eventos`, `eventos_sanitario`, `insumo_movimentacoes`, protocolos históricos e catálogos técnicos usados por eventos reais não podem ser apagados em migration comum.
* **Status:** aprovado na 12B como decisão arquitetural clean/reset. Não houve migration, schema, Dexie, sync-batch, RLS, RPC, UI, seed ou alteração funcional nesta decisão documental.

### 2026-06-06 — Direção de schema para Agenda Sanitária v2

**Decisão:** para a Fundação Sanitária v2, criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória.

* **Motivo:** `agenda_itens` atual mistura domínios e usa `status='agendado'|'concluido'|'cancelado'`; `status='concluido'` é ambíguo para sanitário v2; o SQL/RPC legado ainda lidera materialização/conclusão; e os contratos 11.5 existem apenas como core puro. Reaproveitar somente `agenda_itens` manteria payload opaco e risco de fonte paralela; substituir tudo de uma vez elevaria risco em UI, Dexie, sync-batch, RLS e views.
* **Impacto:** 12B+ deve desenhar persistência explícita para `agenda_intent`, `event_execution_intent` e `agenda_closure_intent`, com `fazenda_id`, RLS/FKs compostas, idempotência, replay e conflitos. `agenda_itens` pode continuar como superfície operacional durante transição. Dados factuais (`eventos`, `eventos_sanitario`, `insumo_movimentacoes`) não podem ser apagados em migration comum.
* **Status:** substituído pela decisão clean/reset da 12B. Permanece como registro histórico da auditoria 12A, sem força como restrição de produto para a agenda sanitária legada.

---

### 2026-06-06 — Rebaseline estratégico pós-Agenda Sanitária v2

**Decisão:** reordenar o roadmap técnico após a consolidação documental da Agenda Sanitária v2.

* **Motivo:** Compra/Venda não deve avançar antes da aplicação real dos contratos sanitários v2; Reprodução é domínio estrutural ausente e precisa anteceder KPIs, financeiro e decisão assistida; KPIs/financeiro dependem de fontes consolidadas; decisão assistida depende de dados confiáveis e limites explícitos.
* **Impacto:** a próxima fase futura passa a ser Fase 12 — Fundação Sanitária v2: Persistência, Sync, Schema e Rollout; Reprodução passa a Fase 13; Compra/Venda fica como Fase 14; KPIs, Financeiro, Motor de Decisão e Beta externo passam a Fases 15-18. Trilhas de higiene DX, hardening sanitário residual, docs reconciliation, compliance avançado, performance e UX incremental permanecem contínuas, não fases principais imediatas.
* **Status:** aprovado. Fase 12 ainda não foi iniciada; a 11.5J é documental e não altera código, schema, migrations, Supabase, Dexie, UI, sync, RLS, RPC ou Edge Functions.

---

### 2026-06-06 — Consolidar Agenda Sanitária v2 em contratos puros

**Decisão:** consolidar a Fase 11.5 como Agenda Sanitária v2 em contratos puros, antes de qualquer persistência real.

* **Motivo:** separar regra/produto/fonte técnica, janela, elegibilidade, demanda, preview, agenda, execução e fechamento administrativo sem tratar agenda como histórico.
* **Impacto:** 11.5A-G concluíram contratos core puros; 11.5H fechou o handoff documental; `agenda_intent`, `event_execution_intent` e `agenda_closure_intent` ficam definidos como comandos/intenção, ainda sem aplicação em Supabase/Dexie/sync.
* **Status:** aprovado. À época da decisão, a Fase 12 não estava iniciada; após a 12A, persistência, sync, schema, RLS, RPC, Edge Functions, Dexie, UI e seed continuam pendentes de fase futura com diagnóstico próprio.

---

### 2026-06-05 — Criar Fase 11.5 para Agenda Sanitária v2

**Decisão:** criar a Fase 11.5 — Agenda Sanitária v2: Janelas, Agrupamento e Materialização Idempotente — antes da Fase 12.

* **Motivo:** protocolos sanitários são frequentemente janelas operacionais, não datas exatas.
* **Impacto:** agenda sanitária antiga pode ser substituída; evento permanece fonte histórica; materialização de agenda não executa manejo, não cria evento e não baixa estoque.
* **Status:** decisão planejada para diagnóstico e contrato alvo na 11.5A.

---

### 2026-05-31 — Reorganizar documentação ativa

**Decisão:** separar documentação em pastas normativas:

```txt
docs/
  ├── context/
  ├── technical/
  ├── domain/
  ├── product/
  ├── ux/
  ├── finance/
  ├── manuals/
  ├── review/
  └── archive/

```

* **Motivo:** reduzir drift documental, consumo de tokens e uso de auditorias antigas como fonte ativa.
* **Impacto:** docs ativos devem ser curtos, normativos e específicos.
* **Status:** aprovado.

---

### 2026-05-31 — Criar `docs/context/` como contexto vivo

**Decisão:** criar `docs/context/` com fonte de verdade, lacunas, status do projeto e matriz de carregamento.

* **Motivo:** agentes precisam de contexto curto e confiável antes de abrir docs técnicos ou de domínio.
* **Impacto:** substitui dependência de docs longos e antigos como primeira leitura.
* **Status:** aprovado.

---

### 2026-05-31 — Criar `docs/technical/` como contrato técnico ativo

**Decisão:** centralizar arquitetura, offline/sync, Supabase/RLS, Agenda/Eventos e gates de teste em `docs/technical/`.

* **Motivo:** separar regra técnica de domínio e produto.
* **Impacto:** referências antigas como `docs/OFFLINE.md`, `docs/RLS.md` e `docs/CONTRACTS.md` devem ser substituídas ou redirecionadas.
* **Status:** aprovado.

---

### 2026-05-31 — Criar `docs/domain/` como contrato agropecuário

**Decisão:** criar contratos de domínio para base agro, animais, lotes/pastos, sanitário, reprodução, compra/venda e tags/sinais.

* **Motivo:** evitar mistura entre regra agropecuária, arquitetura técnica e UX.
* **Impacto:** decisões de domínio passam a apontar para documentos específicos.
* **Status:** aprovado.

---

### 2026-05-31 — `AGRO_BASE.md` deve ser curto

**Decisão:** `AGRO_BASE.md` deve ser conceitual e transversal, não manual agropecuário completo.

* **Motivo:** versão longa duplicaria documentos específicos.
* **Impacto:** detalhes ficam em `SANITARIO.md`, `ANIMAIS_TAXONOMIA.md`, `LOTES_PASTOS.md`, `REPRODUCAO.md`, `COMPRA_VENDA.md`.
* **Status:** aprovado.

---

### 2026-05-31 — Manter `ANIMAIS_TAXONOMIA.md`

**Decisão:** criar e manter `docs/domain/ANIMAIS_TAXONOMIA.md`.

* **Motivo:** categoria zootécnica, estágio de vida, status, sexo, raça e aptidão não são a mesma coisa.
* **Impacto:** evita simplificação indevida da taxonomia animal.
* **Status:** aprovado.

---

### 2026-05-31 — Agenda não é histórico

**Decisão:** manter agenda como intenção/tarefa futura.

* **Motivo:** histórico exige fato executado.
* **Impacto:** KPIs históricos devem usar eventos, não agenda.
* **Status:** permanente.

---

### 2026-05-31 — Evento é fonte histórica

**Decisão:** evento é fonte primária para fatos executados, histórico, auditoria e KPIs.

* **Motivo:** preserva rastreabilidade e evita falso histórico.
* **Impacto:** agenda concluída sem evento não deve virar prova operacional.
* **Status:** permanente.

---

### 2026-05-31 — Tags, sinais e insights são auxiliares

**Decisão:** tags, sinais e insights não podem ser fonte primária.

* **Motivo:** são apoio de UX/consulta.
* **Impacto:** não podem decidir carência, venda, abate, peso confiável ou protocolo executado.
* **Status:** permanente.

---

### 2026-05-31 — Carência automática permanece bloqueada

**Decisão:** não afirmar carência ativa/livre de carência sem fonte técnica explícita.

* **Motivo:** alto risco operacional e sanitário.
* **Impacto:** respostas devem ser bloqueadas ou parciais.
* **Status:** bloqueado.

---

### 2026-05-31 — Venda/abate automático permanece bloqueado

**Decisão:** não automatizar pronto para venda ou apto para abate.

* **Motivo:** exige composição técnica, sanitária, comercial e documental.
* **Impacto:** sinais podem indicar pendências, mas não autorizar decisão.
* **Status:** bloqueado.

---

### 2026-05-31 — Peso atual confiável permanece bloqueado

**Decisão:** não tratar última pesagem como peso atual confiável sem regra técnica.

* **Motivo:** peso perde validade com tempo, método e contexto.
* **Impacto:** pode exibir último peso, mas não afirmar confiabilidade atual.
* **Status:** bloqueado.

---

### 2026-05-31 — MVP não é ERP fiscal completo

**Decisão:** manter foco operacional e não fiscal/contábil completo.

* **Motivo:** ERP fiscal amplia escopo e complexidade fora do objetivo atual.
* **Impacto:** NF-e, SPED e contabilidade completa ficam fora do MVP.
* **Status:** aprovado.

---

### 2026-05-31 — UX deve priorizar operação de campo

**Decisão:** fluxos devem ser simples, diretos e operacionais.

* **Motivo:** usuário de campo precisa registrar rápido, com baixa fricção.
* **Impacto:** formulários devem evitar complexidade desnecessária e progressivamente revelar detalhes técnicos.
* **Status:** aprovado.

---

### 2026-05-31 — Product docs devem vir antes de UX docs

**Decisão:** estruturar `docs/product/` antes de `docs/ux/`.

* **Motivo:** UX deve traduzir escopo e posicionamento, não definir escopo sozinha.
* **Impacto:** visão, MVP, mapa de capacidades e out-of-scope guiam padrões de tela.
* **Status:** aprovado.

---

## Como adicionar nova decisão

Usar modelo:

### AAAA-MM-DD — Título curto

**Decisão:** texto claro.

* **Motivo:** razão objetiva.
* **Impacto:** consequência prática.
* **Status:** aprovado | bloqueado | substituído | em revisão.

> ⚠️ **Regras:**
> * Não registrar decisão trivial.
> * Não usar este documento como changelog.
> * Não registrar implementação detalhada.
> * Não registrar auditoria antiga.
> * Atualizar quando uma decisão for substituída.
> * Em conflito com código/migrations ativas, validar antes de manter a decisão.

```


```
