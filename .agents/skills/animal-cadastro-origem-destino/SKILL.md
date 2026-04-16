---
name: animal-cadastro-origem-destino
description: Use when the task is about cadastro de animal, origem, entrada, compra, venda, morte/saída, status do animal, criação manual, edição de cadastro, ou separação entre atributo-base do animal e projeção derivada do histórico/eventos.
---

# Animal — Cadastro, Origem e Destino

## Missão

Orientar mudanças e decisões no **cadastro-base** e nos fluxos de **origem/destino** do animal:
- criação de animal
- edição cadastral
- entrada por compra/origem externa
- saída, venda ou morte
- status do animal
- relação entre cadastro-base e eventos/financeiro
- evitar mistura entre dado-base, evento operacional e projeção derivada

Esta skill **não** é para o fluxo reprodutivo completo de parto/pós-parto/cria inicial.  
Para isso, usar `reproducao-parto-posparto-cria`.

---

## Quando usar

Use esta skill quando a tarefa envolver:

- `src/pages/AnimalNovo.tsx`
- `src/pages/AnimalEditar.tsx`
- `src/pages/Animais.tsx`
- `src/pages/AnimalDetalhe.tsx`
- `src/pages/AnimaisImportar.tsx`
- `src/lib/animals/**` quando tocar cadastro-base, apresentação ou ordenação ligada a status/origem/destino
- fluxo de compra/venda/entrada/saída
- vínculo com `financeiro` por compra/venda
- distinção entre atributo-base e projeção derivada

Capabilities/tracks prováveis:
- cadastro de `animais`
- `financeiro.registro` quando a tarefa tocar compra/venda
- `movimentacao.registro` quando a entrada/saída tocar lote/origem/destino
- `infra.compliance` só se houver bloqueio regulatório de venda/trânsito

---

## Quando NÃO usar

Não use esta skill para:
- cobertura/IA/diagnóstico/parto
- pós-parto neonatal
- cria inicial
- episode linking
- ownership de `taxonomy_facts` event-driven
- anti-teleporte/movimentação detalhada
- catálogo sanitário/regulatório

Nesses casos, usar:
- `reproducao-parto-posparto-cria`
- `movimentacao-transito-conformidade`
- `sanitario-*`

---

## Ler primeiro

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`

Ler só se necessário:
- `docs/DB.md`
- `docs/CONTRACTS.md`
- `docs/OFFLINE.md`

Arquivos-alvo mais comuns:
- `src/pages/AnimalNovo.tsx`
- `src/pages/AnimalEditar.tsx`
- `src/pages/Animais.tsx`
- `src/pages/AnimalDetalhe.tsx`
- `src/pages/AnimaisImportar.tsx`
- `src/lib/animals/**`
- `src/pages/Financeiro.tsx` se a tarefa tocar compra/venda

---

## Modelo mental obrigatório

Separar sempre:

1. **cadastro-base do animal**
   - identificação
   - sexo
   - datas/origem/status
   - lote atual
   - vínculos básicos quando aplicável

2. **evento operacional**
   - compra
   - venda
   - morte/saída
   - movimentação
   - reprodução
   - sanitário

3. **projeção derivada**
   - faixa/categoria derivada
   - peso atual derivado de pesagem
   - estados de leitura
   - parte da taxonomia canônica

Nem tudo que o usuário vê na ficha do animal deve virar coluna/campo manual do cadastro.

---

## Decisão rápida

### Caso A — Criação manual de animal
Persistir só o necessário para o cadastro-base.

Evitar colocar no cadastro:
- próximo manejo
- estado sanitário derivado
- status reprodutivo derivado
- peso atual como fonte primária

### Caso B — Compra
Separar:
- inserção/ativação do animal
- evento financeiro de compra
- eventual origem/contraparte
- eventual lote inicial

### Caso C — Venda
Separar:
- evento financeiro de venda
- mudança de status do animal
- bloqueios regulatórios se existirem
- não tratar exclusão física como regra normal

### Caso D — Morte/Saída
Separar:
- status do animal
- evento correspondente quando o fluxo atual exigir rastreabilidade
- não inventar remoção destrutiva como regra operacional padrão

---

## Invariantes obrigatórias

- `animais` continua sendo estado atual do animal
- não transformar evento operacional em simples edição silenciosa do cadastro quando o histórico importa
- não usar `DELETE` como fluxo normal de saída/venda/morte
- não persistir como atributo-base o que é projeção derivada do histórico
- não misturar fluxo reprodutivo completo dentro da skill de cadastro
- manter coerência entre status, lote atual, origem e histórico de eventos

---

## Anti-padrões

- salvar no cadastro-base:
  - peso atual como fonte primária
  - próxima dose
  - categoria/faixa etária manual derivável
  - estado reprodutivo como label fixa
- tratar compra/venda como simples `UPDATE` sem evento quando o domínio exige histórico
- hard-delete de animal como fluxo normal
- misturar parto/cria inicial com simples cadastro manual sem respeitar o fluxo reprodutivo real

---

## Checklist antes de alterar

1. A mudança é de cadastro-base, compra/venda, ou visualização derivada?
2. O dado deveria viver em `animais`, em `eventos_*`, ou só em projection?
3. Há impacto em `status` do animal?
4. Há impacto em lote atual/origem/destino?
5. A tarefa deveria estar numa skill reprodutiva ou de movimentação em vez desta?

---

## Forma de entrega

Retornar:
- diff mínimo
- separação entre cadastro/evento/projeção
- até 3 riscos
- testes focados

---

## Validação mínima

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar compra/venda/saída:
- revisar impactos em financeiro
- revisar bloqueios regulatórios de venda/trânsito quando aplicável

---

## Escalonamento

Escalar para `reproducao-parto-posparto-cria` quando tocar:
- parto
- pós-parto
- cria inicial
- episode linking
- fatos reprodutivos event-driven

Escalar para `movimentacao-transito-conformidade` quando tocar:
- mudança de lote
- trânsito externo
- anti-teleporte
- GTA/e-GTA
- PNCEBT

Escalar para `migrations-rls-contracts` quando tocar:
- schema de `animais`
- FKs
- status/enum estrutural
- RLS