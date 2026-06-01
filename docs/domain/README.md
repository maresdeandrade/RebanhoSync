```md
# Domain Docs — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Esta pasta concentra os contratos de domínio agropecuário do RebanhoSync.

Ela define vocabulário, limites de interpretação e regras por área funcional, sem duplicar arquitetura técnica ou histórico de auditorias.

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `AGRO_BASE.md` | Base conceitual agropecuária transversal. |
| `TAGS_SIGNALS_CONTRACT.md` | Contrato de tags, sinais e insights como auxiliares. |
| `ANIMAIS_TAXONOMIA.md` | Animal, identidade, categoria, estágio, status, origem/destino. |
| `LOTES_PASTOS.md` | Lotes, pastos, movimentação, lotação e histórico. |
| `SANITARIO.md` | Sanitário operacional, protocolos, agenda, eventos, produtos, compliance e carência. |
| `REPRODUCAO.md` | Parto, pós-parto, cria e limites do domínio reprodutivo. |
| `COMPRA_VENDA.md` | Compra, venda, sociedade, custos, snapshots e limites comerciais. |

---

## Contrato transversal

```txt
Agenda = intenção/tarefa futura
Evento = fato executado
state_* = estado atual/read model
Protocolo = regra/configuração
Tags/sinais/insights = auxiliares

```

### Detalhes

* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/EVENTS_AGENDA_CONTRACT.md`

---

## Quando usar esta pasta

Use `docs/domain/` quando a tarefa envolver:

* regra agropecuária;
* modelagem de entidade;
* fonte de verdade por domínio;
* fluxo operacional;
* edge case de manejo;
* KPI de domínio;
* decisão crítica;
* separação entre agenda, evento, estado e protocolo.

---

## Quando não usar

Não usar esta pasta para: comando de validação, RLS detalhada, sync/rollback detalhado, layout visual puro, manual do usuário, PR body, prompts ou auditorias antigas.

### Guia de Pastas por Tema

| Tema | Pasta |
| --- | --- |
| Arquitetura / sync / RLS / testes | `docs/technical/` |
| Estado do projeto / fonte transversal | `docs/context/` |
| Produto / roadmap / capacidades | `docs/product/` |
| UX / UI | `docs/ux/` |
| Financeiro / KPI detalhado | `docs/finance/` |
| Manual / suporte | `docs/manuals/` |
| Histórico | `docs/archive/` |

---

## Fonte de verdade em conflito

Em caso de conflito:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico em `docs/archive/`.

> ⚠️ **Observação:** `docs/archive/**` não é fonte operacional atual.

---

## Decisões bloqueadas sem fonte técnica explícita

Não afirmar nem automatizar sem fonte própria:

* carência ativa;
* livre de carência;
* peso atual confiável;
* pronto para venda;
* apto para abate;
* liberação sanitária;
* conformidade regulatória universal;
* protocolo executado;
* agenda concluída como fato histórico;
* IATF pendente amplo.

### Referência

* `docs/context/KNOWN_GAPS.md`

---

## Relação com skills

| Domínio | Skill |
| --- | --- |
| Sanitário operacional | `sanitario-registro-operacional` |
| Sanitário regulatório / compliance | `sanitario-catalogo-regulatorio-compliance` |
| Reprodução parto / cria | `reproducao-parto-posparto-cria` |
| Animal / origem / destino | `animal-cadastro-origem-destino` |
| Movimentação / trânsito | `movimentacao-transito-conformidade` |
| Sync / offline | `sync-offline-rollback` |
| RLS / migrations | `migrations-rls-contracts` |

### Referência

* `.agents/skills/README.md`

---

## Manutenção

Atualizar documentos de domínio quando houver: nova regra funcional, mudança de fonte de verdade, novo edge case relevante, nova decisão bloqueada, lacuna resolvida, alteração real de fluxo operacional ou mudança na modelagem de dados.

> ⚠️ **Não atualizar por:** ajuste visual, copy, refatoração sem mudança funcional, teste isolado ou documentação histórica.

---

## Critério de qualidade

Um documento em `docs/domain/` deve:

* ser normativo;
* ser curto o suficiente para consulta;
* evitar duplicar `docs/context/`;
* evitar duplicar `docs/technical/`;
* declarar limites;
* apontar fonte correta;
* explicitar o que não pode ser inferido;
* separar fato, intenção, estado e regra.

```

```