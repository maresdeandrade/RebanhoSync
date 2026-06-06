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
* **Status:** aprovado. Fase 12 não iniciada; persistência, sync, schema, RLS, RPC, Edge Functions, Dexie, UI e seed permanecem pendentes de fase futura com diagnóstico próprio.

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
