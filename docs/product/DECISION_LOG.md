# Decision Log — RebanhoSync

Atualizado em: 2026-06-05
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
