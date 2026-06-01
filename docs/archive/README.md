```md
# Documentação — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Esta pasta concentra a documentação ativa do RebanhoSync. A documentação foi reorganizada para separar fonte de verdade, arquitetura, domínio, produto, UX, financeiro, manuais, revisões ativas e histórico arquivado.

---

## Estrutura

```txt
docs/
  README.md
  context/
  technical/
  domain/
  product/
  ux/
  finance/
  manuals/
  review/
  archive/

```

### Regra central

A raiz de `docs/` deve permanecer limpa. Arquivos soltos na raiz devem ser evitados.

* **Permitido na raiz:** `README.md`
* Todo conteúdo novo deve ir para a pasta correta.

---

## Mapa de documentação

| Pasta | Função |
| --- | --- |
| `context/` | Fonte de verdade, status do projeto, lacunas e matriz de carregamento de contexto. |
| `technical/` | Arquitetura, offline-first, sync, Supabase, RLS, eventos, agenda, testes e ADRs. |
| `domain/` | Contratos agropecuários: animais, lotes, sanitário, reprodução, compra/venda, tags e sinais. |
| `product/` | Visão de produto, escopo MVP, roadmap, mapa de capacidades, decisões e fora de escopo. |
| `ux/` | UX, padrões de tela, formulários, login, navegação, copy, estados e tokens visuais. |
| `finance/` | Custos, snapshots econômicos, KPIs, limites financeiros e matriz de indicadores. |
| `manuals/` | Manuais por tela, FAQ e troubleshooting para usuário/suporte. |
| `review/` | Revisões ativas, pendências abertas, checklist e relatórios de reconciliação. |
| `archive/` | Histórico fechado, substituído, obsoleto ou apenas consultivo. |

---

## Ordem de leitura recomendada

Para entender o estado atual do projeto:

1. `context/SOURCE_OF_TRUTH.md`
2. `context/PROJECT_STATUS.md`
3. `context/KNOWN_GAPS.md`
4. `product/MVP_SCOPE.md`
5. `product/ROADMAP.md`
6. `technical/ARCHITECTURE.md`
7. `technical/OFFLINE_SYNC.md`
8. `technical/SUPABASE_RLS.md`

---

## Fonte de verdade

Em caso de conflito entre documentos, seguir esta ordem de precedência:

1. Código e migrations ativas.
2. `docs/context/SOURCE_OF_TRUTH.md`.
3. `docs/context/PROJECT_STATUS.md`.
4. Documentos normativos ativos em `technical/`, `domain/`, `product/`, `ux/` e `finance/`.
5. Manuais em `manuals/`.
6. Revisões ativas em `review/`.
7. Histórico em `archive/` (não é fonte operacional padrão).

---

## Contratos centrais e Regras

* **Conceitos:** Agenda = intenção/tarefa futura | Evento = fato histórico executado | `state_*` = estado atual (read model) | Protocolo = regra/configuração | Tags, sinais e insights = auxiliares.
* **Não inferir automaticamente:** Histórico a partir de agenda; execução a partir de protocolo; regra crítica a partir de tag/sinal/badge; histórico completo a partir de `state_*`; peso atual confiável a partir de último peso; venda/abate a partir de carência sanitária; lucro final a partir de margem parcial; custo zero a partir de custo ausente.
* **Carência sanitária:** Pode ser exibida como sinal limitado quando houver fonte estruturada (evento sanitário). **Não significa:** liberação sanitária final, liberado para venda, apto para abate ou aptidão comercial. **Copy preferencial:** *"Sem carência sanitária vigente nas fontes estruturadas disponíveis."*

---

## Convenção de nomes

* **Pastas:** `lowercase`
* **Arquivos normativos:** `UPPER_SNAKE_CASE.md`

---

## Validações e Critério de Aceite

A reorganização está concluída quando:

* A raiz contém apenas `README.md`.
* Todo conteúdo ativo está em subpasta adequada.
* `docs/archive/` contém histórico substituído.
* `docs/review/` contém apenas revisão ativa.
* `docs/context/SOURCE_OF_TRUTH.md` é a norma central.
* Todos os documentos ativos utilizam o baseline `32d7779`.
* Não há referências a estruturas antigas (`docs/design/`, `docs/tasks/`).

> ⚠️ **Nota:** Não transformar este `README` em documentação longa de produto, arquitetura ou domínio. Ele deve permanecer como índice e guia de navegação.

```

```