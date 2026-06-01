# Context Docs — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Esta pasta concentra o contexto vivo e resumido do RebanhoSync.

Ela serve para orientar agentes, revisões, documentação e decisões de produto sem carregar documentos longos ou históricos.

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `CORE_RULES.md` | Regras centrais e invariantes do projeto. |
| `SOURCE_OF_TRUTH.md` | Contrato de fontes: Agenda, Eventos, `state_*`, Protocolos, tags/sinais/insights. |
| `PROJECT_STATUS.md` | Estado atual do projeto, fase, prioridades e foco. |
| `KNOWN_GAPS.md` | Lacunas conhecidas e decisões bloqueadas sem fonte técnica explícita. |
| `CONTEXT_LOADING_MATRIX.md` | Matriz de quais docs carregar por tipo de tarefa. |

---

## Quando usar esta pasta

Use `docs/context/` quando precisar responder:

- Qual é a regra central do projeto?
- Qual fonte deve responder uma pergunta?
- O que está bloqueado ou não confirmado?
- Qual é o estado atual do RebanhoSync?
- Que documentos devem ser carregados para uma tarefa?
- Uma decisão pode ser inferida ou precisa de fonte explícita?

---

## O que não fica aqui

Não colocar nesta pasta:

- auditorias antigas;
- handoffs históricos;
- prompts;
- manuais completos;
- matriz KPI extensa;
- detalhes de RLS;
- detalhes de sync;
- documentação visual;
- changelog completo;
- relatórios fechados.

Usar pastas específicas:

| Tema | Pasta |
|---|---|
| Arquitetura, sync, RLS, validações | `docs/technical/` |
| Domínios agropecuários | `docs/domain/` |
| Produto, roadmap e capacidades | `docs/product/` |
| UX/UI | `docs/ux/` |
| Financeiro/KPI | `docs/finance/` |
| Manuais e suporte | `docs/manuals/` |
| Revisões ativas | `docs/review/` |
| Histórico | `docs/archive/` |

---

## Fonte de verdade em conflito

Em caso de conflito:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico em `docs/archive/**`.

Observação: `docs/archive/**` não deve ser usado como fonte operacional atual.

---

## Relação com `.agents/rules`

Esta pasta é documental.

Para comportamento de agentes, usar também:

```txt
.agents/rules/CORE_RULES.md
.agents/rules/CONTEXT_LOADING.md
.agents/rules/no-broad-context.md
.agents/rules/rtk.md
```

Regra prática:

- `docs/context/*` explica o contexto do projeto;
- `.agents/rules/*` orienta como o agente deve agir.

---

## Relação com `docs/technical`

Use `docs/context/` para regra e orientação geral.

Use `docs/technical/` para detalhes técnicos:

- arquitetura;
- offline/sync;
- Supabase/RLS;
- eventos/agenda;
- validação;
- mapa do repositório.

---

## Relação com `docs/domain`

Use `docs/context/` para contratos transversais.

Use `docs/domain/` para regras específicas:

- sanitário;
- reprodução;
- animais;
- lotes/pastos;
- compra/venda;
- tags/sinais.

---

## Manutenção

Atualizar esta pasta quando houver:

- mudança de fase do projeto;
- mudança de fonte de verdade;
- nova lacuna crítica;
- lacuna resolvida;
- nova regra transversal;
- reorganização documental;
- mudança no modo de carregamento de contexto.

Não atualizar por:

- ajuste visual pequeno;
- copy;
- refactor sem impacto funcional;
- teste isolado;
- alteração sem impacto em regra, fonte ou status.

---

## Critério de qualidade

Um arquivo em `docs/context/` deve ser:

- curto;
- normativo;
- estável;
- acionável;
- sem histórico longo;
- sem duplicar documentação técnica;
- sem substituir código ou migrations;
- sem conteúdo de archive como regra ativa.

---

## Checklist rápido

Antes de usar ou editar esta pasta:

- [ ] O assunto é transversal ao projeto?
- [ ] O conteúdo ainda é válido no estado atual?
- [ ] Não deveria estar em `docs/technical/`, `domain/`, `product/`, `ux/` ou `finance/`?
- [ ] Não está duplicando regra já documentada?
- [ ] Não depende de auditoria antiga?
- [ ] Não usa `docs/archive/**` como fonte operacional?