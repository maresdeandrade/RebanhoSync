```md
# Product Docs — RebanhoSync

Atualizado em: 2026-05-31

## Objetivo

Esta pasta concentra visão, escopo, capacidades, roadmap e decisões de produto do RebanhoSync.

Ela orienta priorização e evita expansão indevida do MVP.

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `PRODUCT_VISION.md` | Visão do produto, público-alvo, proposta de valor e posicionamento. |
| `MVP_SCOPE.md` | Escopo do MVP/beta interno e critérios de aceite. |
| `OUT_OF_SCOPE.md` | O que não deve ser implementado ou inferido no MVP. |
| `CAPABILITY_MAP.md` | Mapa de capacidades por área functional e status. |
| `ROADMAP.md` | Focos de desenvolvimento por fase, sem virar backlog detalhado. |
| `DECISION_LOG.md` | Decisões consolidadas de produto e escopo. |

---

## Quando usar esta pasta

Use `docs/product/` quando a tarefa envolver:

- escopo;
- priorização;
- roadmap;
- MVP;
- público-alvo;
- proposta de valor;
- capacidade funcional;
- decisão de produto;
- dúvida se algo deve entrar ou não;
- avaliação de expansão de escopo.

---

## Quando não usar

Não usar esta pasta como fonte principal para: RLS, sync/offline, schema, arquitetura técnica, regra agropecuária detalhada, layout visual, manual do usuário, validação de teste ou PR body.

### Guia de Pastas por Tema

| Tema | Pasta |
|---|---|
| Fonte de verdade / lacunas / status | `docs/context/` |
| Arquitetura / sync / RLS / testes | `docs/technical/` |
| Domínio agropecuário | `docs/domain/` |
| UX / UI | `docs/ux/` |
| Financeiro / KPI detalhado | `docs/finance/` |
| Manual / suporte | `docs/manuals/` |
| Histórico | `docs/archive/` |

---

## Contrato de produto

O RebanhoSync deve permanecer:

- operacional;
- offline-first;
- simples para campo;
- seguro por fazenda;
- baseado em fonte de verdade explícita;
- incremental;
- confiável antes de amplo.

---

## MVP em uma frase

```txt
App offline-first para gestão prática de rebanho, agenda, eventos e manejo pecuário, com foco em rastreabilidade operacional e baixa fricção no campo.

```

### Fora de escopo resumido

Não priorizar no MVP:

* ERP fiscal completo;
* NF-e/SPED;
* contabilidade completa;
* carência automática;
* pronto para venda automático;
* apto para abate automático;
* peso atual confiável automático;
* motor reprodutivo amplo;
* analytics preditivo;
* recomendação veterinária autônoma.

### Detalhes

* `docs/product/OUT_OF_SCOPE.md`

---

## Relação com `docs/context`

`docs/context/` define fonte de verdade, lacunas e status vivo. `docs/product/` define escopo e prioridade.

Em caso de conflito, confiar nesta ordem:

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Docs normativos ativos.
4. Docs derivados.
5. Histórico em `docs/archive/`.

---

## Relação com `docs/domain`

Produto decide se algo entra no escopo. Domínio define como a regra deve funcionar corretamente.

> 💡 **Exemplo:** Produto pode decidir que “sanitário operacional” entra no MVP. O domínio sanitário define que protocolo não é execução e carência não pode ser inferida.

---

## Relação com `docs/ux`

Produto define: foco, público, prioridade, escopo e fora de escopo.

UX traduz isso em: fluxo, tela, copy, CTA, hierarquia visual e padrões de formulário.

---

## Manutenção

Atualizar esta pasta quando houver: mudança de escopo, nova capacidade, capacidade removida, decisão de produto relevante, mudança de fase, roadmap ajustado ou item saindo do out-of-scope.

> ⚠️ **Não atualizar por:** ajuste visual pequeno, correção local, teste isolado, refatoração sem impacto de capacidade ou mudança documental sem impacto de produto.

---

## Checklist de decisão de produto

Antes de aprovar uma nova funcionalidade, responder:

* [ ] Resolve problema real do produtor?
* [ ] Pertence ao MVP?
* [ ] Exige fonte técnica ainda inexistente?
* [ ] Afeta offline-first?
* [ ] Afeta RLS/multi-tenant?
* [ ] Cria decisão crítica automática?
* [ ] Duplica fonte de verdade?
* [ ] Pode ser explicada de forma simples?
* [ ] Tem critério de aceite testável?
* [ ] Deve atualizar `CAPABILITY_MAP.md`, `ROADMAP.md` ou `OUT_OF_SCOPE.md`?

```

```