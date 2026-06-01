# UX Docs — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Esta pasta concentra princípios, padrões de tela, formulários, navegação, copy, login e diretrizes visuais do RebanhoSync.

Ela traduz decisões de produto e domínio em experiência operacional.

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `UX_PRINCIPLES.md` | Princípios gerais de experiência. |
| `COPY_GUIDELINES.md` | Linguagem, microcopy, termos seguros e termos proibidos. |
| `EMPTY_PARTIAL_BLOCKED_STATES.md` | Estados de carregamento, vazio, parcial, bloqueado, erro, offline e sync. |
| `LOGIN_UX.md` | Login, sessão, logout, recuperação, fazenda ativa e erros de auth/conexão. |
| `FORM_PATTERNS.md` | Formulários, wizards, checklists, validação e revisão. |
| `SCREEN_PATTERNS.md` | Estrutura de telas, cards, listas, painéis e hierarquia. |
| `NAVIGATION_MODEL.md` | Modelo de navegação principal, mobile e desktop. |
| `VISUAL_TOKENS.md` | Direção visual, badges, severidade, densidade e responsividade. |

---

## Quando usar esta pasta

Use `docs/ux/` quando a tarefa envolver:

- fluxo de tela;
- formulário;
- copy;
- navegação;
- login;
- estados vazios/parciais/bloqueados;
- badges;
- layout;
- mobile;
- hierarquia visual;
- redução de fricção;
- revisão visual.

---

## Quando não usar

Não usar esta pasta como fonte principal para:

- RLS;
- schema;
- sync/rollback;
- regra agropecuária;
- fonte de verdade;
- roadmap;
- decisão de produto;
- cálculo financeiro;
- validação de migration.

Usar:

| Tema | Pasta |
|---|---|
| Fonte de verdade/lacunas/status | `docs/context/` |
| Arquitetura/sync/RLS/testes | `docs/technical/` |
| Domínio agropecuário | `docs/domain/` |
| Produto/roadmap/escopo | `docs/product/` |
| Financeiro/KPI detalhado | `docs/finance/` |
| Manual/suporte | `docs/manuals/` |
| Histórico | `docs/archive/` |

---

## Contratos críticos para UX

A UX deve preservar:

```txt
Agenda = intenção/tarefa futura
Evento = fato executado
state_* = estado atual/read model
Protocolo = regra/configuração
Tags/sinais/insights = auxiliares
```

---

## Regras críticas de linguagem

Não usar sem fonte/contrato:

```txt
Liberado
Apto
Seguro
Pronto para venda
Apto para abate
Livre de carência
Peso atual confiável
Conformidade garantida
```

Preferir:

```txt
Fonte obrigatória ausente.
Fonte carregada com limitação.
Sem carência sanitária vigente nas fontes estruturadas disponíveis.
Sinal sanitário. Não equivale a liberação para venda ou abate.
```

---

## Relação com produto

`docs/product/` define:

- escopo;
- prioridade;
- público;
- roadmap;
- fora de escopo.

`docs/ux/` define:

- como isso aparece para o usuário;
- quais mensagens usar;
- como evitar ambiguidade;
- como reduzir fricção;
- como representar limitações.

---

## Relação com domínio

`docs/domain/` define regras agropecuárias.

`docs/ux/` não pode contrariar o domínio.

Exemplo:

- domínio permite carência sanitária como sinal estruturado;
- UX deve exibir isso como sinal, não como autorização comercial.

---

## Relação com técnico

`docs/technical/` define:

- sync;
- RLS;
- banco;
- eventos/agenda;
- testes.

`docs/ux/` deve refletir esses estados:

- offline;
- sync pendente;
- erro;
- conflito;
- permissão negada;
- sessão expirada.

---

## Manutenção

Atualizar esta pasta quando houver:

- novo padrão de tela;
- mudança de navegação;
- novo estado visual;
- mudança de copy crítica;
- ajuste no login;
- mudança no contrato de carência/sinal/autorização;
- novo padrão de formulário;
- decisão visual relevante.

Não atualizar por:

- ajuste técnico sem impacto de UX;
- migration;
- teste isolado;
- mudança interna sem efeito visual;
- auditoria histórica.

---

## Critério de qualidade

Um documento em `docs/ux/` deve:

- ser prático;
- orientar implementação;
- evitar ambiguidade operacional;
- proteger contratos de domínio;
- reduzir risco de falsa decisão;
- ser curto o suficiente para consulta;
- não duplicar docs técnicos ou de produto.